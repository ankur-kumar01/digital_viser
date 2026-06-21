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
      console.error('API Error:', error);
      return this._getMockMatches();
    }
  }

  async fetchMatchSquads(apiMatchId) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return this._getMockSquads(apiMatchId);
    }

    // Rate limit: don't call squad API more than once every 15 min per match
    if (!this._checkRateLimit(`squad_${apiMatchId}`, 900000)) {
      console.log(`⏳ [API Quota] Skipping squad sync for ${apiMatchId}`);
      return this._getMockSquads(apiMatchId);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/match_squad?apikey=${apiKey}&id=${apiMatchId}`);
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.reason || 'Failed to fetch squads');
      }

      const players = [];
      data.data.forEach(team => {
        team.players.forEach(p => {
          // Assign credit values based on role for sensible team building
          let credit = 8.0;
          if (p.role) {
            const role = p.role.toLowerCase();
            if (role.includes('captain') || role.includes('wk')) credit = 9.5;
            else if (role.includes('bat')) credit = 8.5;
            else if (role.includes('all')) credit = 9.0;
            else if (role.includes('bowl')) credit = 8.0;
          }
          players.push({
            api_player_id: String(p.id),
            name: p.name,
            team_name: team.teamName,
            role: p.role ? p.role.toLowerCase().replace(/^wk$/i, 'wicket-keeper').replace(/^bowler$/i, 'bowler').replace(/^batsman$/i, 'batsman').replace(/^all-rounder$/i, 'all-rounder') : 'batsman',
            credit_value: Math.round(credit * 10) / 10
          });
        });
      });
      return players;
    } catch (error) {
      console.error('API Error:', error);
      return this._getMockSquads(apiMatchId);
    }
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
        return this._mockScorecardCache[apiMatchId];
      }
      return this._getMockScorecard(apiMatchId);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/match_scorecard?apikey=${apiKey}&id=${apiMatchId}`);
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.reason || 'Failed to fetch scorecard');
      }

      const players = [];
      const matchStatus = data.data.matchEnded ? 'completed' : (data.data.matchAbandoned ? 'abandoned' : 'live');
      
      if (data.data.scorecard) {
        data.data.scorecard.forEach(innings => {
          if (innings.batting) {
            innings.batting.forEach(b => {
              const existingIdx = players.findIndex(p => p.api_player_id === String(b.batsman.id));
              if (existingIdx === -1) {
                players.push({
                  api_player_id: String(b.batsman.id),
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
                    stumpings: 0
                  }
                });
              }
            });
          }
          if (innings.bowling) {
            innings.bowling.forEach(b => {
              const existing = players.find(p => p.api_player_id === String(b.bowler.id));
              if (existing) {
                existing.stats.wickets = parseInt(b.w) || 0;
              } else {
                players.push({
                  api_player_id: String(b.bowler.id),
                  stats: { runs: 0, boundaries: 0, sixes: 0, is_out: false, is_duck: false, wickets: parseInt(b.w) || 0, catches: 0, dotBalls: 0, maidenOvers: 0, runOuts: 0, stumpings: 0 }
                });
              }
            });
          }
        });
      }

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
        return this._mockScorecardCache[apiMatchId];
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
        title: 'Mumbai Indians vs Chennai Super Kings',
        short_title: 'MI vs CSK',
        subtitle: 'IPL 2026 - Match 1',
        format: 'T20',
        team_a: 'Mumbai Indians',
        team_a_logo: 'https://via.placeholder.com/100/004ba0/ffffff?text=MI',
        team_b: 'Chennai Super Kings',
        team_b_logo: 'https://via.placeholder.com/100/ffff00/000000?text=CSK',
        start_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        status: 'upcoming'
      },
      {
        api_match_id: 'mock_match_2',
        title: 'Royal Challengers Bangalore vs Kolkata Knight Riders',
        short_title: 'RCB vs KKR',
        subtitle: 'IPL 2026 - Match 2',
        format: 'T20',
        team_a: 'Royal Challengers Bangalore',
        team_a_logo: 'https://via.placeholder.com/100/ec1c24/ffffff?text=RCB',
        team_b: 'Kolkata Knight Riders',
        team_b_logo: 'https://via.placeholder.com/100/3a225d/ffffff?text=KKR',
        start_time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
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
    
    const squad = [];
    for (let i = 1; i <= 11; i++) {
      squad.push({ api_player_id: `teamA_${i}`, name: `Team A Player ${i}`, team_name: 'Team A', role: i === 1 ? 'wicket-keeper' : i < 6 ? 'batsman' : i < 8 ? 'all-rounder' : 'bowler', credit_value: 8.0 });
    }
    for (let i = 1; i <= 11; i++) {
      squad.push({ api_player_id: `teamB_${i}`, name: `Team B Player ${i}`, team_name: 'Team B', role: i === 1 ? 'wicket-keeper' : i < 6 ? 'batsman' : i < 8 ? 'all-rounder' : 'bowler', credit_value: 8.0 });
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
      return cached;
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
          maidenOvers: 0,
          runOuts: 0,
          stumpings: 0
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
    return scorecard;
  }

}

module.exports = new FantasyApiService();
