const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /deposit
router.post('/deposit', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount, payment_method, custom_data } = req.body;
    const userId = req.user.userId;

    // Validate amount
    const depositAmount = parseFloat(amount);
    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }

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
router.post('/withdraw', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount, payment_method, custom_data, source_wallet } = req.body;
    const userId = req.user.userId;

    // Validate amount
    const withdrawAmount = parseFloat(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }

    const walletColumn = source_wallet === 'bonus' ? 'bonus_balance' : source_wallet === 'referral' ? 'referral_balance' : 'balance';

    await conn.beginTransaction();

    // Fetch current balance and account creation date
    const [userRows] = await conn.query(`SELECT ${walletColumn} as current_balance, created_at FROM users WHERE id = ? FOR UPDATE`, [userId]);
    const currentBalance = parseFloat(userRows[0].current_balance);

    if (currentBalance < withdrawAmount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    // Check if account is less than 10 days old → apply 10% fee
    const accountAgeDays = Math.floor((Date.now() - new Date(userRows[0].created_at).getTime()) / (1000 * 60 * 60 * 24));
    const chargeRate = accountAgeDays < 10 ? 0.10 : 0;
    const chargeAmount = chargeRate > 0 ? Math.round(withdrawAmount * chargeRate * 100) / 100 : 0;
    const netPayout = withdrawAmount - chargeAmount;

    const transactionId = uuidv4();

    // Update user balance (deduct immediately to prevent double spending)
    await conn.query(
      `UPDATE users SET ${walletColumn} = ${walletColumn} - ? WHERE id = ?`,
      [withdrawAmount, userId]
    );

    // Insert into withdrawals table (store full amount for admin reference)
    await conn.query(
      'INSERT INTO withdrawals (user_id, amount, payment_method, transaction_id, status, custom_data) VALUES (?, ?, ?, ?, "pending", ?)',
      [userId, withdrawAmount, payment_method || 'direct', transactionId, JSON.stringify({ ...custom_data, source_wallet, charge_applied: chargeRate > 0, charge_amount: chargeAmount, net_payout: netPayout } || {})]
    );

    // Insert into transactions table
    let withdrawDesc = `Pending Withdrawal via ${payment_method || 'direct'}`;
    if (chargeRate > 0) {
      withdrawDesc += ` (10% early withdrawal fee: ₹${chargeAmount.toFixed(2)}, net payout: ₹${netPayout.toFixed(2)})`;
    }
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'withdrawal_pending', withdrawAmount, withdrawDesc]
    );

      // Record the charge as a separate transaction entry
    if (chargeAmount > 0) {
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [userId, 'withdrawal_charge', chargeAmount, `10% early withdrawal fee (account < 10 days old)`]
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
        charge_applied: chargeRate > 0,
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
// GET /transactions
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.query(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json(rows.map((row) => ({
      ...row,
      amount: parseFloat(row.amount),
    })));
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: 'Server error fetching transactions.' });
  }
});

// GET /active-methods
router.get('/active-methods', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY created_at ASC');
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

module.exports = router;
