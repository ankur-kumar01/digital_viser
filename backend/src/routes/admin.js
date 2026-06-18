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
    const [users] = await pool.query('SELECT u.id, u.name, u.email, u.phone_number, u.address, u.city, u.state, u.pin_code, u.balance, u.created_at, u.invited_by, i.name as invited_by_name FROM users u LEFT JOIN users i ON u.invited_by = i.id ORDER BY u.created_at DESC');
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

// PUT /users/:id/invited-by
router.put('/users/:id/invited-by', async (req, res) => {
  try {
    const { invited_by } = req.body;
    // invited_by can be null/empty to remove referrer, or a valid user ID.
    const newInvitedBy = invited_by ? parseInt(invited_by) : null;
    
    if (newInvitedBy && newInvitedBy === parseInt(req.params.id)) {
      return res.status(400).json({ error: 'User cannot invite themselves' });
    }

    if (newInvitedBy) {
      // verify the referrer exists
      const [referrer] = await pool.query('SELECT id FROM users WHERE id = ?', [newInvitedBy]);
      if (referrer.length === 0) {
        return res.status(400).json({ error: 'Referrer ID not found' });
      }
    }

    await pool.query(
      'UPDATE users SET invited_by = ? WHERE id = ?',
      [newInvitedBy, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update invited_by:', err);
    res.status(500).json({ error: 'Failed to update referrer' });
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
      'referral': 'referral_balance',
      'gaming_bonus': 'gaming_bonus_balance'
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
    const { type, min_amount, reward_amount, is_active } = req.body;
    const updates = [];
    const values = [];
    if (typeof type !== 'undefined') { updates.push('type = ?'); values.push(type); }
    if (typeof min_amount !== 'undefined') { updates.push('min_amount = ?'); values.push(min_amount); }
    if (typeof reward_amount !== 'undefined') { updates.push('reward_amount = ?'); values.push(reward_amount); }
    if (typeof is_active !== 'undefined') { updates.push('is_active = ?'); values.push(is_active); }
    if (updates.length > 0) {
      values.push(req.params.id);
      await pool.query(`UPDATE reward_schemes SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update scheme' });
  }
});

// DELETE /schemes/:id
router.delete('/schemes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM reward_schemes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete scheme' });
  }
});

// GET /users/:id/details
router.get('/users/:id/details', async (req, res) => {
  try {
    const [userRows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.balance, u.bonus_balance, u.referral_balance, u.gaming_bonus_balance, 
              u.locked_balance, u.locked_bonus_balance, u.locked_referral_balance, u.phone_number, u.address, 
              u.city, u.state, u.pin_code, u.created_at, u.invited_by, i.name as invited_by_name 
       FROM users u 
       LEFT JOIN users i ON u.invited_by = i.id 
       WHERE u.id = ?`, 
      [req.params.id]
    );
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
    await conn.query('DELETE FROM aviator_bets WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM ct_bets WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM fruit_bets WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM user_spin_history WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM user_spin_streaks WHERE user_id = ?', [userId]);
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

// --- BIG WINS TICKER CRUD ---

// GET /admin/big-wins
router.get('/big-wins', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM big_wins ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch big wins' });
  }
});

// POST /admin/big-wins
router.post('/big-wins', async (req, res) => {
  const { user_name, amount, game_name, game_color } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO big_wins (user_name, amount, game_name, game_color) VALUES (?, ?, ?, ?)',
      [user_name, amount, game_name, game_color]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create big win' });
  }
});

// PUT /admin/big-wins/:id
router.put('/big-wins/:id', async (req, res) => {
  const { id } = req.params;
  const { user_name, amount, game_name, game_color } = req.body;
  try {
    await pool.query(
      'UPDATE big_wins SET user_name = ?, amount = ?, game_name = ?, game_color = ? WHERE id = ?',
      [user_name, amount, game_name, game_color, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update big win' });
  }
});

// DELETE /admin/big-wins/:id
router.delete('/big-wins/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM big_wins WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete big win' });
  }
});

// --- GAME SIMULATIONS CRUD ---

// Aviator Chats
router.get('/simulations/aviator-chats', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM simulated_aviator_chats ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.post('/simulations/aviator-chats', async (req, res) => {
  const { user_name, message_type, message_text } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO simulated_aviator_chats (user_name, message_type, message_text) VALUES (?, ?, ?)', [user_name, message_type, message_text]);
    res.json({ success: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.put('/simulations/aviator-chats/:id', async (req, res) => {
  const { user_name, message_type, message_text } = req.body;
  try {
    await pool.query('UPDATE simulated_aviator_chats SET user_name=?, message_type=?, message_text=? WHERE id=?', [user_name, message_type, message_text, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.delete('/simulations/aviator-chats/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM simulated_aviator_chats WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Aviator Bets
router.get('/simulations/aviator-bets', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM simulated_aviator_bets ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.post('/simulations/aviator-bets', async (req, res) => {
  const { user_name, bet_amount, target_multiplier } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO simulated_aviator_bets (user_name, bet_amount, target_multiplier) VALUES (?, ?, ?)', [user_name, bet_amount, target_multiplier]);
    res.json({ success: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.put('/simulations/aviator-bets/:id', async (req, res) => {
  const { user_name, bet_amount, target_multiplier } = req.body;
  try {
    await pool.query('UPDATE simulated_aviator_bets SET user_name=?, bet_amount=?, target_multiplier=? WHERE id=?', [user_name, bet_amount, target_multiplier, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.delete('/simulations/aviator-bets/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM simulated_aviator_bets WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Colour Trading Bets
router.get('/simulations/colour-trading-bets', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM simulated_colour_trading_bets ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.post('/simulations/colour-trading-bets', async (req, res) => {
  const { user_name, bet_amount, color_choice } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO simulated_colour_trading_bets (user_name, bet_amount, color_choice) VALUES (?, ?, ?)', [user_name, bet_amount, color_choice]);
    res.json({ success: true, id: result.insertId });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.put('/simulations/colour-trading-bets/:id', async (req, res) => {
  const { user_name, bet_amount, color_choice } = req.body;
  try {
    await pool.query('UPDATE simulated_colour_trading_bets SET user_name=?, bet_amount=?, color_choice=? WHERE id=?', [user_name, bet_amount, color_choice, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});
router.delete('/simulations/colour-trading-bets/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM simulated_colour_trading_bets WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
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

// ============================================================
// SPIN WHEEL ADMIN ROUTES
// ============================================================

// GET /admin/spin-segments
router.get('/spin-segments', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM spin_wheel_segments ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spin segments' });
  }
});

// POST /admin/spin-segments
router.post('/spin-segments', async (req, res) => {
  try {
    const { label, prize_type, prize_amount, probability, bg_color, text_color, emoji, is_active, sort_order } = req.body;
    if (!label || !prize_type || probability === undefined) {
      return res.status(400).json({ error: 'label, prize_type, and probability are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO spin_wheel_segments (label, prize_type, prize_amount, probability, bg_color, text_color, emoji, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [label, prize_type, prize_amount || 0, probability, bg_color || '#22c55e', text_color || '#ffffff', emoji || '🎁', is_active !== false, sort_order || 0]
    );
    const [newRow] = await pool.query('SELECT * FROM spin_wheel_segments WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create spin segment' });
  }
});

// PUT /admin/spin-segments/:id
router.put('/spin-segments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, prize_type, prize_amount, probability, bg_color, text_color, emoji, is_active, sort_order } = req.body;
    await pool.query(
      'UPDATE spin_wheel_segments SET label=?, prize_type=?, prize_amount=?, probability=?, bg_color=?, text_color=?, emoji=?, is_active=?, sort_order=? WHERE id=?',
      [label, prize_type, prize_amount || 0, probability, bg_color || '#22c55e', text_color || '#ffffff', emoji || '🎁', is_active !== false, sort_order || 0, id]
    );
    const [updated] = await pool.query('SELECT * FROM spin_wheel_segments WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update spin segment' });
  }
});

// DELETE /admin/spin-segments/:id
router.delete('/spin-segments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM spin_wheel_segments WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete spin segment' });
  }
});

// GET /admin/spin-history
router.get('/spin-history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ush.id, ush.prize_amount, ush.prize_type, ush.streak_day, ush.spun_at,
              u.name as user_name, u.email as user_email,
              sws.label as segment_label, sws.emoji
       FROM user_spin_history ush
       JOIN users u ON u.id = ush.user_id
       JOIN spin_wheel_segments sws ON sws.id = ush.segment_id
       ORDER BY ush.spun_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spin history' });
  }
});

// DELETE /admin/spin-history/:id
router.delete('/spin-history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM user_spin_history WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete spin history' });
  }
});

// GET /admin/spin-stats
router.get('/spin-stats', async (req, res) => {
  try {
    const [totalSpins] = await pool.query('SELECT COUNT(*) as count FROM user_spin_history');
    const [totalBonus] = await pool.query(
      "SELECT COALESCE(SUM(prize_amount),0) as total FROM user_spin_history WHERE prize_type = 'gaming_bonus'"
    );
    const [todaySpins] = await pool.query(
      'SELECT COUNT(*) as count FROM user_spin_history WHERE DATE(spun_at) = CURDATE()'
    );
    const [todayBonus] = await pool.query(
      "SELECT COALESCE(SUM(prize_amount),0) as total FROM user_spin_history WHERE prize_type = 'gaming_bonus' AND DATE(spun_at) = CURDATE()"
    );
    res.json({
      total_spins: totalSpins[0].count,
      total_gaming_bonus_distributed: parseFloat(totalBonus[0].total),
      today_spins: todaySpins[0].count,
      today_gaming_bonus_distributed: parseFloat(todayBonus[0].total)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spin stats' });
  }
});

// GET /referrals/stats
router.get('/referrals/stats', async (req, res) => {
  try {
    // Total users who have referred someone
    const [referrersRows] = await pool.query('SELECT COUNT(DISTINCT invited_by) as count FROM users WHERE invited_by IS NOT NULL');
    
    // Total users who were referred
    const [referredRows] = await pool.query('SELECT COUNT(*) as count FROM users WHERE invited_by IS NOT NULL');
    
    // Total 1st deposit commissions paid
    const [firstDepRows] = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'referral_commission'");
    
    // Total FDR recurring commissions currently locked
    const [lockedFdrRows] = await pool.query("SELECT COALESCE(SUM(locked_referral_balance), 0) as total FROM users");
    
    // Total FDR recurring commissions released historically
    const [releasedFdrRows] = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'funds_unlocked_manual' AND description LIKE '%referral%'");

    // Top Referrers
    const [topReferrers] = await pool.query(`
      SELECT u.id, u.name, COUNT(r.id) as total_referrals, COALESCE(SUM(t.amount), 0) as total_earned
      FROM users u
      LEFT JOIN users r ON r.invited_by = u.id
      LEFT JOIN transactions t ON t.user_id = u.id AND t.type IN ('referral_commission', 'fdr_referral_commission')
      WHERE u.id IN (SELECT DISTINCT invited_by FROM users WHERE invited_by IS NOT NULL)
      GROUP BY u.id
      ORDER BY total_referrals DESC
      LIMIT 10
    `);

    res.json({
      total_referrers: referrersRows[0].count,
      total_referred: referredRows[0].count,
      total_first_deposit_paid: parseFloat(firstDepRows[0].total),
      total_fdr_locked: parseFloat(lockedFdrRows[0].total),
      total_fdr_released: parseFloat(releasedFdrRows[0].total),
      top_referrers: topReferrers
    });
  } catch (err) {
    console.error('Failed to fetch referral stats:', err);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});



// POST /referrals/release-locked
router.post('/referrals/release-locked', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Select all users with > 0 locked referral balance
    const [usersWithLockedFunds] = await conn.query("SELECT id, locked_referral_balance FROM users WHERE locked_referral_balance > 0 FOR UPDATE");

    let totalReleased = 0;

    for (const u of usersWithLockedFunds) {
      const amount = parseFloat(u.locked_referral_balance);
      
      await conn.query(
        "UPDATE users SET locked_referral_balance = 0, referral_balance = referral_balance + ? WHERE id = ?",
        [amount, u.id]
      );

      await conn.query(
        "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)",
        [u.id, 'funds_unlocked_manual', amount, `Admin released monthly recurring FDR referral commission`]
      );

      totalReleased += amount;
    }

    await conn.commit();
    res.json({ success: true, total_released: totalReleased, users_affected: usersWithLockedFunds.length });
  } catch (err) {
    await conn.rollback();
    console.error('Failed to release locked funds:', err);
    res.status(500).json({ error: 'Failed to release funds' });
  } finally {
    conn.release();
  }
});

// GET /admin/transactions - All transactions with user info, paginated
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM transactions');
    const total = countResult[0].total;

    const [rows] = await pool.query(`
      SELECT t.*, u.name as user_name, u.email as user_email 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      transactions: rows.map(r => ({ ...r, amount: parseFloat(r.amount) })),
      total,
      page,
      limit
    });
  } catch (err) {
    console.error('Failed to fetch transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /admin/bets - All bets from all games with user info, paginated
router.get('/bets', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM (
        SELECT id FROM aviator_bets
        UNION ALL
        SELECT id FROM ct_bets
        UNION ALL
        SELECT id FROM fruit_bets
      ) combined
    `);
    const total = countResult[0].total;

    const [rows] = await pool.query(`
      SELECT * FROM (
        SELECT 
          b.id, b.user_id, u.name as user_name, u.email as user_email,
          b.bet_amount, b.win_amount, b.status, b.created_at,
          'aviator' as game_type,
          b.round_id, b.cashout_multiplier, NULL as color
        FROM aviator_bets b
        JOIN users u ON b.user_id = u.id
        UNION ALL
        SELECT 
          b.id, b.user_id, u.name as user_name, u.email as user_email,
          b.bet_amount, b.win_amount, b.status, b.created_at,
          'colour_trading' as game_type,
          b.round_id, NULL as cashout_multiplier, b.color
        FROM ct_bets b
        JOIN users u ON b.user_id = u.id
        UNION ALL
        SELECT 
          b.id, b.user_id, u.name as user_name, u.email as user_email,
          b.bet_amount, b.win_amount, b.status, b.created_at,
          'fruit_slasher' as game_type,
          NULL as round_id, b.multiplier_reached as cashout_multiplier, NULL as color
        FROM fruit_bets b
        JOIN users u ON b.user_id = u.id
      ) all_bets
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const parsed = rows.map(r => ({
      ...r,
      bet_amount: parseFloat(r.bet_amount),
      win_amount: r.win_amount ? parseFloat(r.win_amount) : null,
      cashout_multiplier: r.cashout_multiplier ? parseFloat(r.cashout_multiplier) : null
    }));

    res.json({ bets: parsed, total, page, limit });
  } catch (err) {
    console.error('Failed to fetch bets:', err);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// GET /admin/login-history
router.get('/login-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM login_history');
    const total = countResult[0].total;

    const [rows] = await pool.query(`
      SELECT lh.*, u.name as user_name, u.email as user_email
      FROM login_history lh
      JOIN users u ON lh.user_id = u.id
      ORDER BY lh.login_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({ history: rows, total, page, limit });
  } catch (err) {
    console.error('Failed to fetch login history:', err);
    res.status(500).json({ error: 'Failed to fetch login history' });
  }
});

// GET /admin/activity-log
router.get('/activity-log', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM user_activity_log');
    const total = countResult[0].total;

    const [rows] = await pool.query(`
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM user_activity_log al
      JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({ activity: rows, total, page, limit });
  } catch (err) {
    console.error('Failed to fetch activity log:', err);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// GET /admin/active-users
router.get('/active-users', async (req, res) => {
  try {
    const period = req.query.period || '24h';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let hours;
    let dateFilter;
    const now = new Date();

    switch (period) {
      case '1h':
        hours = 1;
        dateFilter = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        hours = 24;
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'yesterday': {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        const endOfYesterday = new Date(startOfToday.getTime() - 1);
        dateFilter = startOfYesterday;
        const [countResult] = await pool.query(`
          SELECT COUNT(DISTINCT al.user_id) as total
          FROM user_activity_log al
          WHERE al.created_at >= ? AND al.created_at <= ?
        `, [startOfYesterday, endOfYesterday]);
        const total_yesterday = countResult[0].total;
        const [rows] = await pool.query(`
          SELECT al.user_id, u.name as user_name, u.email as user_email,
                 MAX(al.created_at) as last_active,
                 COUNT(al.id) as page_visits
          FROM user_activity_log al
          JOIN users u ON al.user_id = u.id
          WHERE al.created_at >= ? AND al.created_at <= ?
          GROUP BY al.user_id, u.name, u.email
          ORDER BY last_active DESC
          LIMIT ? OFFSET ?
        `, [startOfYesterday, endOfYesterday, limit, offset]);
        return res.json({ users: rows, total: total_yesterday, page, limit, period });
      }
      case 'last7days':
        hours = 168;
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        hours = 24;
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const [countResult] = await pool.query(`
      SELECT COUNT(DISTINCT al.user_id) as total
      FROM user_activity_log al
      WHERE al.created_at >= ?
    `, [dateFilter]);

    const total = countResult[0].total;

    const [rows] = await pool.query(`
      SELECT al.user_id, u.name as user_name, u.email as user_email,
             MAX(al.created_at) as last_active,
             COUNT(al.id) as page_visits
      FROM user_activity_log al
      JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= ?
      GROUP BY al.user_id, u.name, u.email
      ORDER BY last_active DESC
      LIMIT ? OFFSET ?
    `, [dateFilter, limit, offset]);

    res.json({ users: rows, total, page, limit, period });
  } catch (err) {
    console.error('Failed to fetch active users:', err);
    res.status(500).json({ error: 'Failed to fetch active users' });
  }
});

module.exports = router;
