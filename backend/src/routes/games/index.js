const express = require('express');
const { pool } = require('../../db');
const cache = require('../../cache');

const colourTradingRoutes = require('./colourtrading');
const fruitSlasherRoutes = require('./fruitslasher');
const authMiddleware = require('../../middleware/auth');

const router = express.Router();

// GET /api/games (Returns only active games)
router.get('/', async (req, res) => {
  try {
    const cacheKey = 'games:active';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [rows] = await pool.query('SELECT id, name, slug, description, image_url, is_active, min_bet, max_bet, created_at FROM games WHERE is_active = true ORDER BY created_at DESC');
    cache.set(cacheKey, rows, 30000);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch games:', err);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// GET /api/games/big-wins (Returns big wins for ticker)
router.get('/big-wins', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, user_name, amount, game_name, game_color, created_at FROM big_wins ORDER BY created_at DESC LIMIT 50');
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
       LIMIT 20`,
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

// GET /api/games/aviator/recent-bets (Recent bets placed by all users)
router.get('/aviator/recent-bets', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ab.id, ab.bet_amount, ab.win_amount, ab.status, ab.cashout_multiplier, ab.created_at,
              u.name as user_name
       FROM aviator_bets ab
       LEFT JOIN users u ON ab.user_id = u.id
       ORDER BY ab.created_at DESC
       LIMIT 20`
    );
    const formatted = rows.map(r => ({
      id: r.id,
      name: r.user_name || 'User',
      bet: parseFloat(r.bet_amount) || 0,
      cashedOut: r.status === 'cashed_out',
      targetMult: parseFloat(r.cashout_multiplier) || 0,
      winAmount: parseFloat(r.win_amount) || 0,
      created_at: r.created_at
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch recent aviator bets:', err);
    res.status(500).json({ error: 'Failed to fetch recent bets' });
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

// --- Ludo Multiplayer Endpoints ---

// GET /api/games/ludo/my-bets
router.get('/ludo/my-bets', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lr.id, lr.entry_fee, lr.status, lr.winner_id, lr.created_at,
              u1.name as host_name, u2.name as challenger_name, uw.name as winner_name
       FROM ludo_rooms lr
       LEFT JOIN users u1 ON lr.host_id = u1.id
       LEFT JOIN users u2 ON lr.challenger_id = u2.id
       LEFT JOIN users uw ON lr.winner_id = uw.id
       WHERE lr.host_id = ? OR lr.challenger_id = ?
       ORDER BY lr.created_at DESC
       LIMIT 20`,
      [req.user.userId, req.user.userId]
    );

    const formatted = rows.map(r => {
      const betAmt = parseFloat(r.entry_fee) || 0;
      const isWinner = r.winner_id === req.user.userId;
      const winPayout = isWinner ? (betAmt * 2 * 0.95) : 0;
      const opponentName = r.host_id === req.user.userId ? (r.challenger_name || 'LudoBot') : r.host_name;
      return {
        id: r.id,
        name: opponentName,
        bet: betAmt,
        cashedOut: r.status === 'completed' && isWinner,
        targetMult: r.status === 'completed' && isWinner ? 1.9 : 0,
        winAmount: winPayout,
        created_at: r.created_at
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch my Ludo bets:', err);
    res.status(500).json({ error: 'Failed to fetch my Ludo bets' });
  }
});

// GET /api/games/ludo/top-wins
router.get('/ludo/top-wins', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lr.id, lr.entry_fee, lr.status, lr.winner_id, lr.created_at,
              uw.name as winner_name
       FROM ludo_rooms lr
       LEFT JOIN users uw ON lr.winner_id = uw.id
       WHERE lr.status = 'completed' AND lr.winner_id IS NOT NULL AND lr.winner_id != 9999 AND lr.winner_id < 10000
       ORDER BY lr.entry_fee DESC
       LIMIT 50`
    );

    const formatted = rows.map(r => {
      const betAmt = parseFloat(r.entry_fee) || 0;
      const winPayout = betAmt * 2 * 0.95;
      return {
        id: r.id,
        name: r.winner_name || 'User',
        bet: betAmt,
        cashedOut: true,
        targetMult: 1.9,
        winAmount: winPayout,
        created_at: r.created_at
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch top Ludo wins:', err);
    res.status(500).json({ error: 'Failed to fetch top Ludo wins' });
  }
});

// GET /api/games/ludo/recent-bets
router.get('/ludo/recent-bets', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lr.id, lr.entry_fee, lr.status, lr.winner_id, lr.created_at,
              u1.name as host_name, u2.name as challenger_name, uw.name as winner_name
       FROM ludo_rooms lr
       LEFT JOIN users u1 ON lr.host_id = u1.id
       LEFT JOIN users u2 ON lr.challenger_id = u2.id
       LEFT JOIN users uw ON lr.winner_id = uw.id
       WHERE lr.status IN ('playing', 'completed')
       ORDER BY lr.created_at DESC
       LIMIT 20`
    );

    const formatted = rows.map(r => {
      const betAmt = parseFloat(r.entry_fee) || 0;
      const hasWon = r.status === 'completed' && r.winner_id !== null;
      const winnerName = r.winner_name || (r.winner_id === 9999 ? 'LudoBot' : 'Player');
      return {
        id: r.id,
        name: hasWon ? winnerName : (r.host_name || 'Player'),
        bet: betAmt,
        cashedOut: hasWon,
        targetMult: hasWon ? 1.9 : 0,
        winAmount: hasWon ? (betAmt * 2 * 0.95) : 0,
        created_at: r.created_at
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch recent Ludo bets:', err);
    res.status(500).json({ error: 'Failed to fetch recent Ludo bets' });
  }
});

// Mount game-specific routes
router.use('/colourtrading', colourTradingRoutes);
router.use('/fruitslasher', fruitSlasherRoutes);

module.exports = router;
