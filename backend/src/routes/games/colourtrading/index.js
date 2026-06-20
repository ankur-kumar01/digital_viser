const express = require('express');
const { pool } = require('../../../db');
const authMiddleware = require('../../../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// POST /api/games/colourtrading/play
router.post('/play', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount, color } = req.body;
    const userId = req.user.userId;
    const betAmount = parseFloat(amount);

    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }
    
    if (!['red', 'green', 'violet'].includes(color)) {
      return res.status(400).json({ error: 'Invalid color selection' });
    }

    await conn.beginTransaction();

    // Check balance
    const [userRows] = await conn.query('SELECT balance, gaming_bonus_balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) throw new Error('User not found');
    const mainBalance = parseFloat(userRows[0].balance);
    const gamingBonusBalance = parseFloat(userRows[0].gaming_bonus_balance || 0);

    // Priority: deduct from gaming_bonus_balance first
    let selectedWallet = 'main';
    if (gamingBonusBalance >= betAmount) {
      selectedWallet = 'gaming_bonus';
    } else {
      selectedWallet = 'main';
      if (mainBalance < betAmount) {
        await conn.rollback();
        return res.status(400).json({ error: 'Insufficient balance' });
      }
    }

    // Deduct bet
    const balanceField = selectedWallet === 'gaming_bonus' ? 'gaming_bonus_balance' : 'balance';
    await conn.query(`UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`, [betAmount, userId]);
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [
        userId,
        'game_bet',
        -betAmount,
        `Colour Trading Bet (${color}) (${selectedWallet === 'gaming_bonus' ? 'Gaming Bonus' : 'Main Wallet'})`
      ]
    );

    // Roll Result on Server
    const roll = Math.random();
    let resultColor = 'red';
    if (roll > 0.5 && roll < 0.9) resultColor = 'green';
    else if (roll >= 0.9) resultColor = 'violet';

    let winAmount = 0;
    if (color === resultColor) {
      const mult = resultColor === 'violet' ? 3 : 2;
      winAmount = betAmount * mult;
      
      // Add win to balance
      await conn.query(`UPDATE users SET ${balanceField} = ${balanceField} + ? WHERE id = ?`, [winAmount, userId]);
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [
          userId,
          'game_win',
          winAmount,
          `Colour Trading Win (${resultColor}) (${selectedWallet === 'gaming_bonus' ? 'Gaming Bonus' : 'Main Wallet'})`
        ]
      );
    }

    const [updatedUser] = await conn.query('SELECT balance, gaming_bonus_balance FROM users WHERE id = ?', [userId]);

    await conn.commit();
    res.json({ 
      success: true, 
      result: resultColor, 
      won: winAmount > 0,
      payout: winAmount,
      newBalance: selectedWallet === 'gaming_bonus'
        ? parseFloat(updatedUser[0].gaming_bonus_balance)
        : parseFloat(updatedUser[0].balance) 
    });
  } catch (err) {
    await conn.rollback();
    console.error('Colour Trading play error:', err);
    res.status(500).json({ error: err.message || 'Server error playing game' });
  } finally {
    conn.release();
  }
});

// GET /api/games/colourtrading/my-bets
router.get('/my-bets', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cb.id, cb.bet_amount, cb.win_amount, cb.status, cb.color as color_choice, cb.created_at,
              cr.result_color, cr.result_number, u.name as user_name
       FROM ct_bets cb
       LEFT JOIN ct_rounds cr ON cb.round_id = cr.id
       LEFT JOIN users u ON cb.user_id = u.id
       WHERE cb.user_id = ?
       ORDER BY cb.created_at DESC
       LIMIT 20`,
      [req.user.userId]
    );
    const formatted = rows.map(r => {
      const betAmt = parseFloat(r.bet_amount) || 0;
      const winAmt = parseFloat(r.win_amount) || 0;
      const hasWon = r.status === 'won';
      const targetMult = hasWon && betAmt > 0 ? (winAmt / betAmt) : 0;
      return {
        id: r.id,
        name: r.user_name || 'You',
        bet: betAmt,
        cashedOut: hasWon,
        targetMult: targetMult,
        winAmount: winAmt,
        colorChoice: r.color_choice,
        resultColor: r.result_color,
        resultNumber: r.result_number,
        created_at: r.created_at
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch my Colour Trading bets:', err);
    res.status(500).json({ error: 'Failed to fetch my Colour Trading bets' });
  }
});

// GET /api/games/colourtrading/top-bets
router.get('/top-bets', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cb.id, cb.bet_amount, cb.win_amount, cb.status, cb.color as color_choice, cb.created_at,
              cr.result_color, cr.result_number, u.name as user_name
       FROM ct_bets cb
       LEFT JOIN ct_rounds cr ON cb.round_id = cr.id
       LEFT JOIN users u ON cb.user_id = u.id
       WHERE cb.status = 'won'
       ORDER BY cb.win_amount DESC
       LIMIT 50`
    );
    const formatted = rows.map(r => {
      const betAmt = parseFloat(r.bet_amount) || 0;
      const winAmt = parseFloat(r.win_amount) || 0;
      const targetMult = betAmt > 0 ? (winAmt / betAmt) : 0;
      return {
        id: r.id,
        name: r.user_name || 'User',
        bet: betAmt,
        cashedOut: true,
        targetMult: targetMult,
        winAmount: winAmt,
        colorChoice: r.color_choice,
        resultColor: r.result_color,
        resultNumber: r.result_number,
        created_at: r.created_at
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch top Colour Trading bets:', err);
    res.status(500).json({ error: 'Failed to fetch top Colour Trading bets' });
  }
});

// GET /api/games/colourtrading/recent-bets
router.get('/recent-bets', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cb.id, cb.bet_amount, cb.win_amount, cb.status, cb.color as color_choice, cb.created_at,
              cr.result_color, cr.result_number, u.name as user_name
       FROM ct_bets cb
       LEFT JOIN ct_rounds cr ON cb.round_id = cr.id
       LEFT JOIN users u ON cb.user_id = u.id
       ORDER BY cb.created_at DESC
       LIMIT 20`
    );
    const formatted = rows.map(r => {
      const betAmt = parseFloat(r.bet_amount) || 0;
      const winAmt = parseFloat(r.win_amount) || 0;
      const hasWon = r.status === 'won';
      const targetMult = hasWon && betAmt > 0 ? (winAmt / betAmt) : 0;
      return {
        id: r.id,
        name: r.user_name || 'User',
        bet: betAmt,
        cashedOut: hasWon,
        targetMult: targetMult,
        winAmount: winAmt,
        colorChoice: r.color_choice,
        resultColor: r.result_color,
        resultNumber: r.result_number,
        created_at: r.created_at
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('Failed to fetch recent Colour Trading bets:', err);
    res.status(500).json({ error: 'Failed to fetch recent Colour Trading bets' });
  }
});

module.exports = router;
