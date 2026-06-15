const express = require('express');
const { pool } = require('../../db');

const aviatorRoutes = require('./aviator');
const colourTradingRoutes = require('./colourtrading');

const router = express.Router();

// GET /api/games (Returns only active games)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM games WHERE is_active = true ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch games:', err);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// GET /api/games/big-wins (Returns big wins for ticker)
router.get('/big-wins', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM big_wins ORDER BY created_at DESC LIMIT 50');
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch big wins:', err);
    res.status(500).json({ error: 'Failed to fetch big wins' });
  }
});

// Mount game-specific routes
router.use('/aviator', aviatorRoutes);
router.use('/colourtrading', colourTradingRoutes);

module.exports = router;
