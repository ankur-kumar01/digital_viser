/**
 * Fantasy Cricket API Service
 * Handles fetching real-world data (matches, squads, scorecards).
 * Includes a Mock Mode so we can develop the entire app without a real API key.
 */
const { pool } = require('../db');

class FantasyApiService {
  constructor() {
    this.useMock = true; // Set to true to use mock data instead of real API
    this.apiKey = process.env.CRICKET_API_KEY || ''; // e.g., CricAPI or Sportmonks
    this.baseUrl = 'https://api.cricapi.com/v1'; 
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

  // --- API Abstraction Layer ---

  async fetchUpcomingMatches() {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      console.log('No API key found, using mock matches');
      return this._getMockMatches();
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/currentMatches?apikey=${apiKey}&offset=0`);
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.reason || 'Failed to fetch matches');
      }

      // Map CricAPI matches to our DB format
      return data.data.map(m => ({
        api_match_id: m.id,
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
      return this._getMockMatches(); // Fallback
    }
  }

  async fetchMatchSquads(apiMatchId) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
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
          players.push({
            api_player_id: p.id,
            name: p.name,
            team_name: team.teamName,
            role: p.role ? p.role.toLowerCase() : 'batsman',
            credit_value: 8.5 // CricAPI doesn't provide credits, mock default
          });
        });
      });
      return players;
    } catch (error) {
      console.error('API Error:', error);
      return this._getMockSquads(apiMatchId); // Fallback
    }
  }

  async fetchLiveScorecard(apiMatchId) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return this._getMockScorecard(apiMatchId);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/match_scorecard?apikey=${apiKey}&id=${apiMatchId}`);
      const data = await response.json();
      
      if (data.status !== 'success') {
        throw new Error(data.reason || 'Failed to fetch scorecard');
      }

      // Very simplified extraction of player stats from CricAPI scorecard
      const players = [];
      const matchStatus = data.data.matchEnded ? 'completed' : 'live';
      
      if (data.data.scorecard) {
        data.data.scorecard.forEach(innings => {
          if (innings.batting) {
            innings.batting.forEach(b => {
              players.push({
                api_player_id: b.batsman.id,
                stats: {
                  runs: parseInt(b.r) || 0,
                  boundaries: parseInt(b['4s']) || 0,
                  sixes: parseInt(b['6s']) || 0,
                  is_out: b.dismissal !== 'not out',
                  is_duck: parseInt(b.r) === 0 && b.dismissal !== 'not out',
                  wickets: 0, catches: 0 // Will override below if they bowled
                }
              });
            });
          }
          if (innings.bowling) {
            innings.bowling.forEach(b => {
              const existing = players.find(p => p.api_player_id === b.bowler.id);
              if (existing) {
                existing.stats.wickets = parseInt(b.w) || 0;
              } else {
                players.push({
                  api_player_id: b.bowler.id,
                  stats: { runs: 0, boundaries: 0, sixes: 0, is_out: false, is_duck: false, wickets: parseInt(b.w) || 0, catches: 0 }
                });
              }
            });
          }
        });
      }

      return {
        status: matchStatus,
        winning_team: data.data.matchWinner || null,
        players
      };
    } catch (error) {
      console.error('API Error:', error);
      return this._getMockScorecard(apiMatchId); // Fallback
    }
  }

  // --- Mock Data Generators (For Development) ---

  _getMockMatches() {
    // Return 3 mock IPL matches
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
        start_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // Starts in 2 hours
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
        start_time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Starts tomorrow
        status: 'upcoming'
      }
    ];
  }

  _getMockSquads(apiMatchId) {
    if (apiMatchId === 'mock_match_1') {
      return [
        // MI Players
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
        
        // CSK Players
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
    
    // Fallback generic squad for other matches
    const squad = [];
    for (let i=1; i<=11; i++) squad.push({ api_player_id: `teamA_\${i}`, name: `Team A Player \${i}`, team_name: 'Team A', role: i === 1 ? 'wicket-keeper' : i < 6 ? 'batsman' : i < 8 ? 'all-rounder' : 'bowler', credit_value: 8.0 });
    for (let i=1; i<=11; i++) squad.push({ api_player_id: `teamB_\${i}`, name: `Team B Player \${i}`, team_name: 'Team B', role: i === 1 ? 'wicket-keeper' : i < 6 ? 'batsman' : i < 8 ? 'all-rounder' : 'bowler', credit_value: 8.0 });
    return squad;
  }

  _getMockScorecard(apiMatchId) {
    // Generate random stats for live points
    const players = this._getMockSquads(apiMatchId).map(p => {
      return {
        api_player_id: p.api_player_id,
        stats: {
          runs: Math.floor(Math.random() * 50),
          boundaries: Math.floor(Math.random() * 5),
          sixes: Math.floor(Math.random() * 3),
          wickets: Math.floor(Math.random() * 3),
          catches: Math.floor(Math.random() * 2),
          is_out: Math.random() > 0.5,
          is_duck: false // Simplified for mock
        }
      };
    });

    return {
      status: Math.random() > 0.9 ? 'completed' : 'live', // 10% chance to finish in a tick
      winning_team: Math.random() > 0.5 ? 'MI' : 'CSK',
      players
    };
  }

}

module.exports = new FantasyApiService();
