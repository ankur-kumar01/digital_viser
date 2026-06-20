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

  // --- API Abstraction Layer ---

  async fetchUpcomingMatches() {
    if (this.useMock) {
      return this._getMockMatches();
    }
    // TODO: Implement real API call (e.g., fetch(this.baseUrl + '/matches...'))
    return [];
  }

  async fetchMatchSquads(apiMatchId) {
    if (this.useMock) {
      return this._getMockSquads(apiMatchId);
    }
    // TODO: Implement real API call
    return [];
  }

  async fetchLiveScorecard(apiMatchId) {
    if (this.useMock) {
      return this._getMockScorecard(apiMatchId);
    }
    // TODO: Implement real API call
    return { players: [] };
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
