const express = require('express');
const { pool } = require('../db');
const router = express.Router();
const fantasyCricketCron = require('../cron/fantasyCricketCron');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

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

// 1. Get all matches
router.get('/matches', async (req, res) => {
  try {
    const [matches] = await pool.query('SELECT * FROM fantasy_matches ORDER BY start_time DESC');
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Trigger Sync Matches
router.post('/sync-matches', async (req, res) => {
  try {
    await fantasyCricketCron.syncUpcomingMatches();
    res.json({ success: true, message: 'Matches synced successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Trigger Sync Squads
router.post('/sync-squads', async (req, res) => {
  try {
    await fantasyCricketCron.syncSquads();
    res.json({ success: true, message: 'Squads synced successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Force Process Live Match
router.post('/process-live', async (req, res) => {
  try {
    await fantasyCricketCron.processLiveMatches();
    res.json({ success: true, message: 'Live matches processed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get Contests
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

// 6. Create Contest
router.post('/contests', async (req, res) => {
  const { match_id, name, entry_fee, prize_pool, total_spots, is_guaranteed, admin_commission_pct } = req.body;
  try {
    await pool.query(`
      INSERT INTO fantasy_contests (match_id, name, entry_fee, prize_pool, total_spots, is_guaranteed, admin_commission_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [match_id, name, entry_fee, prize_pool, total_spots, is_guaranteed, admin_commission_pct]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Update Match Status (Admin override)
router.put('/matches/:id/status', async (req, res) => {
  try {
    await pool.query('UPDATE fantasy_matches SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
