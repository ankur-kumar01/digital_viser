const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referral_code } = req.body;

    // Validate all fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Check if email already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Generate unique referral code for new user
    const newReferralCode = 'REF' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);

    let invitedBy = null;
    if (referral_code) {
      const [referrerRows] = await pool.query('SELECT id FROM users WHERE referral_code = ?', [referral_code]);
      if (referrerRows.length > 0) {
        invitedBy = referrerRows[0].id;
      }
    }

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, referral_code, invited_by) VALUES (?, ?, ?, ?, ?)',
      [name, email, password_hash, newReferralCode, invitedBy]
    );

    const userId = result.insertId;

    // Generate JWT
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: userId, name, email, balance: 0.0 },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user by email
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balance: parseFloat(user.balance),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// GET /profile (protected)
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, balance, bonus_balance, gaming_bonus_balance, referral_balance, locked_balance, locked_bonus_balance, locked_referral_balance, referral_code, phone_number, address, city, state, pin_code, profile_photo, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = rows[0];

    // Fallback: If user somehow doesn't have a referral code, generate one now
    if (!user.referral_code) {
      user.referral_code = 'REF' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
      await pool.query('UPDATE users SET referral_code = ? WHERE id = ?', [user.referral_code, user.id]);
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      balance: parseFloat(user.balance),
      bonus_balance: parseFloat(user.bonus_balance || 0),
      gaming_bonus_balance: parseFloat(user.gaming_bonus_balance || 0),
      referral_balance: parseFloat(user.referral_balance || 0),
      locked_balance: parseFloat(user.locked_balance || 0),
      locked_bonus_balance: parseFloat(user.locked_bonus_balance || 0),
      locked_referral_balance: parseFloat(user.locked_referral_balance || 0),
      referral_code: user.referral_code,
      phone_number: user.phone_number,
      address: user.address,
      city: user.city,
      state: user.state,
      pin_code: user.pin_code,
      profile_photo: user.profile_photo,
      created_at: user.created_at,
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

// PUT /profile (protected)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone_number, address, city, state, pin_code, profile_photo } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await pool.query(
      `UPDATE users 
       SET name = ?, phone_number = ?, address = ?, city = ?, state = ?, pin_code = ?, profile_photo = ?
       WHERE id = ?`,
      [name, phone_number || null, address || null, city || null, state || null, pin_code || null, profile_photo || null, req.user.userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error updating profile.' });
  }
});

// GET /referral-stats (protected)
router.get('/referral-stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Get total lifetime referral earnings
    const [earningsRows] = await pool.query(
      `SELECT IFNULL(SUM(amount), 0) AS lifetime_earnings 
       FROM transactions 
       WHERE user_id = ? AND type IN ('referral_commission', 'fdr_referral_commission')`,
      [userId]
    );
    const lifetimeEarnings = earningsRows[0].lifetime_earnings;

    // 2. Get referred users
    const [referredUsers] = await pool.query(
      `SELECT id, name, created_at FROM users WHERE invited_by = ? ORDER BY created_at DESC`,
      [userId]
    );

    const detailedReferrals = [];
    for (const u of referredUsers) {
      // Check if they deposited
      const [depRows] = await pool.query(
        `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND type = 'deposit' AND status = 'completed'`,
        [u.id]
      );
      const hasDeposited = depRows[0].count > 0;

      // Get their total active FDR principal
      const [fdrRows] = await pool.query(
        `SELECT IFNULL(SUM(amount), 0) as total_fdr FROM fdrs WHERE user_id = ? AND status = 'active'`,
        [u.id]
      );
      const activeFdrTotal = parseFloat(fdrRows[0].total_fdr);

      detailedReferrals.push({
        id: u.id,
        name: u.name,
        joined_at: u.created_at,
        has_deposited: hasDeposited,
        active_fdr_total: activeFdrTotal
      });
    }

    res.json({
      lifetime_earnings: parseFloat(lifetimeEarnings),
      referrals: detailedReferrals
    });
  } catch (err) {
    console.error('Referral stats error:', err);
    res.status(500).json({ error: 'Server error fetching referral stats.' });
  }
});

module.exports = router;
