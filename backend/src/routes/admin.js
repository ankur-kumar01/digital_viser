const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Admin Auth Middleware
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM admins WHERE email = ?', [email]);
    const admin = rows[0];

    if (!admin) return res.status(401).json({ error: 'Invalid admin credentials' });

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid admin credentials' });

    const token = jwt.sign({ adminId: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
    
    res.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Apply admin auth to all subsequent routes
router.use(adminAuth);

// GET /stats
router.get('/stats', async (req, res) => {
  try {
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [walletFunds] = await pool.query('SELECT SUM(balance) as total FROM users');
    const [fdrFunds] = await pool.query('SELECT SUM(amount) as total FROM fdrs WHERE status = "active"');
    const [cronState] = await pool.query("SELECT value_data FROM system_state WHERE key_name = 'cron_last_run'");

    res.json({
      totalUsers: userCount[0].count || 0,
      totalWalletFunds: walletFunds[0].total || 0,
      totalFdrFunds: fdrFunds[0].total || 0,
      cronLastRun: cronState.length > 0 ? cronState[0].value_data : null
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /methods
router.get('/methods', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payment_methods ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// POST /methods
router.post('/methods', async (req, res) => {
  try {
    const { name, type, is_active, admin_instructions, user_form } = req.body;
    const [result] = await pool.query(
      'INSERT INTO payment_methods (name, type, is_active, admin_instructions, user_form) VALUES (?, ?, ?, ?, ?)',
      [name, type, is_active !== false, JSON.stringify(admin_instructions || []), JSON.stringify(user_form || [])]
    );
    res.json({ id: result.insertId, name, type, is_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment method' });
  }
});

// PUT /methods/:id
router.put('/methods/:id', async (req, res) => {
  try {
    const { is_active, admin_instructions, user_form } = req.body;
    const updates = [];
    const values = [];

    if (typeof is_active !== 'undefined') {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    if (typeof admin_instructions !== 'undefined') {
      updates.push('admin_instructions = ?');
      values.push(JSON.stringify(admin_instructions));
    }
    if (typeof user_form !== 'undefined') {
      updates.push('user_form = ?');
      values.push(JSON.stringify(user_form));
    }

    if (updates.length > 0) {
      values.push(req.params.id);
      await pool.query(`UPDATE payment_methods SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});
// DELETE /methods/:id
router.delete('/methods/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM payment_methods WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// GET /fdr-plans
router.get('/fdr-plans', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM fdr_plans ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch FDR plans' });
  }
});

// POST /fdr-plans
router.post('/fdr-plans', async (req, res) => {
  try {
    const { name, min_amount, max_amount, period_days, interest_percent, duration_days, is_active } = req.body;
    const [result] = await pool.query(
      'INSERT INTO fdr_plans (name, min_amount, max_amount, period_days, interest_percent, duration_days, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, min_amount, max_amount, period_days, interest_percent, duration_days, is_active !== false]
    );
    res.json({ id: result.insertId, name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create FDR plan' });
  }
});

// PUT /fdr-plans/:id
router.put('/fdr-plans/:id', async (req, res) => {
  try {
    const { name, min_amount, max_amount, period_days, interest_percent, duration_days, is_active } = req.body;
    if (typeof name !== 'undefined') {
      await pool.query(
        'UPDATE fdr_plans SET name = ?, min_amount = ?, max_amount = ?, period_days = ?, interest_percent = ?, duration_days = ?, is_active = ? WHERE id = ?',
        [name, min_amount, max_amount, period_days, interest_percent, duration_days, is_active, req.params.id]
      );
    } else {
      await pool.query('UPDATE fdr_plans SET is_active = ? WHERE id = ?', [is_active, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update FDR plan:', err);
    res.status(500).json({ error: 'Failed to update FDR plan' });
  }
});

// DELETE /fdr-plans/:id
router.delete('/fdr-plans/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM fdr_plans WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete FDR plan' });
  }
});

// GET /fdr-offers
router.get('/fdr-offers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM fdr_offers ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch FDR offers' });
  }
});

// POST /fdr-offers
router.post('/fdr-offers', async (req, res) => {
  try {
    const { name, bonus_percent, start_time, end_time, is_active } = req.body;
    if (!name || isNaN(parseFloat(bonus_percent)) || !start_time || !end_time) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO fdr_offers (name, bonus_percent, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, parseFloat(bonus_percent), start_time, end_time, is_active !== false]
    );
    res.json({ id: result.insertId, name, bonus_percent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create FDR offer' });
  }
});

// PUT /fdr-offers/:id
router.put('/fdr-offers/:id', async (req, res) => {
  try {
    const { name, bonus_percent, start_time, end_time, is_active } = req.body;
    const updates = [];
    const values = [];
    if (typeof name !== 'undefined') { updates.push('name = ?'); values.push(name); }
    if (typeof bonus_percent !== 'undefined') { updates.push('bonus_percent = ?'); values.push(parseFloat(bonus_percent)); }
    if (typeof start_time !== 'undefined') { updates.push('start_time = ?'); values.push(start_time); }
    if (typeof end_time !== 'undefined') { updates.push('end_time = ?'); values.push(end_time); }
    if (typeof is_active !== 'undefined') { updates.push('is_active = ?'); values.push(is_active); }
    if (updates.length > 0) {
      values.push(req.params.id);
      await pool.query(`UPDATE fdr_offers SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update FDR offer' });
  }
});

// DELETE /fdr-offers/:id
router.delete('/fdr-offers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM fdr_offers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete FDR offer' });
  }
});

// GET /requests
router.get('/requests', async (req, res) => {
  try {
    const [deposits] = await pool.query(`
      SELECT d.*, u.name as user_name, u.email as user_email 
      FROM deposits d 
      JOIN users u ON d.user_id = u.id 
      ORDER BY d.created_at DESC
    `);
    
    const [withdrawals] = await pool.query(`
      SELECT w.*, u.name as user_name, u.email as user_email 
      FROM withdrawals w 
      JOIN users u ON w.user_id = u.id 
      ORDER BY w.created_at DESC
    `);
    
    res.json({ deposits, withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// POST /deposits/:id/approve
router.post('/deposits/:id/approve', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM deposits WHERE id = ? AND status = "pending" FOR UPDATE', [req.params.id]);
    const deposit = rows[0];
    if (!deposit) throw new Error('Deposit not found or already processed');

    // Check if this is their FIRST approved deposit
    const [pastDeposits] = await conn.query("SELECT COUNT(*) as count FROM deposits WHERE user_id = ? AND status = 'approved'", [deposit.user_id]);
    const isFirstDeposit = pastDeposits[0].count === 0;

    await conn.query('UPDATE deposits SET status = "approved" WHERE id = ?', [req.params.id]);
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(deposit.amount), deposit.user_id]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [deposit.user_id, 'deposit_approved', deposit.amount, `Deposit Approved via ${deposit.payment_method}`]);
    
    // If it's the first deposit, check for referrer and grant percentage commission
    if (isFirstDeposit) {
      const [userRows] = await conn.query('SELECT invited_by FROM users WHERE id = ?', [deposit.user_id]);
      const invitedBy = userRows.length > 0 ? userRows[0].invited_by : null;
      
      if (invitedBy) {
        // Find referral_percent scheme, default to 10% if not found
        const [schemes] = await conn.query("SELECT reward_amount FROM reward_schemes WHERE type = 'referral_percent' AND is_active = true");
        const percent = schemes.length > 0 ? parseFloat(schemes[0].reward_amount) : 10;
        
        const commissionAmount = (parseFloat(deposit.amount) * percent) / 100;
        
        if (commissionAmount > 0) {
          await conn.query("UPDATE users SET referral_balance = referral_balance + ? WHERE id = ?", [commissionAmount, invitedBy]);
          await conn.query("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)", [invitedBy, 'referral_commission', commissionAmount, `Commission (${percent}%) from referee's first deposit`]);
        }
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /deposits/:id/reject
router.post('/deposits/:id/reject', async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE deposits SET status = "rejected" WHERE id = ? AND status = "pending"', [req.params.id]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Request not pending' });
    
    const [rows] = await pool.query('SELECT * FROM deposits WHERE id = ?', [req.params.id]);
    const deposit = rows[0];
    if (deposit) {
      await pool.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [deposit.user_id, 'deposit_rejected', deposit.amount, `Deposit Rejected via ${deposit.payment_method}`]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /withdrawals/:id/approve
router.post('/withdrawals/:id/approve', async (req, res) => {
  try {
    // Balance was already deducted. Just update status.
    const [result] = await pool.query('UPDATE withdrawals SET status = "approved" WHERE id = ? AND status = "pending"', [req.params.id]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Request not pending' });
    
    const [rows] = await pool.query('SELECT * FROM withdrawals WHERE id = ?', [req.params.id]);
    const withdrawal = rows[0];
    if (withdrawal) {
      await pool.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [withdrawal.user_id, 'withdrawal_approved', withdrawal.amount, `Withdrawal Approved via ${withdrawal.payment_method}`]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /withdrawals/:id/reject
router.post('/withdrawals/:id/reject', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM withdrawals WHERE id = ? AND status = "pending" FOR UPDATE', [req.params.id]);
    const withdrawal = rows[0];
    if (!withdrawal) throw new Error('Withdrawal not found or already processed');

    await conn.query('UPDATE withdrawals SET status = "rejected" WHERE id = ?', [req.params.id]);
    
    // Refund the user
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(withdrawal.amount), withdrawal.user_id]);
    
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [withdrawal.user_id, 'withdrawal_rejected', withdrawal.amount, `Withdrawal Rejected (Refunded) via ${withdrawal.payment_method}`]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET /users
router.get('/users', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, phone_number, address, city, state, pin_code, balance, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, phone_number, address, city, state, pin_code } = req.body;
    await pool.query(
      'UPDATE users SET name = ?, email = ?, phone_number = ?, address = ?, city = ?, state = ?, pin_code = ? WHERE id = ?',
      [name, email, phone_number, address, city, state, pin_code, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /users/:id/balance
router.post('/users/:id/balance', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { action, amount, description, wallet_type = 'main' } = req.body;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    const columnMap = {
      'main': 'balance',
      'bonus': 'bonus_balance',
      'referral': 'referral_balance'
    };

    const targetColumn = columnMap[wallet_type] || 'balance';

    await conn.beginTransaction();

    const [userRows] = await conn.query(`SELECT ${targetColumn} FROM users WHERE id = ? FOR UPDATE`, [req.params.id]);
    if (userRows.length === 0) throw new Error('User not found');

    let currentBalance = parseFloat(userRows[0][targetColumn]);
    
    let transactionType = '';
    let transactionAmount = 0;

    if (action === 'add') {
      await conn.query(`UPDATE users SET ${targetColumn} = ${targetColumn} + ? WHERE id = ?`, [numericAmount, req.params.id]);
      transactionType = 'admin_adjustment_add';
      transactionAmount = numericAmount;
    } else if (action === 'subtract') {
      if (currentBalance < numericAmount) throw new Error(`Insufficient ${wallet_type} balance to subtract this amount`);
      await conn.query(`UPDATE users SET ${targetColumn} = ${targetColumn} - ? WHERE id = ?`, [numericAmount, req.params.id]);
      transactionType = 'admin_adjustment_subtract';
      transactionAmount = -numericAmount;
    } else {
      throw new Error('Invalid action');
    }

    const logDescription = description || `Admin adjustment (${action}) to ${wallet_type} wallet`;
    await conn.query(
      'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [req.params.id, transactionType, transactionAmount, logDescription]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('Failed to adjust user balance:', err);
    res.status(500).json({ error: err.message || 'Failed to adjust balance' });
  } finally {
    conn.release();
  }
});

// GET /schemes
router.get('/schemes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reward_schemes ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schemes' });
  }
});

// POST /schemes
router.post('/schemes', async (req, res) => {
  try {
    const { type, min_amount, reward_amount } = req.body;
    await pool.query('INSERT INTO reward_schemes (type, min_amount, reward_amount) VALUES (?, ?, ?)', [type, min_amount || 0, reward_amount]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create scheme' });
  }
});

// PUT /schemes/:id
router.put('/schemes/:id', async (req, res) => {
  try {
    const { is_active } = req.body;
    await pool.query('UPDATE reward_schemes SET is_active = ? WHERE id = ?', [is_active, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update scheme' });
  }
});

// GET /users/:id/details
router.get('/users/:id/details', async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT id, name, email, balance, bonus_balance, referral_balance, locked_balance, locked_bonus_balance, locked_referral_balance, phone_number, address, city, state, pin_code, created_at FROM users WHERE id = ?', [req.params.id]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const [transactions] = await pool.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
    const [fdrs] = await pool.query('SELECT * FROM fdrs WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
    const [locked_funds] = await pool.query('SELECT * FROM locked_funds WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
    
    res.json({
      user: userRows[0],
      transactions,
      fdrs,
      locked_funds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users/:id/fdr/create
router.post('/users/:id/fdr/create', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { amount, plan_id } = req.body;
    let start_date = req.body.start_date;
    if (!start_date) {
      start_date = new Date().toISOString().split('T')[0];
    }
    const userId = req.params.id;

    await conn.beginTransaction();
    
    const [planRows] = await conn.query('SELECT * FROM fdr_plans WHERE id = ?', [plan_id]);
    if (planRows.length === 0) throw new Error('Invalid plan');
    const plan = planRows[0];
    
    if (amount < plan.min_amount) throw new Error(`Minimum amount is ₹${plan.min_amount}`);
    if (amount > plan.max_amount) throw new Error(`Maximum amount is ₹${plan.max_amount}`);
    
    const [userRows] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) throw new Error('User not found');
    
    if (parseFloat(userRows[0].balance) < amount) throw new Error('User has insufficient balance');
    
    await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'fdr_creation_admin', amount, `Admin created FDR: ${plan.name}`]);
    
    // FDR ends after duration_days
    const end_date = new Date(start_date);
    end_date.setDate(end_date.getDate() + parseInt(plan.duration_days, 10));
    
    const nextInstallmentDate = new Date(start_date);
    nextInstallmentDate.setDate(nextInstallmentDate.getDate() + parseInt(plan.period_days, 10));
    
    const [fdrResult] = await conn.query(
      'INSERT INTO fdrs (user_id, amount, start_date, end_date, interest_percent, period_days, next_installment_date, last_installment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, amount, start_date, end_date.toISOString().split('T')[0], parseFloat(plan.interest_percent), parseInt(plan.period_days, 10), nextInstallmentDate.toISOString().split('T')[0], start_date]
    );

    // Apply active percentage offer if any (using actual server time)
    const [offers] = await conn.query(
      'SELECT * FROM fdr_offers WHERE is_active = TRUE AND NOW() BETWEEN start_time AND end_time LIMIT 1'
    );
    if (offers.length > 0) {
      const offer = offers[0];
      const bonusAmount = parseFloat(amount) * (parseFloat(offer.bonus_percent) / 100);
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

    // Apply flat fdr bonus scheme if any
    const [schemes] = await conn.query("SELECT * FROM reward_schemes WHERE type = 'fdr_bonus' AND is_active = true AND min_amount <= ? ORDER BY min_amount DESC LIMIT 1", [amount]);
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
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /users/:id/fdr/:fdrId/close
router.post('/users/:id/fdr/:fdrId/close', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.params.id;
    const fdrId = req.params.fdrId;
    
    await conn.beginTransaction();
    const [fdrRows] = await conn.query('SELECT * FROM fdrs WHERE id = ? AND user_id = ? AND status = "active" FOR UPDATE', [fdrId, userId]);
    if (fdrRows.length === 0) throw new Error('FDR not active or not found');
    
    const fdr = fdrRows[0];
    await conn.query('UPDATE fdrs SET status = "completed" WHERE id = ?', [fdrId]);
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(fdr.amount), userId]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'fdr_closed_admin', fdr.amount, `Admin manually closed FDR #${fdr.id}`]);
    
    // Destroy any locked bonus funds tied to this FDR (since it's being manually closed before normal maturity)
    const [lockedFunds] = await conn.query(
      "SELECT * FROM locked_funds WHERE linked_entity_type = 'fdr' AND linked_entity_id = ? AND user_id = ? AND status = 'locked'",
      [fdrId, userId]
    );

    for (const locked of lockedFunds) {
      await conn.query(
        "UPDATE users SET locked_bonus_balance = locked_bonus_balance - ? WHERE id = ?",
        [parseFloat(locked.amount), userId]
      );
      await conn.query("UPDATE locked_funds SET status = 'cancelled' WHERE id = ?", [locked.id]);
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET /fdrs
router.get('/fdrs', async (req, res) => {
  try {
    const [fdrs] = await pool.query(`
      SELECT f.*, u.name as user_name, u.email as user_email 
      FROM fdrs f 
      JOIN users u ON f.user_id = u.id 
      ORDER BY f.created_at DESC
    `);
    
    const result = fdrs.map((fdr) => ({
      ...fdr,
      amount: parseFloat(fdr.amount),
      interest_percent: parseFloat(fdr.interest_percent),
      accrued_interest: parseFloat(fdr.accrued_interest)
    }));
    
    res.json(result);
  } catch (err) {
    console.error('Failed to fetch global FDR list:', err);
    res.status(500).json({ error: 'Failed to fetch global FDR list' });
  }
});

// PUT /fdrs/:id
router.put('/fdrs/:id', async (req, res) => {
  try {
    const { amount, interest_percent, period_days, start_date, end_date, next_installment_date, status } = req.body;
    await pool.query(
      `UPDATE fdrs 
       SET amount = ?, interest_percent = ?, period_days = ?, start_date = ?, end_date = ?, next_installment_date = ?, status = ? 
       WHERE id = ?`,
      [
        parseFloat(amount),
        parseFloat(interest_percent),
        parseInt(period_days, 10),
        start_date,
        end_date,
        next_installment_date,
        status,
        req.params.id
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update running FDR:', err);
    res.status(500).json({ error: 'Failed to update FDR' });
  }
});

// POST /fdrs/:id/close
router.post('/fdrs/:id/close', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const fdrId = req.params.id;
    await conn.beginTransaction();

    const [fdrRows] = await conn.query('SELECT * FROM fdrs WHERE id = ? AND status = "active" FOR UPDATE', [fdrId]);
    if (fdrRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Active FDR not found' });
    }
    const fdr = fdrRows[0];
    const userId = fdr.user_id;

    await conn.query('UPDATE fdrs SET status = "completed" WHERE id = ?', [fdrId]);
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(fdr.amount), userId]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'fdr_closed_admin', parseFloat(fdr.amount), `Admin manually closed FDR #${fdr.id}`]);
    
    const [lockedFunds] = await conn.query(
      "SELECT * FROM locked_funds WHERE linked_entity_type = 'fdr' AND linked_entity_id = ? AND user_id = ? AND status = 'locked'",
      [fdrId, userId]
    );

    for (const locked of lockedFunds) {
      await conn.query(
        "UPDATE users SET locked_bonus_balance = locked_bonus_balance - ? WHERE id = ?",
        [parseFloat(locked.amount), userId]
      );
      await conn.query("UPDATE locked_funds SET status = 'cancelled' WHERE id = ?", [locked.id]);
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('Failed to manually close FDR:', err);
    res.status(500).json({ error: err.message || 'Failed to close FDR' });
  } finally {
    conn.release();
  }
});

// POST /users/:id/lock-funds
router.post('/users/:id/lock-funds', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.params.id;
    const { wallet_type, amount, reason, unlock_date } = req.body; // wallet_type: normal, bonus, referral
    
    if (amount <= 0) throw new Error("Amount must be greater than 0");

    await conn.beginTransaction();
    const [userRows] = await conn.query('SELECT balance, bonus_balance, referral_balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) throw new Error('User not found');
    const user = userRows[0];
    
    let balanceField = '';
    let lockedField = '';
    
    if (wallet_type === 'normal') { balanceField = 'balance'; lockedField = 'locked_balance'; }
    else if (wallet_type === 'bonus') { balanceField = 'bonus_balance'; lockedField = 'locked_bonus_balance'; }
    else if (wallet_type === 'referral') { balanceField = 'referral_balance'; lockedField = 'locked_referral_balance'; }
    else throw new Error("Invalid wallet type");
    
    if (parseFloat(user[balanceField]) < parseFloat(amount)) throw new Error("Insufficient balance in selected wallet");
    
    await conn.query(`UPDATE users SET ${balanceField} = ${balanceField} - ?, ${lockedField} = ${lockedField} + ? WHERE id = ?`, [amount, amount, userId]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'funds_locked', amount, `Admin locked ${wallet_type} funds: ${reason}`]);
    
    await conn.query(
      'INSERT INTO locked_funds (user_id, wallet_type, amount, linked_entity_type, unlock_date, status) VALUES (?, ?, ?, "manual_admin", ?, "locked")',
      [userId, wallet_type, amount, unlock_date || null]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /users/:id/unlock-funds/:lockId
router.post('/users/:id/unlock-funds/:lockId', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.params.id;
    const lockId = req.params.lockId;
    
    await conn.beginTransaction();
    const [lockRows] = await conn.query('SELECT * FROM locked_funds WHERE id = ? AND user_id = ? AND status = "locked" FOR UPDATE', [lockId, userId]);
    if (lockRows.length === 0) throw new Error('Lock record not found or already unlocked');
    const lock = lockRows[0];
    
    let balanceField = '';
    let lockedField = '';
    
    if (lock.wallet_type === 'normal') { balanceField = 'balance'; lockedField = 'locked_balance'; }
    else if (lock.wallet_type === 'bonus') { balanceField = 'bonus_balance'; lockedField = 'locked_bonus_balance'; }
    else if (lock.wallet_type === 'referral') { balanceField = 'referral_balance'; lockedField = 'locked_referral_balance'; }
    
    await conn.query('UPDATE locked_funds SET status = "unlocked", unlocked_at = NOW() WHERE id = ?', [lockId]);
    await conn.query(`UPDATE users SET ${balanceField} = ${balanceField} + ?, ${lockedField} = ${lockedField} - ? WHERE id = ?`, [lock.amount, lock.amount, userId]);
    await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'funds_unlocked', lock.amount, `Admin manually unlocked ${lock.wallet_type} funds`]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});


// POST /settings/upi
router.post('/settings/upi', async (req, res) => {
  try {
    const { upi_id } = req.body;
    if (!upi_id) return res.status(400).json({ error: 'UPI ID is required' });
    
    await pool.query(
      "INSERT INTO system_state (key_name, value_data) VALUES ('admin_upi_id', ?) ON DUPLICATE KEY UPDATE value_data = ?",
      [upi_id, upi_id]
    );
    res.json({ success: true, admin_upi_id: upi_id });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating UPI ID' });
  }
});

// GET /profile
router.get('/profile', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email FROM admins WHERE id = ?', [req.admin.adminId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin profile' });
  }
});

// PUT /profile
router.put('/profile', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    let query = 'UPDATE admins SET name = ?, email = ?';
    let params = [name || 'Super Admin', email];
    
    if (password && password.trim() !== '') {
      const hash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(hash);
    }
    
    query += ' WHERE id = ?';
    params.push(req.admin.adminId);
    
    await pool.query(query, params);
    
    const [rows] = await pool.query('SELECT id, name, email FROM admins WHERE id = ?', [req.admin.adminId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update admin profile' });
  }
});

// DELETE /users/:id
router.delete('/users/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.params.id;
    await conn.beginTransaction();

    // Check if user exists
    const [userRows] = await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) {
      throw new Error('User not found');
    }

    // Delete in order to respect foreign keys (even if not strictly enforced by ON DELETE CASCADE)
    await conn.query('DELETE FROM locked_funds WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM transactions WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM deposits WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM withdrawals WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM fdrs WHERE user_id = ?', [userId]);
    
    // Finally delete the user
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('Failed to delete user:', err);
    res.status(500).json({ error: err.message || 'Failed to delete user' });
  } finally {
    conn.release();
  }
});

// GET /games
router.get('/games', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM games ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// GET /games/analytics
router.get('/games/analytics', async (req, res) => {
  try {
    // Aviator stats
    const [aviatorBets] = await pool.query(`
      SELECT 
        COUNT(*) as count, 
        SUM(bet_amount) as volume, 
        COUNT(DISTINCT user_id) as unique_players,
        COUNT(DISTINCT CASE WHEN DATE(created_at) = CURDATE() THEN user_id END) as daily_players 
      FROM aviator_bets
    `);
    const [aviatorWins] = await pool.query('SELECT COUNT(*) as count, SUM(win_amount) as volume FROM aviator_bets WHERE status = "cashed_out"');
    const [aviatorLosses] = await pool.query('SELECT COUNT(*) as count FROM aviator_bets WHERE status = "lost"');

    // Colour Trading stats
    const [ctBets] = await pool.query(`
      SELECT 
        COUNT(*) as count, 
        SUM(bet_amount) as volume, 
        COUNT(DISTINCT user_id) as unique_players,
        COUNT(DISTINCT CASE WHEN DATE(created_at) = CURDATE() THEN user_id END) as daily_players 
      FROM ct_bets
    `);
    const [ctWins] = await pool.query('SELECT COUNT(*) as count, SUM(win_amount) as volume FROM ct_bets WHERE status = "won"');
    const [ctLosses] = await pool.query('SELECT COUNT(*) as count FROM ct_bets WHERE status = "lost"');

    const aviator = {
      bets_count: aviatorBets[0].count || 0,
      bets_volume: parseFloat(aviatorBets[0].volume) || 0,
      unique_players: aviatorBets[0].unique_players || 0,
      daily_players: aviatorBets[0].daily_players || 0,
      wins_count: aviatorWins[0].count || 0,
      wins_volume: parseFloat(aviatorWins[0].volume) || 0,
      losses_count: aviatorLosses[0].count || 0,
      pnl: (parseFloat(aviatorBets[0].volume) || 0) - (parseFloat(aviatorWins[0].volume) || 0),
      avg_bet: (parseFloat(aviatorBets[0].volume) || 0) / (aviatorBets[0].count || 1)
    };

    const colourTrading = {
      bets_count: ctBets[0].count || 0,
      bets_volume: parseFloat(ctBets[0].volume) || 0,
      unique_players: ctBets[0].unique_players || 0,
      daily_players: ctBets[0].daily_players || 0,
      wins_count: ctWins[0].count || 0,
      wins_volume: parseFloat(ctWins[0].volume) || 0,
      losses_count: ctLosses[0].count || 0,
      pnl: (parseFloat(ctBets[0].volume) || 0) - (parseFloat(ctWins[0].volume) || 0),
      avg_bet: (parseFloat(ctBets[0].volume) || 0) / (ctBets[0].count || 1)
    };

    const overall = {
      total_volume: aviator.bets_volume + colourTrading.bets_volume,
      total_pnl: aviator.pnl + colourTrading.pnl,
      total_players: aviator.unique_players + colourTrading.unique_players, // estimate
      total_daily_players: aviator.daily_players + colourTrading.daily_players // estimate
    };

    res.json({ aviator, colourTrading, overall });
  } catch (err) {
    console.error('Failed to fetch game analytics:', err);
    res.status(500).json({ error: 'Failed to fetch game analytics' });
  }
});

// GET /games/players
router.get('/games/players', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.name, 
        u.email,
        COALESCE(a.total_aviator_bets, 0) as aviator_bets_count,
        COALESCE(a.total_aviator_wagered, 0) as aviator_wagered,
        COALESCE(a.total_aviator_won, 0) as aviator_won,
        (COALESCE(a.total_aviator_wagered, 0) - COALESCE(a.total_aviator_won, 0)) as aviator_pnl,
        COALESCE(c.total_ct_bets, 0) as ct_bets_count,
        COALESCE(c.total_ct_wagered, 0) as ct_wagered,
        COALESCE(c.total_ct_won, 0) as ct_won,
        (COALESCE(c.total_ct_wagered, 0) - COALESCE(c.total_ct_won, 0)) as ct_pnl,
        (COALESCE(a.total_aviator_wagered, 0) + COALESCE(c.total_ct_wagered, 0)) as total_wagered,
        (COALESCE(a.total_aviator_wagered, 0) + COALESCE(c.total_ct_wagered, 0) - COALESCE(a.total_aviator_won, 0) - COALESCE(c.total_ct_won, 0)) as total_pnl
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as total_aviator_bets, SUM(bet_amount) as total_aviator_wagered, SUM(win_amount) as total_aviator_won
        FROM aviator_bets
        GROUP BY user_id
      ) a ON u.id = a.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as total_ct_bets, SUM(bet_amount) as total_ct_wagered, SUM(win_amount) as total_ct_won
        FROM ct_bets
        GROUP BY user_id
      ) c ON u.id = c.user_id
      WHERE COALESCE(a.total_aviator_bets, 0) > 0 OR COALESCE(c.total_ct_bets, 0) > 0
      ORDER BY total_pnl DESC
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch game players analytics:', err);
    res.status(500).json({ error: 'Failed to fetch game players analytics' });
  }
});

// PUT /games/:id
router.put('/games/:id', async (req, res) => {
  try {
    const { is_active } = req.body;
    await pool.query('UPDATE games SET is_active = ? WHERE id = ?', [is_active !== false, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update game status' });
  }
});

// GET /settings
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value, description FROM system_settings');
    const settings = {};
    rows.forEach(r => settings[r.setting_key] = r.setting_value);
    
    const [upiRows] = await pool.query("SELECT value_data FROM system_state WHERE key_name = 'admin_upi_id'");
    settings.admin_upi_id = upiRows.length > 0 ? upiRows[0].value_data : 'admin@upi';
    
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /settings
router.put('/settings', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { settings } = req.body;
    await conn.beginTransaction();

    for (const [key, value] of Object.entries(settings)) {
      await conn.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, String(value), String(value)]
      );
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('Failed to update settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  } finally {
    conn.release();
  }
});

module.exports = router;
