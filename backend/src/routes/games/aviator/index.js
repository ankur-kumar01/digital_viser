const express = require('express');
const { pool } = require('../../../db');
const authMiddleware = require('../../../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// POST /api/games/aviator/bet
router.post('/bet', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount } = req.body;
    const userId = req.user.userId;
    const betAmount = parseFloat(amount);

    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }

    await conn.beginTransaction();

    // Check balance
    const [userRows] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) throw new Error('User not found');
    const balance = parseFloat(userRows[0].balance);

    if (balance < betAmount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance in normal wallet' });
    }

    // Deduct bet
    await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [betAmount, userId]);

    // Insert transaction
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'game_bet', -betAmount, 'Aviator Bet']
    );

    await conn.commit();
    res.json({ success: true, newBalance: balance - betAmount });
  } catch (err) {
    await conn.rollback();
    console.error('Aviator bet error:', err);
    res.status(500).json({ error: err.message || 'Server error placing bet' });
  } finally {
    conn.release();
  }
});

// POST /api/games/aviator/cashout
router.post('/cashout', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { winAmount } = req.body;
    const userId = req.user.userId;
    const win = parseFloat(winAmount);

    if (isNaN(win) || win <= 0) {
      return res.status(400).json({ error: 'Invalid cashout amount' });
    }

    await conn.beginTransaction();

    // Add win to balance
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [win, userId]);

    // Insert transaction
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'game_win', win, 'Aviator Win']
    );

    // Fetch updated balance
    const [userRows] = await conn.query('SELECT balance FROM users WHERE id = ?', [userId]);

    await conn.commit();
    res.json({ success: true, newBalance: parseFloat(userRows[0].balance) });
  } catch (err) {
    await conn.rollback();
    console.error('Aviator cashout error:', err);
    res.status(500).json({ error: err.message || 'Server error processing cashout' });
  } finally {
    conn.release();
  }
});

module.exports = router;
