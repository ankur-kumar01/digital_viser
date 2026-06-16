const express = require('express');
const { pool } = require('../../db');
const authMiddleware = require('../../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// POST /api/games/fruitslasher/play
router.post('/play', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount } = req.body;
    const userId = req.user.userId;
    const betAmount = parseFloat(amount);

    // 1. Validate bet amount
    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }

    await conn.beginTransaction();

    // 2. Fetch min/max bet settings and house edge
    const [settingsRows] = await conn.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('fruit_slasher_min_bet', 'fruit_slasher_max_bet', 'fruit_slasher_house_edge')"
    );
    
    let minBet = 10;
    let maxBet = 5000;
    let houseEdgePercent = 5;

    settingsRows.forEach(row => {
      if (row.setting_key === 'fruit_slasher_min_bet') minBet = parseFloat(row.setting_value);
      if (row.setting_key === 'fruit_slasher_max_bet') maxBet = parseFloat(row.setting_value);
      if (row.setting_key === 'fruit_slasher_house_edge') houseEdgePercent = parseFloat(row.setting_value);
    });

    if (betAmount < minBet || betAmount > maxBet) {
      await conn.rollback();
      return res.status(400).json({ error: `Bet amount must be between ${minBet} and ${maxBet}` });
    }

    // 3. Fetch user wallet balance
    const [userRows] = await conn.query(
      'SELECT balance, gaming_bonus_balance FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );

    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

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

    // 4. Deduct balance
    const balanceField = selectedWallet === 'gaming_bonus' ? 'gaming_bonus_balance' : 'balance';
    await conn.query(
      `UPDATE users SET ${balanceField} = ${balanceField} - ? WHERE id = ?`,
      [betAmount, userId]
    );

    // Record transaction
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [
        userId,
        'game_bet',
        -betAmount,
        `Fruit Slasher Bet (${selectedWallet === 'gaming_bonus' ? 'Gaming Bonus' : 'Main Wallet'})`
      ]
    );

    // 5. Generate secure pre-determined crash multiplier
    const houseEdge = houseEdgePercent / 100.0;
    let serverCrashMultiplier = 1.00;

    const r = Math.random();
    if (r >= houseEdge) {
      // Standard crash distribution formula
      const rand = Math.random();
      serverCrashMultiplier = Math.max(1.01, parseFloat((0.98 / (1.0 - rand)).toFixed(2)));
      // Clamp to maximum 50x for safety
      if (serverCrashMultiplier > 50) {
        serverCrashMultiplier = parseFloat((50 + Math.random() * 5).toFixed(2));
      }
    } else {
      serverCrashMultiplier = 1.00; // Instabomb / crash at start
    }

    // 6. Insert active bet
    const [insertResult] = await conn.query(
      `INSERT INTO fruit_bets (user_id, wallet_type, bet_amount, server_crash_multiplier, multiplier_reached, win_amount, status)
       VALUES (?, ?, ?, ?, 1.00, 0.00, 'active')`,
      [userId, selectedWallet, betAmount, serverCrashMultiplier]
    );

    const betId = insertResult.insertId;

    // Fetch updated balance to return to user
    const [updatedUser] = await conn.query(
      'SELECT balance, gaming_bonus_balance FROM users WHERE id = ?',
      [userId]
    );

    await conn.commit();

    res.json({
      success: true,
      betId,
      walletType: selectedWallet,
      serverCrashMultiplier,
      newBalance: selectedWallet === 'gaming_bonus' 
        ? parseFloat(updatedUser[0].gaming_bonus_balance)
        : parseFloat(updatedUser[0].balance)
    });

  } catch (err) {
    await conn.rollback();
    console.error('Fruit Slasher play error:', err);
    res.status(500).json({ error: 'Failed to start game round' });
  } finally {
    conn.release();
  }
});

// POST /api/games/fruitslasher/cashout
router.post('/cashout', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { betId, multiplier } = req.body;
    const userId = req.user.userId;
    const claimedMultiplier = parseFloat(multiplier);

    if (!betId || isNaN(claimedMultiplier) || claimedMultiplier < 1.0) {
      return res.status(400).json({ error: 'Invalid cashout parameters' });
    }

    await conn.beginTransaction();

    // 1. Fetch the active bet
    const [betRows] = await conn.query(
      'SELECT * FROM fruit_bets WHERE id = ? AND user_id = ? AND status = ? FOR UPDATE',
      [betId, userId, 'active']
    );

    if (betRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'No active bet found for this round' });
    }

    const bet = betRows[0];
    const serverCrashLimit = parseFloat(bet.server_crash_multiplier);
    const betAmount = parseFloat(bet.bet_amount);
    const selectedWallet = bet.wallet_type;

    // 2. Validate claimed multiplier against server pre-determined limit
    if (claimedMultiplier > serverCrashLimit) {
      // Hacked client or late latency cashout -> Treat as crash
      await conn.query(
        "UPDATE fruit_bets SET status = 'lost', multiplier_reached = ? WHERE id = ?",
        [serverCrashLimit, betId]
      );
      await conn.commit();
      return res.json({
        success: false,
        reason: 'crashed',
        multiplier: serverCrashLimit,
        payout: 0
      });
    }

    // 3. Process Win
    const payout = parseFloat((betAmount * claimedMultiplier).toFixed(2));
    
    // Update bet
    await conn.query(
      "UPDATE fruit_bets SET status = 'won', multiplier_reached = ?, win_amount = ? WHERE id = ?",
      [claimedMultiplier, payout, betId]
    );

    // Add win to user balance
    const balanceField = selectedWallet === 'gaming_bonus' ? 'gaming_bonus_balance' : 'balance';
    await conn.query(
      `UPDATE users SET ${balanceField} = ${balanceField} + ? WHERE id = ?`,
      [payout, userId]
    );

    // Record transaction
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [
        userId,
        'game_win',
        payout,
        `Fruit Slasher Win (${claimedMultiplier.toFixed(2)}x - ${selectedWallet === 'gaming_bonus' ? 'Gaming Bonus' : 'Main Wallet'})`
      ]
    );

    // Trigger dynamic big win check (if payout is large)
    if (payout >= 500) {
      const [uRows] = await conn.query('SELECT name FROM users WHERE id = ?', [userId]);
      const userName = uRows[0]?.name || 'Player';
      await conn.query(
        "INSERT INTO big_wins (user_name, game_name, win_amount, multiplier) VALUES (?, 'Fruit Slasher', ?, ?)",
        [userName, payout, claimedMultiplier]
      );
    }

    // Fetch updated balance
    const [updatedUser] = await conn.query(
      'SELECT balance, gaming_bonus_balance FROM users WHERE id = ?',
      [userId]
    );

    await conn.commit();

    res.json({
      success: true,
      payout,
      multiplier: claimedMultiplier,
      newBalance: selectedWallet === 'gaming_bonus'
        ? parseFloat(updatedUser[0].gaming_bonus_balance)
        : parseFloat(updatedUser[0].balance)
    });

  } catch (err) {
    await conn.rollback();
    console.error('Fruit Slasher cashout error:', err);
    res.status(500).json({ error: 'Failed to process cashout' });
  } finally {
    conn.release();
  }
});

// POST /api/games/fruitslasher/crash
router.post('/crash', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { betId, multiplier } = req.body;
    const userId = req.user.userId;
    const endMultiplier = parseFloat(multiplier) || 1.0;

    await conn.beginTransaction();

    // Update active bet to lost
    const [result] = await conn.query(
      "UPDATE fruit_bets SET status = 'lost', multiplier_reached = ? WHERE id = ? AND user_id = ? AND status = 'active'",
      [endMultiplier, betId, userId]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Active round bet not found' });
    }

    await conn.commit();
    res.json({ success: true, status: 'lost' });

  } catch (err) {
    await conn.rollback();
    console.error('Fruit Slasher crash error:', err);
    res.status(500).json({ error: 'Failed to process crash' });
  } finally {
    conn.release();
  }
});

module.exports = router;
