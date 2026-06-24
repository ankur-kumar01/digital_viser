/**
 * Fantasy Cricket API Service
 * Handles fetching real-world data (matches, squads, scorecards).
 * Includes a Mock Mode so we can develop the entire app without a real API key.
 * API quota protection built in — caches responses and reduces redundant calls.
 */
const { pool } = require('../db');

class FantasyApiService {
  constructor() {
    this.baseUrl = 'https://api.cricapi.com/v1';
    this._mockGenerated = false; // Ensure mock data generated only once per match
    this._mockScorecardCache = {}; // api_match_id -> deterministic scorecard
    this._lastApiCall = {}; // endpoint -> timestamp for rate limiting
  }

  async getApiKey() {
    try {
      const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'sports_api_key'");
      if (rows.length > 0 && rows[0].setting_value) {
        return rows[0].setting_value;
      }
    } catch (err) {
      console.error('Error fetching API key:', err);
    }
    return process.env.CRICKET_API_KEY || '';
  }

  async shouldUseMock() {
    const apiKey = await this.getApiKey();
    return !apiKey;
  }

  // Simple rate limiter: don't call same endpoint more than once per N ms
  _checkRateLimit(endpoint, minIntervalMs = 60000) {
    const now = Date.now();
    if (this._lastApiCall[endpoint] && (now - this._lastApiCall[endpoint]) < minIntervalMs) {
      return false;
    }
    this._lastApiCall[endpoint] = now;
    return true;
  }

  // --- API Abstraction Layer ---

  async fetchUpcomingMatches() {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      console.log('No API key found, using mock matches');
      return this._getMockMatches();
    }

    // Rate limit: don't call matches API more than once every 30 min
    if (!this._checkRateLimit('currentMatches', 1800000)) {
      console.log('⏳ [API Quota] Skipping matches sync — last call was < 30 min ago');
      return [];
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/currentMatches?apikey=${apiKey}&offset=0`);
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.reason || 'Failed to fetch matches');
      }

      return data.data.map(m => ({
        api_match_id: String(m.id),
        title: m.name,
        short_title: m.shortName || m.name,
        subtitle: m.matchType,
        format: m.matchType === 't20' ? 'T20' : (m.matchType === 'odi' ? 'ODI' : 'Test'),
        team_a: m.teams?.[0] || 'Team A',
        team_a_logo: m.teamInfo?.[0]?.img || 'https://via.placeholder.com/100?text=Team+A',
        team_b: m.teams?.[1] || 'Team B',
        team_b_logo: m.teamInfo?.[1]?.img || 'https://via.placeholder.com/100?text=Team+B',
        start_time: new Date(m.dateTimeGMT).toISOString().slice(0, 19).replace('T', ' '),
        status: m.matchStarted ? 'live' : 'upcoming'
      }));
    } catch (error) {
      console.error('❌ [Fantasy] CricAPI matches error:', error.message);
      return []; // Never use mock matches when a real API key is configured
    }
  }

  async fetchMatchSquads(apiMatchId, force = false) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      console.log('⏹️ [Fantasy] No API key configured — cannot fetch real squad data');
      return [];
    }

    if (!force && !this._checkRateLimit(`squad_${apiMatchId}`, 900000)) {
      console.log(`⏳ [API Quota] Skipping squad sync for ${apiMatchId} (auto mode)`);
      return []; // Return empty — existing data is already in DB or will be fetched on next cycle
    }
    
    try {
      console.log(`🌐 [Fantasy] Fetching squad from CricAPI for match ${apiMatchId}...`);
      const response = await fetch(`${this.baseUrl}/match_squad?apikey=${apiKey}&id=${apiMatchId}`);
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.reason || 'Failed to fetch squads');
      }

      if (!data.data || data.data.length === 0) {
        console.warn(`⚠️ [Fantasy] CricAPI returned empty squad data for ${apiMatchId}`);
        return [];
      }

      const players = [];
      data.data.forEach(team => {
        const teamName = team.teamName || team.name || 'Team';
        const teamPlayers = team.players || team.player || team.squad || [];
        teamPlayers.forEach(p => {
          let credit = 8.0;
          if (p.role) {
            const role = p.role.toLowerCase();
            if (role.includes('captain') || role.includes('wk') || role.includes('keeper')) credit = 9.5;
            else if (role.includes('bat')) credit = 8.5;
            else if (role.includes('all')) credit = 9.0;
            else if (role.includes('bowl')) credit = 8.0;
          }
          players.push({
            api_player_id: String(p.id),
            name: p.name || 'Unknown Player',
            team_name: teamName,
            role: this._normalizeRole(p.role),
            credit_value: Math.round(credit * 10) / 10
          });
        });
      });

      if (players.length === 0) {
        console.warn(`⚠️ [Fantasy] Zero players parsed from CricAPI for ${apiMatchId}`);
        return [];
      }

      return players;
    } catch (error) {
      console.error('❌ [Fantasy] CricAPI squad fetch error:', error.message);
      return [];
    }
  }

  _normalizeRole(role) {
    if (!role) return 'batsman';
    const r = role.toLowerCase().trim();
    if (r === 'wk' || r === 'wicketkeeper' || r === 'wicket-keeper') return 'wicket-keeper';
    if (r === 'bat' || r === 'batsman' || r === 'batter') return 'batsman';
    if (r === 'ar' || r === 'all' || r === 'all-rounder' || r === 'allrounder') return 'all-rounder';
    if (r === 'bowl' || r === 'bowler') return 'bowler';
    // Detect role from keywords
    if (r.includes('keep') || r.includes('wk')) return 'wicket-keeper';
    if (r.includes('bat')) return 'batsman';
    if (r.includes('all')) return 'all-rounder';
    if (r.includes('bowl')) return 'bowler';
    return 'batsman';
  }

  async fetchLiveScorecard(apiMatchId) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return this._getMockScorecard(apiMatchId);
    }

    // Rate limit: don't call scorecard API more than once every 2 min per match
    if (!this._checkRateLimit(`scorecard_${apiMatchId}`, 120000)) {
      console.log(`⏳ [API Quota] Skipping live scorecard for ${apiMatchId}`);
      // Return cached scorecard if available
      if (this._mockScorecardCache[apiMatchId]) {
        const cached = this._mockScorecardCache[apiMatchId];
        const { _squads, _generatedAt, ...publicScorecard } = cached;
        return publicScorecard;
      }
      return { status: 'live', players: [] }; // Return empty scorecard structure instead of mock
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/match_scorecard?apikey=${apiKey}&id=${apiMatchId}`);
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.reason || 'Failed to fetch scorecard');
      }

      // Fetch squad from database to map names to player IDs for complex fielders/bowlers in dismissal strings
      let dbPlayersList = [];
      try {
        const [rows] = await pool.query(`
          SELECT p.api_player_id, p.name 
          FROM fantasy_players p
          JOIN fantasy_match_players mp ON p.id = mp.player_id
          JOIN fantasy_matches m ON mp.match_id = m.id
          WHERE m.api_match_id = ?
        `, [apiMatchId]);
        dbPlayersList = rows;
      } catch (dbErr) {
        console.error('Failed to query db players for scorecard parsing:', dbErr);
      }

      const playersMap = new Map();
      const matchStatus = data.data.matchEnded ? 'completed' : (data.data.matchAbandoned ? 'abandoned' : 'live');
      
      if (data.data.scorecard) {
        // First pass: populate bats and bowls
        data.data.scorecard.forEach(innings => {
          if (innings.batting) {
            innings.batting.forEach(b => {
              const batsmanId = String(b.batsman.id);
              if (!playersMap.has(batsmanId)) {
                playersMap.set(batsmanId, {
                  api_player_id: batsmanId,
                  stats: {
                    runs: parseInt(b.r) || 0,
                    boundaries: parseInt(b['4s']) || 0,
                    sixes: parseInt(b['6s']) || 0,
                    is_out: b.dismissal !== 'not out' && b.dismissal !== 'batting',
                    is_duck: parseInt(b.r) === 0 && b.dismissal !== 'not out' && b.dismissal !== 'batting',
                    wickets: 0,
                    catches: 0,
                    dotBalls: 0,
                    maidenOvers: 0,
                    runOuts: 0,
                    stumpings: 0,
                    lbwBowleds: 0,
                    runOutThrowers: 0,
                    runOutCatchers: 0
                  }
                });
              }
            });
          }
          if (innings.bowling) {
            innings.bowling.forEach(b => {
              const bowlerId = String(b.bowler.id);
              const wickets = parseInt(b.w) || 0;
              const maidenOvers = parseInt(b.m) || 0;
              if (playersMap.has(bowlerId)) {
                const existing = playersMap.get(bowlerId);
                existing.stats.wickets = wickets;
                existing.stats.maidenOvers = maidenOvers;
              } else {
                playersMap.set(bowlerId, {
                  api_player_id: bowlerId,
                  stats: {
                    runs: 0, boundaries: 0, sixes: 0, is_out: false, is_duck: false,
                    wickets: wickets, catches: 0, dotBalls: 0, maidenOvers: maidenOvers,
                    runOuts: 0, stumpings: 0, lbwBowleds: 0, runOutThrowers: 0, runOutCatchers: 0
                  }
                });
              }
            });
          }
        });

        // Second pass: parse dismissal text for fielding/bowling bonuses
        data.data.scorecard.forEach(innings => {
          if (innings.batting) {
            innings.batting.forEach(b => {
              const dismissalText = b.dismissal || '';
              if (dismissalText === 'not out' || dismissalText === 'batting' || !dismissalText) {
                return;
              }

              const findPlayerByName = (nameFrag) => {
                if (!nameFrag) return null;
                const cleanFrag = nameFrag.replace(/^(sub|substitute)\s*\(([^)]+)\)/i, '$2').trim().toLowerCase();
                if (!cleanFrag) return null;
                return dbPlayersList.find(p => {
                  const pName = p.name.toLowerCase();
                  return pName.includes(cleanFrag) || cleanFrag.includes(pName);
                });
              };

              const getOrCreatePlayerStats = (playerObj) => {
                if (!playerObj) return null;
                const apiId = String(playerObj.api_player_id);
                if (!playersMap.has(apiId)) {
                  playersMap.set(apiId, {
                    api_player_id: apiId,
                    stats: {
                      runs: 0, boundaries: 0, sixes: 0, is_out: false, is_duck: false,
                      wickets: 0, catches: 0, dotBalls: 0, maidenOvers: 0, runOuts: 0, stumpings: 0,
                      lbwBowleds: 0, runOutThrowers: 0, runOutCatchers: 0
                    }
                  });
                }
                return playersMap.get(apiId).stats;
              };

              // Stumping: "st Fielder b Bowler"
              const stumpingMatch = dismissalText.match(/^st\s+(.+?)\s+b\s+(.+)$/i);
              if (stumpingMatch) {
                const fielder = findPlayerByName(stumpingMatch[1]);
                if (fielder) {
                  const stats = getOrCreatePlayerStats(fielder);
                  if (stats) stats.stumpings = (stats.stumpings || 0) + 1;
                }
                return;
              }

              // Catch: "c Fielder b Bowler" or "c & b Bowler"
              const catchMatch = dismissalText.match(/^c\s+(.+?)\s+b\s+(.+)$/i);
              const catchAndBowledMatch = dismissalText.match(/^c\s+&\s+b\s+(.+)$/i);
              if (catchAndBowledMatch) {
                const bowler = findPlayerByName(catchAndBowledMatch[1]);
                if (bowler) {
                  const stats = getOrCreatePlayerStats(bowler);
                  if (stats) stats.catches = (stats.catches || 0) + 1;
                }
                return;
              } else if (catchMatch) {
                const fielder = findPlayerByName(catchMatch[1]);
                if (fielder) {
                  const stats = getOrCreatePlayerStats(fielder);
                  if (stats) stats.catches = (stats.catches || 0) + 1;
                }
                return;
              }

              // LBW: "lbw b Bowler"
              const lbwMatch = dismissalText.match(/^lbw\s+b\s+(.+)$/i);
              if (lbwMatch) {
                const bowler = findPlayerByName(lbwMatch[1]);
                if (bowler) {
                  const stats = getOrCreatePlayerStats(bowler);
                  if (stats) stats.lbwBowleds = (stats.lbwBowleds || 0) + 1;
                }
                return;
              }

              // Bowled: "bowled b Bowler" or "b Bowler"
              const bowledMatch = dismissalText.match(/^(bowled\s+)?b\s+(.+)$/i);
              if (bowledMatch) {
                const bowler = findPlayerByName(bowledMatch[2]);
                if (bowler) {
                  const stats = getOrCreatePlayerStats(bowler);
                  if (stats) stats.lbwBowleds = (stats.lbwBowleds || 0) + 1;
                }
                return;
              }

              // Run Out: "run out (Fielder)" or "run out (Fielder1/Fielder2)"
              const runOutMatch = dismissalText.match(/^run\s+out\s+\((.+)\)$/i);
              if (runOutMatch) {
                const fieldersStr = runOutMatch[1];
                if (fieldersStr.includes('/')) {
                  const parts = fieldersStr.split('/');
                  const thrower = findPlayerByName(parts[0]);
                  const catcher = findPlayerByName(parts[1]);
                  if (thrower) {
                    const stats = getOrCreatePlayerStats(thrower);
                    if (stats) stats.runOutThrowers = (stats.runOutThrowers || 0) + 1;
                  }
                  if (catcher) {
                    const stats = getOrCreatePlayerStats(catcher);
                    if (stats) stats.runOutCatchers = (stats.runOutCatchers || 0) + 1;
                  }
                } else {
                  // Direct hit
                  const fielder = findPlayerByName(fieldersStr);
                  if (fielder) {
                    const stats = getOrCreatePlayerStats(fielder);
                    if (stats) stats.runOuts = (stats.runOuts || 0) + 1;
                  }
                }
                return;
              }
            });
          }
        });
      }

      const players = Array.from(playersMap.values());
      const result = {
        status: matchStatus,
        winning_team: data.data.matchWinner || null,
        players
      };

      // Cache for fallback
      this._mockScorecardCache[apiMatchId] = result;
      return result;
    } catch (error) {
      console.error('API Error:', error);
      if (this._mockScorecardCache[apiMatchId]) {
        const cached = this._mockScorecardCache[apiMatchId];
        const { _squads, _generatedAt, ...publicScorecard } = cached;
        return publicScorecard;
      }
      return this._getMockScorecard(apiMatchId);
    }
  }

  // --- Mock Data Generators (Deterministic) ---

  _getMockMatches() {
    const now = new Date();
    return [
      {
        api_match_id: 'mock_match_1',
        title: 'Mumbai Indians vs Chennai Super Kings (Demo)',
        short_title: 'MI vs CSK (Demo)',
        subtitle: 'IPL 2026 - Match 1 (Demo)',
        format: 'T20',
        team_a: 'Mumbai Indians',
        team_a_logo: '',
        team_b: 'Chennai Super Kings',
        team_b_logo: '',
        start_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        status: 'upcoming'
      },
      {
        api_match_id: 'mock_match_2',
        title: 'Royal Challengers Bangalore vs Kolkata Knight Riders (Demo)',
        short_title: 'RCB vs KKR (Demo)',
        subtitle: 'IPL 2026 - Match 2 (Demo)',
        format: 'T20',
        team_a: 'Royal Challengers Bangalore',
        team_a_logo: '',
        team_b: 'Kolkata Knight Riders',
        team_b_logo: '',
        start_time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        status: 'upcoming'
      }
    ];
  }

  _getMockSquads(apiMatchId) {
    if (apiMatchId === 'mock_match_1') {
      return [
        { api_player_id: 'mi_1', name: 'Rohit Sharma', team_name: 'MI', role: 'batsman', credit_value: 10.0 },
        { api_player_id: 'mi_2', name: 'Suryakumar Yadav', team_name: 'MI', role: 'batsman', credit_value: 9.5 },
        { api_player_id: 'mi_3', name: 'Ishan Kishan', team_name: 'MI', role: 'wicket-keeper', credit_value: 8.5 },
        { api_player_id: 'mi_4', name: 'Hardik Pandya', team_name: 'MI', role: 'all-rounder', credit_value: 9.0 },
        { api_player_id: 'mi_5', name: 'Jasprit Bumrah', team_name: 'MI', role: 'bowler', credit_value: 9.5 },
        { api_player_id: 'mi_6', name: 'Tim David', team_name: 'MI', role: 'batsman', credit_value: 8.0 },
        { api_player_id: 'mi_7', name: 'Piyush Chawla', team_name: 'MI', role: 'bowler', credit_value: 8.0 },
        { api_player_id: 'mi_8', name: 'Tilak Varma', team_name: 'MI', role: 'batsman', credit_value: 8.5 },
        { api_player_id: 'mi_9', name: 'Nuwan Thushara', team_name: 'MI', role: 'bowler', credit_value: 8.0 },
        { api_player_id: 'mi_10', name: 'Romario Shepherd', team_name: 'MI', role: 'all-rounder', credit_value: 8.0 },
        { api_player_id: 'mi_11', name: 'Akash Madhwal', team_name: 'MI', role: 'bowler', credit_value: 7.5 },
        { api_player_id: 'csk_1', name: 'MS Dhoni', team_name: 'CSK', role: 'wicket-keeper', credit_value: 9.0 },
        { api_player_id: 'csk_2', name: 'Ruturaj Gaikwad', team_name: 'CSK', role: 'batsman', credit_value: 9.5 },
        { api_player_id: 'csk_3', name: 'Ravindra Jadeja', team_name: 'CSK', role: 'all-rounder', credit_value: 9.5 },
        { api_player_id: 'csk_4', name: 'Shivam Dube', team_name: 'CSK', role: 'all-rounder', credit_value: 8.5 },
        { api_player_id: 'csk_5', name: 'Ajinkya Rahane', team_name: 'CSK', role: 'batsman', credit_value: 8.0 },
        { api_player_id: 'csk_6', name: 'Matheesha Pathirana', team_name: 'CSK', role: 'bowler', credit_value: 9.0 },
        { api_player_id: 'csk_7', name: 'Deepak Chahar', team_name: 'CSK', role: 'bowler', credit_value: 8.5 },
        { api_player_id: 'csk_8', name: 'Mustafizur Rahman', team_name: 'CSK', role: 'bowler', credit_value: 8.5 },
        { api_player_id: 'csk_9', name: 'Daryl Mitchell', team_name: 'CSK', role: 'batsman', credit_value: 8.5 },
        { api_player_id: 'csk_10', name: 'Tushar Deshpande', team_name: 'CSK', role: 'bowler', credit_value: 8.0 },
        { api_player_id: 'csk_11', name: 'Rachin Ravindra', team_name: 'CSK', role: 'all-rounder', credit_value: 8.5 },
      ];
    }
    const firstNames = ['Virat', 'Smriti', 'Rahul', 'Harmanpreet', 'Ben', 'Meg', 'Pat', 'Ellyse', 'Kane', 'Babar', 'Shaheen', 'Rashid', 'Shakib', 'Kagiso', 'Quinton', 'David', 'Sophie', 'Mithali', 'Sachin', 'Alyssa', 'Nat', 'Suzie'];
    const lastNames = ['Kohli', 'Mandhana', 'Dravid', 'Kaur', 'Stokes', 'Lanning', 'Cummins', 'Perry', 'Williamson', 'Azam', 'Afridi', 'Khan', 'Al Hasan', 'Rabada', 'de Kock', 'Warner', 'Devine', 'Raj', 'Tendulkar', 'Healy', 'Sciver', 'Bates'];
    
    // Simple deterministic hash based on matchId
    let hash = 0;
    for (let i = 0; i < apiMatchId.length; i++) hash = apiMatchId.charCodeAt(i) + ((hash << 5) - hash);
    hash = Math.abs(hash);

    const squad = [];
    for (let i = 1; i <= 11; i++) {
      const fName = firstNames[(hash + i * 2) % firstNames.length];
      const lName = lastNames[(hash + i * 3) % lastNames.length];
      squad.push({ 
        api_player_id: `teamA_${i}_${apiMatchId}`, 
        name: `${fName} ${lName}`, 
        team_name: 'Team A', 
        role: i === 1 ? 'wicket-keeper' : i < 6 ? 'batsman' : i < 8 ? 'all-rounder' : 'bowler', 
        credit_value: 8.0 + ((hash + i) % 3) * 0.5 
      });
    }
    for (let i = 1; i <= 11; i++) {
      const fName = firstNames[(hash + i * 5 + 1) % firstNames.length];
      const lName = lastNames[(hash + i * 7 + 1) % lastNames.length];
      squad.push({ 
        api_player_id: `teamB_${i}_${apiMatchId}`, 
        name: `${fName} ${lName}`, 
        team_name: 'Team B', 
        role: i === 1 ? 'wicket-keeper' : i < 6 ? 'batsman' : i < 8 ? 'all-rounder' : 'bowler', 
        credit_value: 8.0 + ((hash + i + 1) % 3) * 0.5 
      });
    }
    return squad;
  }

  _getMockScorecard(apiMatchId) {
    // Return deterministic mock scorecard that doesn't change every tick
    if (this._mockScorecardCache[apiMatchId]) {
      // Check if we should mark as completed (after ~10 min of being "live")
      const cached = this._mockScorecardCache[apiMatchId];
      if (cached.status === 'live') {
        const elapsed = Date.now() - (cached._generatedAt || Date.now());
        if (elapsed > 600000) { // 10 minutes
          cached.status = 'completed';
          cached.winning_team = cached._squads[0]?.team_name || 'MI';
        }
      }
      const { _squads, _generatedAt, ...publicScorecard } = cached;
      return publicScorecard;
    }

    // Generate fresh deterministic scorecard (stable for the match duration)
    const squads = this._getMockSquads(apiMatchId);
    const players = squads.map((p, idx) => {
      // Use index to generate deterministic-ish stats
      const seed = (idx * 7 + 13) % 50;
      return {
        api_player_id: p.api_player_id,
        stats: {
          runs: Math.floor(seed * 1.3),
          boundaries: Math.floor(seed / 10),
          sixes: Math.floor(seed / 20),
          wickets: idx % 5 === 0 ? Math.floor(seed / 8) : 0,
          catches: idx % 3 === 0 ? Math.floor(seed / 15) : 0,
          is_out: seed > 25,
          is_duck: seed < 5,
          dotBalls: 0,
          maidenOvers: idx % 6 === 0 ? Math.floor(seed / 12) : 0,
          runOuts: idx % 7 === 0 ? 1 : 0,
          stumpings: idx % 8 === 0 ? 1 : 0,
          lbwBowleds: idx % 5 === 0 ? Math.floor(seed / 10) : 0,
          runOutThrowers: idx % 9 === 0 ? 1 : 0,
          runOutCatchers: idx % 10 === 0 ? 1 : 0
        }
      };
    });

    const scorecard = {
      status: 'live',
      winning_team: null,
      players,
      _squads: squads,
      _generatedAt: Date.now()
    };

    this._mockScorecardCache[apiMatchId] = scorecard;
    
    const { _squads, _generatedAt, ...publicScorecard } = scorecard;
    return publicScorecard;
  }

}

module.exports = new FantasyApiService();
