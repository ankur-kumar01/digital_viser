const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { resolveWalletColumn } = require('../utils');
const cache = require('../cache');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

const validateWallet = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array().map(e => e.msg).join('. ') });
  }
  next();
};

// POST /deposit
router.post('/deposit', [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('payment_method').optional().trim(),
  validateWallet
], async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount, payment_method, custom_data } = req.body;
    const userId = req.user.userId;
    const depositAmount = parseFloat(amount);

    const transactionId = uuidv4();

    await conn.beginTransaction();

    // Insert into deposits table
    await conn.query(
      'INSERT INTO deposits (user_id, amount, payment_method, transaction_id, status, custom_data) VALUES (?, ?, ?, ?, "pending", ?)',
      [userId, depositAmount, payment_method || 'direct', transactionId, JSON.stringify(custom_data || {})]
    );

    // Insert into transactions table
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'deposit_pending', depositAmount, `Pending Deposit via ${payment_method || 'direct'}`]
    );

    await conn.commit();

    // Fetch updated balance
    const [rows] = await conn.query('SELECT balance FROM users WHERE id = ?', [userId]);
    const newBalance = parseFloat(rows[0].balance);

    res.status(201).json({
      balance: newBalance,
      deposit: {
        transaction_id: transactionId,
        amount: depositAmount,
        payment_method: payment_method || 'direct',
        status: 'success',
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Deposit error:', err);
    res.status(500).json({ error: 'Server error during deposit.' });
  } finally {
    conn.release();
  }
});

// POST /withdraw
router.post('/withdraw', [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('payment_method').optional().trim(),
  body('source_wallet').optional().isIn(['main', 'bonus', 'referral', 'gaming_bonus']).withMessage('Invalid wallet type'),
  validateWallet
], async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount, payment_method, custom_data, source_wallet } = req.body;
    const userId = req.user.userId;
    const withdrawAmount = parseFloat(amount);

    const walletColumn = resolveWalletColumn(source_wallet);

    await conn.beginTransaction();

    // Fetch current balance and account creation date
    const [userRows] = await conn.query(`SELECT ${walletColumn} as current_balance, created_at FROM users WHERE id = ? FOR UPDATE`, [userId]);
    const currentBalance = parseFloat(userRows[0].current_balance);

    if (currentBalance < withdrawAmount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    // Fetch dynamic charges for this payment method
    const [pmRows] = await conn.query('SELECT withdrawal_charges FROM payment_methods WHERE name = ? LIMIT 1', [payment_method]);
    let dynamicCharges = [];
    if (pmRows.length > 0 && pmRows[0].withdrawal_charges) {
      dynamicCharges = typeof pmRows[0].withdrawal_charges === 'string' ? JSON.parse(pmRows[0].withdrawal_charges) : pmRows[0].withdrawal_charges;
    }

    let totalChargeAmount = 0;
    let chargeDetails = [];

    dynamicCharges.forEach(charge => {
      let amt = 0;
      if (charge.type === 'percent') {
        amt = (withdrawAmount * parseFloat(charge.value)) / 100;
      } else if (charge.type === 'fixed') {
        amt = parseFloat(charge.value);
      }
      if (amt > 0) {
        totalChargeAmount += amt;
        chargeDetails.push(`${charge.name}: ₹${amt.toFixed(2)}`);
      }
    });

    const chargeAmount = Math.round(totalChargeAmount * 100) / 100;
    const netPayout = withdrawAmount - chargeAmount;

    if (netPayout <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Withdrawal amount must be greater than charges.' });
    }

    const transactionId = uuidv4();

    // Update user balance (deduct immediately to prevent double spending)
    await conn.query(
      `UPDATE users SET ${walletColumn} = ${walletColumn} - ? WHERE id = ?`,
      [withdrawAmount, userId]
    );

    // Insert into withdrawals table (store full amount for admin reference)
    await conn.query(
      'INSERT INTO withdrawals (user_id, amount, payment_method, transaction_id, status, custom_data) VALUES (?, ?, ?, ?, "pending", ?)',
      [userId, withdrawAmount, payment_method || 'direct', transactionId, JSON.stringify({ ...custom_data, source_wallet, charge_applied: chargeAmount > 0, charge_amount: chargeAmount, net_payout: netPayout, charge_details: chargeDetails } || {})]
    );

    // Insert into transactions table
    let withdrawDesc = `Pending Withdrawal via ${payment_method || 'direct'}`;
    if (chargeAmount > 0) {
      withdrawDesc += ` (Fees: ${chargeDetails.join(', ')}, net payout: ₹${netPayout.toFixed(2)})`;
    }
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'withdrawal_pending', withdrawAmount, withdrawDesc]
    );

    // Record the charge as a separate transaction entry
    if (chargeAmount > 0) {
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [userId, 'withdrawal_charge', chargeAmount, `Withdrawal fees (${chargeDetails.join(', ')})`]
      );
    }

    await conn.commit();

    // Fetch updated balance from the affected wallet
    const [rows] = await conn.query(`SELECT ${walletColumn} as updated_balance FROM users WHERE id = ?`, [userId]);
    const newBalance = parseFloat(rows[0].updated_balance);

    res.status(201).json({
      balance: newBalance,
      withdrawal: {
        transaction_id: transactionId,
        amount: withdrawAmount,
        charge_applied: chargeAmount > 0,
        charge_amount: chargeAmount,
        net_payout: netPayout,
        payment_method: payment_method || 'direct',
        status: 'success',
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Withdrawal error:', err);
    res.status(500).json({ error: 'Server error during withdrawal.' });
  } finally {
    conn.release();
  }
});
// GET /transactions (with pagination)
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?',
      [userId]
    );

    const [rows] = await pool.query(
      'SELECT id, user_id, type, amount, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );

    res.json({
      data: rows.map((row) => ({ ...row, amount: parseFloat(row.amount) })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: 'Server error fetching transactions.' });
  }
});

// GET /active-methods
router.get('/active-methods', async (req, res) => {
  try {
    const cacheKey = 'payment:active-methods';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [rows] = await pool.query('SELECT id, name, type, is_active, admin_instructions, user_form, withdrawal_charges, created_at FROM payment_methods WHERE is_active = 1 ORDER BY created_at ASC');
    cache.set(cacheKey, rows, 30000);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching payment methods.' });
  }
});

// GET /config
router.get('/config', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT value_data FROM system_state WHERE key_name = 'admin_upi_id'");
    const upiId = rows.length > 0 ? rows[0].value_data : 'admin@upi';
    res.json({ admin_upi_id: upiId });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching config.' });
  }
});

// GET /deposits — list user's deposits (last 10)
router.get('/deposits', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.query(
      'SELECT id, user_id, amount, payment_method, transaction_id, status, custom_data, created_at FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    res.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (err) {
    console.error('Fetch deposits error:', err);
    res.status(500).json({ error: 'Server error fetching deposits.' });
  }
});

// GET /withdrawals — list user's withdrawals (last 10)
router.get('/withdrawals', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.query(
      'SELECT id, user_id, amount, payment_method, transaction_id, status, custom_data, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    res.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) })));
  } catch (err) {
    console.error('Fetch withdrawals error:', err);
    res.status(500).json({ error: 'Server error fetching withdrawals.' });
  }
});

// POST /deposits/:id/cancel — cancel a pending deposit
router.post('/deposits/:id/cancel', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.userId;
    const depositId = parseInt(req.params.id);

    const [deposits] = await conn.query(
      'SELECT id, user_id, amount, payment_method, transaction_id, status, custom_data, created_at FROM deposits WHERE id = ? AND user_id = ? FOR UPDATE',
      [depositId, userId]
    );
    if (deposits.length === 0) return res.status(404).json({ error: 'Deposit not found' });
    if (deposits[0].status !== 'pending') return res.status(400).json({ error: 'Only pending deposits can be cancelled' });

    await conn.beginTransaction();
    await conn.query('UPDATE deposits SET status = "rejected" WHERE id = ?', [depositId]);
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'deposit_cancelled', deposits[0].amount, `Deposit request cancelled by user`]
    );
    await conn.commit();

    res.json({ success: true, message: 'Deposit cancelled' });
  } catch (err) {
    await conn.rollback();
    console.error('Cancel deposit error:', err);
    res.status(500).json({ error: 'Server error cancelling deposit.' });
  } finally {
    conn.release();
  }
});

// POST /withdrawals/:id/cancel — cancel a pending withdrawal and refund
router.post('/withdrawals/:id/cancel', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.userId;
    const withdrawalId = parseInt(req.params.id);

    const [withdrawals] = await conn.query(
      'SELECT id, user_id, amount, payment_method, transaction_id, status, custom_data, created_at FROM withdrawals WHERE id = ? AND user_id = ? FOR UPDATE',
      [withdrawalId, userId]
    );
    if (withdrawals.length === 0) return res.status(404).json({ error: 'Withdrawal not found' });
    if (withdrawals[0].status !== 'pending') return res.status(400).json({ error: 'Only pending withdrawals can be cancelled' });

    const w = withdrawals[0];
    const customData = typeof w.custom_data === 'string' ? JSON.parse(w.custom_data) : (w.custom_data || {});
    const sourceWallet = customData.source_wallet || 'normal';
    const walletColumn = resolveWalletColumn(sourceWallet);

    await conn.beginTransaction();
    await conn.query('UPDATE withdrawals SET status = "rejected" WHERE id = ?', [withdrawalId]);
    // Refund the deducted amount back to the original wallet
    await conn.query(`UPDATE users SET ${walletColumn} = ${walletColumn} + ? WHERE id = ?`, [parseFloat(w.amount), userId]);
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'withdrawal_cancelled', parseFloat(w.amount), `Withdrawal request cancelled by user — refund to ${sourceWallet} wallet`]
    );
    await conn.commit();

    // Fetch updated balance
    const [rows] = await conn.query(`SELECT ${walletColumn} as updated_balance FROM users WHERE id = ?`, [userId]);
    res.json({ success: true, message: 'Withdrawal cancelled and refunded', balance: parseFloat(rows[0].updated_balance) });
  } catch (err) {
    await conn.rollback();
    console.error('Cancel withdrawal error:', err);
    res.status(500).json({ error: 'Server error cancelling withdrawal.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
