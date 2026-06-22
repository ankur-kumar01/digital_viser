const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;

// Admin Auth Middleware
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(adminAuth);

// GET /api/admin/yield-boosters
router.get('/', async (req, res) => {
  try {
    // Get simulated date to compute active user counts correctly
    const [stateRows] = await pool.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    const [rows] = await pool.query(
      `SELECT b.*, COUNT(uyb.id) as active_users
       FROM fdr_yield_boosters b
       LEFT JOIN user_yield_boosters uyb ON b.id = uyb.booster_id 
         AND uyb.status = 'active'
         AND DATE(uyb.expires_at) >= DATE(?)
       GROUP BY b.id
       ORDER BY b.created_at DESC`,
      [simulatedDate]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error fetching admin yield boosters:', err);
    res.status(500).json({ error: 'Server error fetching admin yield boosters.' });
  }
});

// POST /api/admin/yield-boosters
router.post('/', async (req, res) => {
  try {
    const { name, description, yield_boost_percent, target_type, duration_days, is_active } = req.body;

    if (!name || !description || yield_boost_percent === undefined || !target_type || !duration_days) {
      return res.status(400).json({ error: 'All fields (name, description, yield_boost_percent, target_type, duration_days) are required.' });
    }

    const boostPercent = parseFloat(yield_boost_percent);
    const duration = parseInt(duration_days, 10);

    if (isNaN(boostPercent) || boostPercent <= 0) {
      return res.status(400).json({ error: 'Yield boost percent must be a positive number.' });
    }

    if (isNaN(duration) || duration <= 0) {
      return res.status(400).json({ error: 'Duration days must be a positive integer.' });
    }

    const validTargets = ['all', 'inactive_2d', 'inactive_7d_reg'];
    if (!validTargets.includes(target_type)) {
      return res.status(400).json({ error: 'Invalid target type.' });
    }

    const activeStatus = is_active !== false;

    await pool.query(
      `INSERT INTO fdr_yield_boosters (name, description, yield_boost_percent, target_type, duration_days, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description, boostPercent, target_type, duration, activeStatus]
    );

    res.status(201).json({ message: 'Yield booster config successfully created!' });
  } catch (err) {
    console.error('Error creating yield booster:', err);
    res.status(500).json({ error: 'Server error creating yield booster.' });
  }
});

// PUT /api/admin/yield-boosters/:id
router.put('/:id', async (req, res) => {
  try {
    const boosterId = parseInt(req.params.id, 10);
    const { name, description, yield_boost_percent, target_type, duration_days, is_active } = req.body;

    if (!name || !description || yield_boost_percent === undefined || !target_type || !duration_days) {
      return res.status(400).json({ error: 'All fields (name, description, yield_boost_percent, target_type, duration_days) are required.' });
    }

    const boostPercent = parseFloat(yield_boost_percent);
    const duration = parseInt(duration_days, 10);

    if (isNaN(boostPercent) || boostPercent <= 0) {
      return res.status(400).json({ error: 'Yield boost percent must be a positive number.' });
    }

    if (isNaN(duration) || duration <= 0) {
      return res.status(400).json({ error: 'Duration days must be a positive integer.' });
    }

    const validTargets = ['all', 'inactive_2d', 'inactive_7d_reg'];
    if (!validTargets.includes(target_type)) {
      return res.status(400).json({ error: 'Invalid target type.' });
    }

    const [existing] = await pool.query('SELECT id FROM fdr_yield_boosters WHERE id = ?', [boosterId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Yield booster not found.' });
    }

    const activeStatus = is_active !== false;

    await pool.query(
      `UPDATE fdr_yield_boosters 
       SET name = ?, description = ?, yield_boost_percent = ?, target_type = ?, duration_days = ?, is_active = ?
       WHERE id = ?`,
      [name, description, boostPercent, target_type, duration, activeStatus, boosterId]
    );

    res.json({ message: 'Yield booster successfully updated!' });
  } catch (err) {
    console.error('Error updating yield booster:', err);
    res.status(500).json({ error: 'Server error updating yield booster.' });
  }
});

// DELETE /api/admin/yield-boosters/:id
router.delete('/:id', async (req, res) => {
  try {
    const boosterId = parseInt(req.params.id, 10);

    const [existing] = await pool.query('SELECT id FROM fdr_yield_boosters WHERE id = ?', [boosterId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Yield booster not found.' });
    }

    await pool.query('DELETE FROM fdr_yield_boosters WHERE id = ?', [boosterId]);

    res.json({ message: 'Yield booster config successfully deleted!' });
  } catch (err) {
    console.error('Error deleting yield booster:', err);
    res.status(500).json({ error: 'Server error deleting yield booster.' });
  }
});

module.exports = router;
