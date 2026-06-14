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

    // Fetch current balance
    const [userRows] = await conn.query(`SELECT ${walletColumn} as current_balance FROM users WHERE id = ? FOR UPDATE`, [userId]);
    const currentBalance = parseFloat(userRows[0].current_balance);

    if (currentBalance < withdrawAmount) {
      await conn.rollback();
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    const transactionId = uuidv4();

    // Update user balance (deduct immediately to prevent double spending)
    await conn.query(
      `UPDATE users SET ${walletColumn} = ${walletColumn} - ? WHERE id = ?`,
      [withdrawAmount, userId]
    );

    // Insert into withdrawals table
    await conn.query(
      'INSERT INTO withdrawals (user_id, amount, payment_method, transaction_id, status, custom_data) VALUES (?, ?, ?, ?, "pending", ?)',
      [userId, withdrawAmount, payment_method || 'direct', transactionId, JSON.stringify({ ...custom_data, source_wallet } || {})]
    );

    // Insert into transactions table
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [userId, 'withdrawal_pending', withdrawAmount, `Pending Withdrawal via ${payment_method || 'direct'}`]
    );

    await conn.commit();

    // Fetch updated balance
    const [rows] = await conn.query('SELECT balance FROM users WHERE id = ?', [userId]);
    const newBalance = parseFloat(rows[0].balance);

    res.status(201).json({
      balance: newBalance,
      withdrawal: {
        transaction_id: transactionId,
        amount: withdrawAmount,
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
