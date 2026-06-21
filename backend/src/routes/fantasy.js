const express = require('express');
const { pool } = require('../db');
const router = express.Router();
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Auth middleware (defence in depth)
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 1. Get Matches (supports multiple statuses comma-separated: 'upcoming, live')
router.get('/matches', async (req, res) => {
  try {
    const statusParam = req.query.status || 'upcoming';
    let matches;
    if (statusParam.includes(',')) {
      const statuses = statusParam.split(',').map(s => s.trim());
      const placeholders = statuses.map(() => '?').join(',');
      matches = await pool.query(`SELECT * FROM fantasy_matches WHERE status IN (${placeholders}) ORDER BY start_time ASC`, statuses);
    } else {
      const [rows] = await pool.query('SELECT * FROM fantasy_matches WHERE status = ? ORDER BY start_time ASC', [statusParam]);
      matches = rows;
    }
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Match Details & Squad (only playing players)
router.get('/match/:id/squad', async (req, res) => {
  try {
    const [matches] = await pool.query('SELECT * FROM fantasy_matches WHERE id = ?', [req.params.id]);
    if (matches.length === 0) return res.status(404).json({ error: 'Match not found' });

    let [players] = await pool.query(`
      SELECT p.*, mp.points, mp.stats_json, mp.is_playing 
      FROM fantasy_players p
      JOIN fantasy_match_players mp ON p.id = mp.player_id
      WHERE mp.match_id = ? AND mp.is_playing = true
    `, [req.params.id]);

    // If we have real players from the API, hide the mock fallback players
    const realPlayers = players.filter(p => !p.api_player_id.startsWith('teamA_') && !p.api_player_id.startsWith('teamB_') && !p.api_player_id.includes('_mock_match_'));
    if (realPlayers.length > 0) {
      players = realPlayers;
    }

    res.json({ match: matches[0], players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Contests for Match
router.get('/match/:id/contests', async (req, res) => {
  try {
    const [contests] = await pool.query('SELECT * FROM fantasy_contests WHERE match_id = ? ORDER BY prize_pool DESC, entry_fee ASC', [req.params.id]);
    res.json(contests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create Team
router.post('/team', async (req, res) => {
  const { matchId, playerIds, captainId, viceCaptainId } = req.body;
  const userId = req.user.userId;

  if (!matchId || !playerIds || playerIds.length !== 11 || !captainId || !viceCaptainId) {
    return res.status(400).json({ error: 'Invalid team data. Must select 11 players, captain, and vice-captain.' });
  }

  // Validate captain/VC are in selected players
  if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
    return res.status(400).json({ error: 'Captain and Vice-Captain must be among the selected 11 players.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check match is still upcoming
    const [matchRows] = await conn.query('SELECT status FROM fantasy_matches WHERE id = ?', [matchId]);
    if (matchRows.length === 0) throw new Error('Match not found');
    if (matchRows[0].status !== 'upcoming') throw new Error('Match is no longer accepting team creations');

    // Validate players belong to this match, are playing, and get credit values
    const [players] = await conn.query(`
      SELECT p.id, p.credit_value, p.role, p.team_name
      FROM fantasy_players p
      JOIN fantasy_match_players mp ON p.id = mp.player_id
      WHERE p.id IN (?) AND mp.match_id = ? AND mp.is_playing = true
    `, [playerIds, matchId]);
    
    if (players.length !== 11) throw new Error('Some selected players do not exist, are not playing, or do not belong to this match.');

    let totalCredits = 0;
    let roles = { batsman: 0, bowler: 0, 'all-rounder': 0, 'wicket-keeper': 0 };
    let teams = {};

    players.forEach(p => {
      totalCredits += parseFloat(p.credit_value);
      roles[p.role] = (roles[p.role] || 0) + 1;
      teams[p.team_name] = (teams[p.team_name] || 0) + 1;
    });

    if (totalCredits > 100) throw new Error(`Credit limit exceeded (${totalCredits}/100)`);
    if (roles['wicket-keeper'] < 1 || roles['wicket-keeper'] > 4) throw new Error('Must select 1-4 Wicket Keepers');
    if (roles['batsman'] < 3 || roles['batsman'] > 6) throw new Error('Must select 3-6 Batsmen');
    if (roles['all-rounder'] < 1 || roles['all-rounder'] > 4) throw new Error('Must select 1-4 All-Rounders');
    if (roles['bowler'] < 3 || roles['bowler'] > 6) throw new Error('Must select 3-6 Bowlers');
    
    for (const teamCount of Object.values(teams)) {
      if (teamCount > 7) throw new Error('Max 7 players allowed from a single team');
    }

    // Check team limit per user per match (max 6)
    const [existingTeams] = await conn.query(
      'SELECT COUNT(*) as cnt FROM fantasy_user_teams WHERE user_id = ? AND match_id = ?',
      [userId, matchId]
    );
    if (existingTeams[0].cnt >= 6) throw new Error('Maximum 6 teams allowed per match');

    // Insert Team
    const [teamRes] = await conn.query(`
      INSERT INTO fantasy_user_teams (user_id, match_id, captain_player_id, vice_captain_player_id)
      VALUES (?, ?, ?, ?)
    `, [userId, matchId, captainId, viceCaptainId]);

    const teamId = teamRes.insertId;

    // Insert Players
    const teamPlayers = playerIds.map(pid => [teamId, pid]);
    await conn.query('INSERT INTO fantasy_team_players (team_id, player_id) VALUES ?', [teamPlayers]);

    await conn.commit();
    res.json({ success: true, teamId, message: 'Team created successfully!' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 5. Get User's Teams for a Match
router.get('/match/:id/my-teams', async (req, res) => {
  try {
    const [teams] = await pool.query(
      'SELECT * FROM fantasy_user_teams WHERE user_id = ? AND match_id = ? ORDER BY total_points DESC',
      [req.user.userId, req.params.id]
    );
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Edit Team (captain/VC only, can't change players once match is live)
router.put('/team/:id', async (req, res) => {
  const { captainId, viceCaptainId } = req.body;
  const userId = req.user.userId;
  const teamId = req.params.id;

  if (!captainId || !viceCaptainId) {
    return res.status(400).json({ error: 'Captain and Vice-Captain are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [teams] = await conn.query(
      'SELECT * FROM fantasy_user_teams WHERE id = ? AND user_id = ? FOR UPDATE',
      [teamId, userId]
    );
    if (teams.length === 0) throw new Error('Team not found or does not belong to you');

    const team = teams[0];

    // Check match is still upcoming or live (can edit C/VC during live)
    const [matchRows] = await conn.query('SELECT status FROM fantasy_matches WHERE id = ?', [team.match_id]);
    if (matchRows.length === 0) throw new Error('Match not found');
    if (matchRows[0].status === 'completed') throw new Error('Cannot edit team for a completed match');

    // Verify captain/VC are in the team's players
    const [teamPlayers] = await conn.query(
      'SELECT player_id FROM fantasy_team_players WHERE team_id = ?',
      [teamId]
    );
    const playerIds = teamPlayers.map(tp => tp.player_id);
    if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
      throw new Error('Captain and Vice-Captain must be among your selected players.');
    }

    await conn.query(
      'UPDATE fantasy_user_teams SET captain_player_id = ?, vice_captain_player_id = ? WHERE id = ?',
      [captainId, viceCaptainId, teamId]
    );

    await conn.commit();
    res.json({ success: true, message: 'Team updated successfully!' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 7. Delete Team
router.delete('/team/:id', async (req, res) => {
  const userId = req.user.userId;
  const teamId = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [teams] = await conn.query(
      'SELECT * FROM fantasy_user_teams WHERE id = ? AND user_id = ? FOR UPDATE',
      [teamId, userId]
    );
    if (teams.length === 0) throw new Error('Team not found or does not belong to you');

    // Check team isn't entered in any contest
    const [entries] = await conn.query(
      'SELECT id FROM fantasy_contest_entries WHERE team_id = ? LIMIT 1',
      [teamId]
    );
    if (entries.length > 0) throw new Error('Cannot delete a team that has joined a contest');

    await conn.query('DELETE FROM fantasy_team_players WHERE team_id = ?', [teamId]);
    await conn.query('DELETE FROM fantasy_user_teams WHERE id = ?', [teamId]);

    await conn.commit();
    res.json({ success: true, message: 'Team deleted successfully!' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 8. Join Contest
router.post('/contest/join', async (req, res) => {
  const { contestId, teamId } = req.body;
  const userId = req.user.userId;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch contest
    const [contests] = await conn.query('SELECT * FROM fantasy_contests WHERE id = ? FOR UPDATE', [contestId]);
    if (contests.length === 0) throw new Error('Contest not found');
    const contest = contests[0];

    if (contest.status !== 'open') throw new Error('Contest is closed');
    if (contest.filled_spots >= contest.total_spots) throw new Error('Contest is full');

    // Verify team belongs to user AND belongs to the same match as the contest
    const [teams] = await conn.query(
      'SELECT * FROM fantasy_user_teams WHERE id = ? AND user_id = ?',
      [teamId, userId]
    );
    if (teams.length === 0) throw new Error('Team not found or does not belong to you');

    const team = teams[0];
    if (team.match_id !== contest.match_id) {
      throw new Error('Team does not belong to the same match as this contest');
    }

    // Check if user already joined
    const [entries] = await conn.query(
      'SELECT id FROM fantasy_contest_entries WHERE user_id = ? AND contest_id = ?',
      [userId, contestId]
    );
    if (entries.length > 0) throw new Error('You have already joined this contest');

    // Check per-user entry limit for this contest
    const [existingEntries] = await conn.query(
      'SELECT COUNT(*) as cnt FROM fantasy_contest_entries WHERE user_id = ? AND contest_id = ?',
      [userId, contestId]
    );
    const maxEntries = contest.max_entries_per_user || 1;
    if (existingEntries[0].cnt >= maxEntries) {
      throw new Error(`Maximum ${maxEntries} entries allowed per user in this contest`);
    }

    // Check balance
    const [wallets] = await conn.query('SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]);
    const balance = parseFloat(wallets[0].balance);
    const fee = parseFloat(contest.entry_fee);

    if (balance < fee) throw new Error('Insufficient wallet balance');

    // Deduct fee
    await conn.query('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [fee, userId]);
    
    // Log transaction
    await conn.query(`
      INSERT INTO transactions (user_id, amount, type, description, status) 
      VALUES (?, ?, 'game_bet', ?, 'completed')
    `, [userId, fee, `Joined Fantasy Contest #${contestId}`]);

    // Add entry
    await conn.query(`
      INSERT INTO fantasy_contest_entries (user_id, contest_id, team_id, fee_paid)
      VALUES (?, ?, ?, ?)
    `, [userId, contestId, teamId, fee]);

    // Update filled spots
    await conn.query('UPDATE fantasy_contests SET filled_spots = filled_spots + 1 WHERE id = ?', [contestId]);

    // Auto-close if full
    if (contest.filled_spots + 1 >= contest.total_spots) {
      await conn.query('UPDATE fantasy_contests SET status = "closed" WHERE id = ?', [contestId]);
    }

    await conn.commit();
    res.json({ success: true, message: 'Joined contest successfully!', newBalance: balance - fee });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 9. Get Contest Leaderboard (returns per-contest rank)
router.get('/contest/:id/leaderboard', async (req, res) => {
  try {
    // Rank entries within this contest only
    const [entries] = await pool.query(`
      SELECT ce.id, u.name, ut.total_points,
        ROW_NUMBER() OVER (ORDER BY ut.total_points DESC) as team_rank,
        ce.prize_won
      FROM fantasy_contest_entries ce
      JOIN users u ON ce.user_id = u.id
      JOIN fantasy_user_teams ut ON ce.team_id = ut.id
      WHERE ce.contest_id = ?
      ORDER BY ut.total_points DESC
    `, [req.params.id]);

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Get User's Contest Entries (prize history)
router.get('/my-entries', async (req, res) => {
  try {
    const [entries] = await pool.query(`
      SELECT ce.*, c.name as contest_name, m.title as match_title, ut.total_points
      FROM fantasy_contest_entries ce
      JOIN fantasy_contests c ON ce.contest_id = c.id
      JOIN fantasy_matches m ON c.match_id = m.id
      JOIN fantasy_user_teams ut ON ce.team_id = ut.id
      WHERE ce.user_id = ?
      ORDER BY ce.id DESC
    `, [req.user.userId]);

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
