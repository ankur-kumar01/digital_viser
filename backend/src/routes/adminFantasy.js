const express = require('express');
const { pool } = require('../db');
const router = express.Router();
const fantasyCricketCron = require('../cron/fantasyCricketCron');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;

const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(adminAuth);

// === MATCHES ===

// 1. Get all matches
router.get('/matches', async (req, res) => {
  try {
    const [matches] = await pool.query('SELECT * FROM fantasy_matches ORDER BY start_time DESC');
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create a match manually
router.post('/matches', async (req, res) => {
  const { api_match_id, title, short_title, subtitle, format, team_a, team_a_logo, team_b, team_b_logo, start_time, status } = req.body;
  if (!title || !team_a || !team_b || !start_time) {
    return res.status(400).json({ error: 'Title, teams, and start time are required' });
  }
  try {
    const [result] = await pool.query(`
      INSERT INTO fantasy_matches (api_match_id, title, short_title, subtitle, format, team_a, team_a_logo, team_b, team_b_logo, start_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      api_match_id || `manual_${Date.now()}`,
      title, short_title || title,
      subtitle || 'Manual Entry',
      format || 'T20',
      team_a, team_a_logo || '',
      team_b, team_b_logo || '',
      start_time, status || 'upcoming'
    ]);
    res.json({ success: true, id: result.insertId, message: 'Match created successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update a match
router.put('/matches/:id', async (req, res) => {
  const { title, short_title, subtitle, format, team_a, team_a_logo, team_b, team_b_logo, start_time, status } = req.body;
  try {
    await pool.query(`
      UPDATE fantasy_matches SET title=?, short_title=?, subtitle=?, format=?, team_a=?, team_a_logo=?, team_b=?, team_b_logo=?, start_time=?, status=?
      WHERE id=?
    `, [title, short_title, subtitle, format, team_a, team_a_logo, team_b, team_b_logo, start_time, status, req.params.id]);
    res.json({ success: true, message: 'Match updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete a match
router.delete('/matches/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM fantasy_contest_entries WHERE contest_id IN (SELECT id FROM fantasy_contests WHERE match_id = ?)', [req.params.id]);
    await conn.query('DELETE FROM fantasy_contests WHERE match_id = ?', [req.params.id]);
    await conn.query('DELETE FROM fantasy_team_players WHERE team_id IN (SELECT id FROM fantasy_user_teams WHERE match_id = ?)', [req.params.id]);
    await conn.query('DELETE FROM fantasy_user_teams WHERE match_id = ?', [req.params.id]);
    await conn.query('DELETE FROM fantasy_match_players WHERE match_id = ?', [req.params.id]);
    await conn.query('DELETE FROM fantasy_matches WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'Match and all related data deleted.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 5. Update Match Status (Admin override)
router.put('/matches/:id/status', async (req, res) => {
  try {
    await pool.query('UPDATE fantasy_matches SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ success: true, message: `Match status updated to '${req.body.status}'` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Trigger Sync Matches
router.post('/sync-matches', async (req, res) => {
  try {
    await fantasyCricketCron.syncUpcomingMatches();
    res.json({ success: true, message: 'Matches synced successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Trigger Sync Squads (force = true bypasses rate limiting for manual action)
router.post('/sync-squads', async (req, res) => {
  try {
    await fantasyCricketCron.syncSquads(true);
    res.json({ success: true, message: 'Squads synced successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Force Process Live Match
router.post('/process-live', async (req, res) => {
  try {
    await fantasyCricketCron.processLiveMatches();
    res.json({ success: true, message: 'Live matches processed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// === CONTESTS ===

// 9. Get Contests
router.get('/contests', async (req, res) => {
  try {
    const [contests] = await pool.query(`
      SELECT c.*, m.title as match_title 
      FROM fantasy_contests c 
      JOIN fantasy_matches m ON c.match_id = m.id 
      ORDER BY c.created_at DESC
    `);
    res.json(contests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Create Contest (with validation)
router.post('/contests', async (req, res) => {
  const { match_id, name, entry_fee, prize_pool, total_spots, is_guaranteed, admin_commission_pct, max_entries_per_user } = req.body;

  // Validation
  if (!match_id || !name || !entry_fee || !prize_pool || !total_spots) {
    return res.status(400).json({ error: 'match_id, name, entry_fee, prize_pool, and total_spots are required' });
  }
  const fee = parseFloat(entry_fee);
  const prize = parseFloat(prize_pool);
  const spots = parseInt(total_spots);
  const comm = parseFloat(admin_commission_pct || 0);

  if (fee <= 0) return res.status(400).json({ error: 'Entry fee must be positive' });
  if (prize <= 0) return res.status(400).json({ error: 'Prize pool must be positive' });
  if (spots < 2) return res.status(400).json({ error: 'Total spots must be at least 2' });
  if (comm < 0 || comm > 100) return res.status(400).json({ error: 'Admin commission must be between 0 and 100' });

  // Verify match exists
  const [matchRows] = await pool.query('SELECT id FROM fantasy_matches WHERE id = ?', [match_id]);
  if (matchRows.length === 0) return res.status(400).json({ error: 'Match not found' });

  try {
    await pool.query(`
      INSERT INTO fantasy_contests (match_id, name, entry_fee, prize_pool, total_spots, is_guaranteed, admin_commission_pct, max_entries_per_user)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [match_id, name, fee, prize, spots, is_guaranteed !== undefined ? is_guaranteed : true, comm, max_entries_per_user || 1]);
    res.json({ success: true, message: 'Contest created successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Update Contest
router.put('/contests/:id', async (req, res) => {
  const { name, entry_fee, prize_pool, total_spots, is_guaranteed, admin_commission_pct, max_entries_per_user, status } = req.body;

  // Validation
  if (!name || entry_fee === undefined || prize_pool === undefined || total_spots === undefined) {
    return res.status(400).json({ error: 'name, entry_fee, prize_pool, and total_spots are required' });
  }
  const fee = parseFloat(entry_fee);
  const prize = parseFloat(prize_pool);
  const spots = parseInt(total_spots);
  const comm = parseFloat(admin_commission_pct || 0);

  if (fee <= 0) return res.status(400).json({ error: 'Entry fee must be positive' });
  if (prize <= 0) return res.status(400).json({ error: 'Prize pool must be positive' });
  if (spots < 2) return res.status(400).json({ error: 'Total spots must be at least 2' });
  if (comm < 0 || comm > 100) return res.status(400).json({ error: 'Admin commission must be between 0 and 100' });

  try {
    await pool.query(`
      UPDATE fantasy_contests SET name=?, entry_fee=?, prize_pool=?, total_spots=?, is_guaranteed=?, admin_commission_pct=?, max_entries_per_user=?, status=?
      WHERE id=?
    `, [name, fee, prize, spots, is_guaranteed !== undefined ? is_guaranteed : true, comm, max_entries_per_user || 1, status || 'open', req.params.id]);
    res.json({ success: true, message: 'Contest updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Delete Contest
router.delete('/contests/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Refund all entries
    const [entries] = await conn.query('SELECT id, user_id, fee_paid FROM fantasy_contest_entries WHERE contest_id = ?', [req.params.id]);
    for (const entry of entries) {
      const fee = parseFloat(entry.fee_paid || 0);
      if (fee > 0) {
        await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [fee, entry.user_id]);
      }
    }
    await conn.query('DELETE FROM fantasy_contest_entries WHERE contest_id = ?', [req.params.id]);
    await conn.query('DELETE FROM fantasy_contests WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: `Contest deleted and ${entries.length} entries refunded.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 13. Cancel Contest with Refunds
router.post('/contests/:id/cancel', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [entries] = await conn.query(
      'SELECT id, user_id, fee_paid FROM fantasy_contest_entries WHERE contest_id = ? AND prize_won IS NULL',
      [req.params.id]
    );
    for (const entry of entries) {
      const fee = parseFloat(entry.fee_paid || 0);
      if (fee > 0) {
        await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [fee, entry.user_id]);
        await conn.query(`
          INSERT INTO transactions (user_id, amount, type, description, status) 
          VALUES (?, ?, 'refund', ?, 'completed')
        `, [entry.user_id, fee, `Refund for cancelled contest #${req.params.id}`]);
      }
    }
    await conn.query('UPDATE fantasy_contests SET status = "cancelled" WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: `Contest cancelled, ${entries.length} entries refunded.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 14. Get Contest Entries (who joined)
router.get('/contests/:id/entries', async (req, res) => {
  try {
    const [entries] = await pool.query(`
      SELECT ce.id, ce.user_id, ce.team_id, ce.fee_paid, ce.prize_won, u.name as user_name, u.email, ut.total_points, ce.team_rank
      FROM fantasy_contest_entries ce
      JOIN users u ON ce.user_id = u.id
      LEFT JOIN fantasy_user_teams ut ON ce.team_id = ut.id
      WHERE ce.contest_id = ?
      ORDER BY ce.team_rank ASC
    `, [req.params.id]);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// === POINTS SYSTEM ===

// 15. Get point system
router.get('/point-system', async (req, res) => {
  try {
    const [points] = await pool.query('SELECT * FROM fantasy_point_system ORDER BY id ASC');
    res.json(points);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Update a point rule
router.put('/point-system/:id', async (req, res) => {
  const { action_key, points, format } = req.body;
  try {
    await pool.query('UPDATE fantasy_point_system SET action_key=?, points=?, format=? WHERE id=?',
      [action_key, points, format || 'T20', req.params.id]);
    res.json({ success: true, message: 'Point rule updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// === PLAYERS ===

// 17. Get all players
router.get('/players', async (req, res) => {
  try {
    const [players] = await pool.query('SELECT * FROM fantasy_players ORDER BY name ASC');
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 18. Update a player
router.put('/players/:id', async (req, res) => {
  const { name, team_name, role, credit_value } = req.body;
  try {
    await pool.query('UPDATE fantasy_players SET name=?, team_name=?, role=?, credit_value=? WHERE id=?',
      [name, team_name, role, credit_value, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
