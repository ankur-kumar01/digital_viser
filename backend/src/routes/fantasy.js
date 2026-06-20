const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// 1. Get Matches
router.get('/matches', async (req, res) => {
  try {
    const status = req.query.status || 'upcoming';
    const [matches] = await pool.query('SELECT * FROM fantasy_matches WHERE status = ? ORDER BY start_time ASC', [status]);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Match Details & Squad
router.get('/match/:id/squad', async (req, res) => {
  try {
    const [matches] = await pool.query('SELECT * FROM fantasy_matches WHERE id = ?', [req.params.id]);
    if (matches.length === 0) return res.status(404).json({ error: 'Match not found' });

    const [players] = await pool.query(`
      SELECT p.*, mp.points, mp.stats_json, mp.is_playing 
      FROM fantasy_players p
      JOIN fantasy_match_players mp ON p.id = mp.player_id
      WHERE mp.match_id = ?
    `, [req.params.id]);

    res.json({ match: matches[0], players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Contests for Match
router.get('/match/:id/contests', async (req, res) => {
  try {
    const [contests] = await pool.query('SELECT * FROM fantasy_contests WHERE match_id = ?', [req.params.id]);
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validate 100 Credits max
    const [players] = await conn.query('SELECT id, credit_value, role, team_name FROM fantasy_players WHERE id IN (?)', [playerIds]);
    
    if (players.length !== 11) throw new Error('Some selected players do not exist.');

    let totalCredits = 0;
    let roles = { batsman: 0, bowler: 0, 'all-rounder': 0, 'wicket-keeper': 0 };
    let teams = {};

    players.forEach(p => {
      totalCredits += parseFloat(p.credit_value);
      roles[p.role] = (roles[p.role] || 0) + 1;
      teams[p.team_name] = (teams[p.team_name] || 0) + 1;
    });

    if (totalCredits > 100) throw new Error(`Credit limit exceeded (\${totalCredits}/100)`);
    if (roles['wicket-keeper'] < 1 || roles['wicket-keeper'] > 4) throw new Error('Must select 1-4 Wicket Keepers');
    if (roles['batsman'] < 3 || roles['batsman'] > 6) throw new Error('Must select 3-6 Batsmen');
    if (roles['all-rounder'] < 1 || roles['all-rounder'] > 4) throw new Error('Must select 1-4 All-Rounders');
    if (roles['bowler'] < 3 || roles['bowler'] > 6) throw new Error('Must select 3-6 Bowlers');
    
    for (const teamCount of Object.values(teams)) {
      if (teamCount > 7) throw new Error('Max 7 players allowed from a single team');
    }

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
    const [teams] = await pool.query('SELECT * FROM fantasy_user_teams WHERE user_id = ? AND match_id = ?', [req.user.userId, req.params.id]);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Join Contest
router.post('/contest/join', async (req, res) => {
  const { contestId, teamId } = req.body;
  const userId = req.user.userId;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [contests] = await conn.query('SELECT * FROM fantasy_contests WHERE id = ? FOR UPDATE', [contestId]);
    if (contests.length === 0) throw new Error('Contest not found');
    const contest = contests[0];

    if (contest.status !== 'open') throw new Error('Contest is closed');
    if (contest.filled_spots >= contest.total_spots) throw new Error('Contest is full');

    // Check if user already joined
    const [entries] = await conn.query('SELECT id FROM fantasy_contest_entries WHERE user_id = ? AND contest_id = ?', [userId, contestId]);
    if (entries.length > 0) throw new Error('You have already joined this contest');

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
    `, [userId, fee, `Joined Fantasy Contest #\${contestId}`]);

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

// 7. Get My Contest Leaderboard
router.get('/contest/:id/leaderboard', async (req, res) => {
  try {
    const [entries] = await pool.query(`
      SELECT ce.id, u.name, ut.total_points, ut.team_rank
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

module.exports = router;
