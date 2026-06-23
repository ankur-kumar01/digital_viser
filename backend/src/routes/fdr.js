const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { addDays } = require('../utils');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /create
router.post('/create', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount, plan_id } = req.body;
    const userId = req.user.userId;
    const start_date = new Date().toISOString().split('T')[0];

    if (!amount || !plan_id) {
      return res.status(400).json({ error: 'All fields are required: amount, plan_id.' });
    }

    const fdrAmount = parseFloat(amount);
    if (fdrAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }

    // Fetch the plan
    const [planRows] = await conn.query('SELECT * FROM fdr_plans WHERE id = ? AND is_active = true', [plan_id]);
    if (planRows.length === 0) {
      return res.status(404).json({ error: 'Active FDR plan not found.' });
    }

    const plan = planRows[0];

    // Validate amount bounds
    if (fdrAmount < parseFloat(plan.min_amount) || fdrAmount > parseFloat(plan.max_amount)) {
      conn.release();
      return res.status(400).json({ error: `Amount must be between ₹${plan.min_amount} and ₹${plan.max_amount}.` });
    }

    // NOTE: User balance check moved inside transaction (see below) — ISSUE-013 fix

    const end_date = addDays(start_date, parseInt(plan.duration_days, 10));
    const nextInstallmentDate = addDays(start_date, parseInt(plan.period_days, 10));

    // ISSUE-013 FIX: Begin transaction BEFORE balance check to prevent TOCTOU race condition
    await conn.beginTransaction();

    // Check user balance WITH row lock inside transaction
    const [userRows] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentBalance = parseFloat(userRows[0].balance);
    if (currentBalance < fdrAmount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    // Deduct amount from user balance
    await conn.query(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [fdrAmount, userId]
    );

    // Insert FDR
    const [fdrResult] = await conn.query(
      `INSERT INTO fdrs (user_id, amount, start_date, end_date, interest_percent, period_days, next_installment_date, last_installment_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fdrAmount, start_date, end_date, parseFloat(plan.interest_percent), parseInt(plan.period_days, 10), nextInstallmentDate, start_date]
    );

    // Insert transaction (type='fdr_lock', negative amount)
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'fdr_lock', -fdrAmount, `FDR #${fdrResult.insertId} locked`]
    );

    // Check for active FDR percentage offers (validating times against actual server time)
    const [offers] = await conn.query(
      'SELECT * FROM fdr_offers WHERE is_active = TRUE AND NOW() BETWEEN start_time AND end_time LIMIT 1'
    );
    if (offers.length > 0) {
      const offer = offers[0];
      const bonusAmount = fdrAmount * (parseFloat(offer.bonus_percent) / 100);
      if (bonusAmount > 0) {
        await conn.query('UPDATE users SET locked_bonus_balance = locked_bonus_balance + ? WHERE id = ?', [bonusAmount, userId]);
        await conn.query(
          "INSERT INTO locked_funds (user_id, wallet_type, amount, linked_entity_id, linked_entity_type) VALUES (?, 'bonus', ?, ?, 'fdr')",
          [userId, bonusAmount, fdrResult.insertId]
        );
        await conn.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [userId, 'fdr_bonus_locked', bonusAmount, `Promotional FDR Bonus (${offer.bonus_percent}%) Locked`]
        );
      }
    }

    // Check for FDR bonus scheme
    const [schemes] = await conn.query("SELECT * FROM reward_schemes WHERE type = 'fdr_bonus' AND is_active = true AND min_amount <= ? ORDER BY min_amount DESC LIMIT 1", [fdrAmount]);
    if (schemes.length > 0) {
      const bonusAmount = parseFloat(schemes[0].reward_amount);
      if (bonusAmount > 0) {
        await conn.query('UPDATE users SET locked_bonus_balance = locked_bonus_balance + ? WHERE id = ?', [bonusAmount, userId]);
        await conn.query("INSERT INTO locked_funds (user_id, wallet_type, amount, linked_entity_id, linked_entity_type) VALUES (?, 'bonus', ?, ?, 'fdr')", [userId, bonusAmount, fdrResult.insertId]);
        await conn.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [userId, 'fdr_flat_bonus_locked', bonusAmount, `Flat FDR Bonus (₹${bonusAmount}) Locked`]
        );
      }
    }

    await conn.commit();

    // Fetch created FDR
    const [fdrRows] = await conn.query('SELECT id, user_id, amount, start_date, end_date, interest_percent, period_days, status, accrued_interest, last_installment_date, next_installment_date, created_at, last_referral_commission_date FROM fdrs WHERE id = ?', [fdrResult.insertId]);
    const fdr = fdrRows[0];

    res.status(201).json({
      ...fdr,
      amount: parseFloat(fdr.amount),
      interest_percent: parseFloat(fdr.interest_percent),
      accrued_interest: parseFloat(fdr.accrued_interest),
    });
  } catch (err) {
    await conn.rollback();
    console.error('FDR create error:', err);
    res.status(500).json({ error: 'Server error creating FDR.' });
  } finally {
    conn.release();
  }
});

// GET /my-fdrs
router.get('/my-fdrs', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get simulated date
    const [stateRows] = await pool.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    // Get all FDRs for user
    const [fdrs] = await pool.query(
      'SELECT id, user_id, amount, start_date, end_date, interest_percent, period_days, status, accrued_interest, last_installment_date, next_installment_date, created_at, last_referral_commission_date FROM fdrs WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    const { getGameplayCount } = require('../services/audienceResolver');
    const result = [];

    for (const fdr of fdrs) {
      const startMs = new Date(fdr.start_date + 'T00:00:00').getTime();
      const endMs = new Date(fdr.end_date + 'T00:00:00').getTime();
      const currentMs = new Date(simulatedDate + 'T00:00:00').getTime();
      const totalDuration = endMs - startMs;
      const elapsed = currentMs - startMs;

      let progress_percent = 0;
      if (totalDuration > 0) {
        progress_percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      }
      if (fdr.status === 'completed') {
        progress_percent = 100;
      }

      // Query active yield boosters for user on this simulated date
      let totalBoost = 0.0;
      const activeBoosters = [];

      if (fdr.status === 'active') {
        const [boosterRows] = await pool.query(
          `SELECT b.name, b.yield_boost_percent, b.unlock_game, b.unlock_value, uyb.activated_at
           FROM user_yield_boosters uyb
           JOIN fdr_yield_boosters b ON uyb.booster_id = b.id
           WHERE uyb.user_id = ?
             AND uyb.status = 'active'
             AND DATE(uyb.activated_at) <= DATE(?)
             AND DATE(uyb.expires_at) >= DATE(?)`,
          [userId, simulatedDate, simulatedDate]
        );

        for (const booster of boosterRows) {
          let isUnlocked = true;
          let currentPlays = 0;
          if (booster.unlock_value > 0) {
            const activatedDateStr = booster.activated_at instanceof Date
              ? booster.activated_at.toISOString().split('T')[0]
              : (typeof booster.activated_at === 'string' ? booster.activated_at.split(' ')[0] : new Date(booster.activated_at).toISOString().split('T')[0]);

            currentPlays = await getGameplayCount(userId, booster.unlock_game, activatedDateStr, simulatedDate);
            isUnlocked = currentPlays >= booster.unlock_value;
          }
          if (isUnlocked) {
            totalBoost += parseFloat(booster.yield_boost_percent);
          }
          activeBoosters.push({
            name: booster.name,
            yield_boost_percent: parseFloat(booster.yield_boost_percent),
            is_unlocked: isUnlocked,
            current_plays: currentPlays,
            unlock_value: booster.unlock_value
          });
        }
      }

      result.push({
        ...fdr,
        amount: parseFloat(fdr.amount),
        interest_percent: parseFloat(fdr.interest_percent),
        accrued_interest: parseFloat(fdr.accrued_interest),
        progress_percent: Math.round(progress_percent * 100) / 100,
        total_boost: totalBoost,
        active_boosters: activeBoosters
      });
    }

    res.json(result);
  } catch (err) {
    console.error('My FDRs error:', err);
    res.status(500).json({ error: 'Server error fetching FDRs.' });
  }
});

// GET /active-plans
router.get('/active-plans', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.query(`
      SELECT p.* FROM fdr_plans p
      LEFT JOIN fdr_plan_blocks b ON b.plan_id = p.id AND b.user_id = ?
      WHERE p.is_active = 1 AND b.id IS NULL
      ORDER BY p.created_at ASC
    `, [userId]);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch active FDR plans:', err);
    res.status(500).json({ error: 'Server error fetching FDR plans.' });
  }
});

// GET /offers (Active offers for users)
router.get('/offers', async (req, res) => {
  try {
    // Get active offers using actual server time
    const [rows] = await pool.query(
      'SELECT name, bonus_percent, start_time, end_time FROM fdr_offers WHERE is_active = TRUE AND NOW() BETWEEN start_time AND end_time'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch active offers.' });
  }
});

// GET /pnl
router.get('/pnl', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get simulated date
    const [stateRows] = await pool.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];
    
    // Get active FDRs
    const [fdrs] = await pool.query(
      "SELECT id, user_id, amount, start_date, end_date, interest_percent, period_days, status, accrued_interest, last_installment_date, next_installment_date, created_at, last_referral_commission_date FROM fdrs WHERE user_id = ? AND status = 'active'",
      [userId]
    );

    const calcUpcoming = (days) => {
      let total = 0;
      const currentMs = new Date(simulatedDate + 'T00:00:00').getTime();
      const cutoffMs = currentMs + days * 24 * 60 * 60 * 1000;
      
      fdrs.forEach((fdr) => {
        const amt = parseFloat(fdr.amount);
        const pct = parseFloat(fdr.interest_percent);
        const pDays = parseInt(fdr.period_days, 10);
        const payout = amt * (pct / 100);
        
        let nextMs = new Date(fdr.next_installment_date + 'T00:00:00').getTime();
        const endMs = new Date(fdr.end_date + 'T00:00:00').getTime();
        
        while (nextMs <= cutoffMs && nextMs <= endMs) {
          if (nextMs > currentMs) total += payout;
          nextMs += pDays * 24 * 60 * 60 * 1000;
        }
      });
      return total;
    };

    res.json({
      upcoming_profit_7d: calcUpcoming(7),
      upcoming_profit_30d: calcUpcoming(30)
    });
  } catch (err) {
    console.error('PnL error:', err);
    res.status(500).json({ error: 'Server error calculating PnL.' });
  }
});

// POST /force-close
router.post('/force-close', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.body;
    const userId = req.user.userId;

    if (!id) {
      return res.status(400).json({ error: 'FDR ID is required.' });
    }

    await conn.beginTransaction();

    // Verify FDR exists and belongs to user
    const [fdrRows] = await conn.query(
      "SELECT id, user_id, amount, start_date, end_date, interest_percent, period_days, status, accrued_interest, last_installment_date, next_installment_date, created_at, last_referral_commission_date FROM fdrs WHERE id = ? AND user_id = ? AND status = 'active' FOR UPDATE",
      [id, userId]
    );

    if (fdrRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Active FDR not found or does not belong to you.' });
    }

    const fdr = fdrRows[0];
    const principal = parseFloat(fdr.amount);

    // 1. Update FDR status to force_closed
    await conn.query("UPDATE fdrs SET status = 'force_closed' WHERE id = ?", [id]);

    // 2. Return principal to user's wallet
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [principal, userId]);

    // 3. Log the transaction
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'fdr_force_closed', principal, `FDR #${fdr.id} Force Closed - Principal Returned`]
    );

    // 4. Destroy any locked bonus funds tied to this FDR
    const [lockedFunds] = await conn.query(
      "SELECT * FROM locked_funds WHERE linked_entity_type = 'fdr' AND linked_entity_id = ? AND user_id = ? AND status = 'locked'",
      [id, userId]
    );

    for (const locked of lockedFunds) {
      // Deduct from the user's locked bonus balance since they are destroyed
      await conn.query(
        "UPDATE users SET locked_bonus_balance = locked_bonus_balance - ? WHERE id = ?",
        [parseFloat(locked.amount), userId]
      );
      // Mark as cancelled or simply delete. We will mark as cancelled to keep the record
      await conn.query("UPDATE locked_funds SET status = 'cancelled' WHERE id = ?", [locked.id]);
    }

    await conn.commit();
    res.json({ message: 'FDR successfully force closed.', principal_returned: principal });
  } catch (err) {
    await conn.rollback();
    console.error('Force Close FDR error:', err);
    res.status(500).json({ error: 'Server error processing force close request.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
