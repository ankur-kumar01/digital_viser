const express = require('express');
const { pool } = require('../../db');

const colourTradingRoutes = require('./colourtrading');
const fruitSlasherRoutes = require('./fruitslasher');
const authMiddleware = require('../../middleware/auth');

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

// GET /api/games/simulations/aviator-chats
router.get('/simulations/aviator-chats', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM simulated_aviator_chats');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch aviator chats' });
  }
});

// GET /api/games/simulations/aviator-bets
router.get('/simulations/aviator-bets', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM simulated_aviator_bets');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch aviator bets' });
  }
});

// GET /api/games/aviator/my-bets (User's own bet history)
router.get('/aviator/my-bets', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ab.id, ab.bet_amount, ab.win_amount, ab.status, ab.cashout_multiplier, ab.created_at, 
              ar.crash_point, u.name as user_name
       FROM aviator_bets ab
       LEFT JOIN aviator_rounds ar ON ab.round_id = ar.id
       LEFT JOIN users u ON ab.user_id = u.id
       WHERE ab.user_id = ?
       ORDER BY ab.created_at DESC
       LIMIT 50`,
      [req.user.userId]
    );
    // Format to make compatible with UI expecting numbers
    const formatted = rows.map(r => ({
      id: r.id,
      name: r.user_name || 'You',
      bet: parseFloat(r.bet_amount) || 0,
      cashedOut: r.status === 'cashed_out',
      targetMult: parseFloat(r.cashout_multiplier) || 0,
      winAmount: parseFloat(r.win_amount) || 0,
      created_at: r.created_at
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch my aviator bets:', err);
    res.status(500).json({ error: 'Failed to fetch my bets' });
  }
});

// GET /api/games/aviator/top-bets (Top wins of all time)
router.get('/aviator/top-bets', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ab.id, ab.bet_amount, ab.win_amount, ab.status, ab.cashout_multiplier, ab.created_at,
              u.name as user_name
       FROM aviator_bets ab
       LEFT JOIN users u ON ab.user_id = u.id
       WHERE ab.status = 'cashed_out'
       ORDER BY ab.win_amount DESC
       LIMIT 50`
    );
    const formatted = rows.map(r => ({
      id: r.id,
      name: r.user_name || 'User',
      bet: parseFloat(r.bet_amount) || 0,
      cashedOut: true,
      targetMult: parseFloat(r.cashout_multiplier) || 0,
      winAmount: parseFloat(r.win_amount) || 0,
      created_at: r.created_at
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch top aviator bets:', err);
    res.status(500).json({ error: 'Failed to fetch top bets' });
  }
});

// GET /api/games/simulations/colour-trading-bets
router.get('/simulations/colour-trading-bets', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM simulated_colour_trading_bets');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch colour trading bets' });
  }
});

// Mount game-specific routes
router.use('/colourtrading', colourTradingRoutes);
router.use('/fruitslasher', fruitSlasherRoutes);

module.exports = router;
