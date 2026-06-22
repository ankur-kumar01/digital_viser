const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { sendOtpEmail } = require('../services/emailService');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array().map(e => e.msg).join('. ') });
  }
  next();
};

// POST /register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone_number').optional({ values: 'null' }).trim(),
  body('referral_code').optional({ values: 'null' }).trim(),
  validate
], async (req, res) => {
  try {
    const { name, email, password, phone_number, referral_code } = req.body;

    // Check if email already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // ISSUE-015 FIX: Generate unique referral code with retry on collision
    let newReferralCode;
    let codeIsUnique = false;
    let codeAttempts = 0;
    while (!codeIsUnique && codeAttempts < 5) {
      newReferralCode = 'REF' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 9000 + 1000);
      const [codeCheck] = await pool.query('SELECT id FROM users WHERE referral_code = ? LIMIT 1', [newReferralCode]);
      codeIsUnique = codeCheck.length === 0;
      codeAttempts++;
    }

    let invitedBy = null;
    if (referral_code) {
      const [referrerRows] = await pool.query('SELECT id FROM users WHERE referral_code = ?', [referral_code]);
      if (referrerRows.length > 0) {
        invitedBy = referrerRows[0].id;
      }
    }

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, phone_number, referral_code, invited_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, password_hash, phone_number || null, newReferralCode, invitedBy]
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
    res.status(500).json({ error: 'Server error during registration: ' + err.message });
  }
});

// POST /login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], async (req, res) => {
  try {
    const { email, password, device_info } = req.body;

    // Find user by email
    const [rows] = await pool.query('SELECT id, name, email, password_hash, balance, referral_code FROM users WHERE email = ?', [email]);
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

    // Record login history
    try {
      const ip_address = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
      const user_agent = req.headers['user-agent'] || '';
      await pool.query(
        'INSERT INTO login_history (user_id, ip_address, user_agent, device_info) VALUES (?, ?, ?, ?)',
        [user.id, ip_address, user_agent, device_info || null]
      );
    } catch (logErr) {
      console.error('Failed to record login history:', logErr);
    }

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
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
});

// POST /forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  validate
], async (req, res) => {
  try {
    const { email } = req.body;

    // Always return success to prevent email enumeration
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [userRows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (userRows.length > 0) {
      await pool.query(
        'INSERT INTO password_resets (email, otp_code, expires_at) VALUES (?, ?, ?)',
        [email, otp, expiresAt]
      );
      await sendOtpEmail(email, otp);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    const [rows] = await pool.query(
      'SELECT id FROM password_resets WHERE email = ? AND otp_code = ? AND expires_at > NOW() AND (is_used IS NULL OR is_used = 0) ORDER BY created_at DESC LIMIT 1',
      [email, otp]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // SEC-003 FIX: Mark OTP as used immediately after verification to prevent reuse
    await pool.query(
      'UPDATE password_resets SET is_used = 1 WHERE id = ?',
      [rows[0].id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM password_resets WHERE email = ? AND otp_code = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, otp]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [password_hash, email]);
    await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error.' });
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

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// PUT /profile (protected)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone_number, address, city, state, pin_code, profile_photo } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // SEC-004 FIX: Validate profile_photo URL - must be from our server or empty
    let safeProfilePhoto = null;
    if (profile_photo) {
      const apiBase = process.env.API_BASE_URL || '';
      const isRelative = profile_photo.startsWith('/uploads/') || profile_photo.startsWith('uploads/');
      const isAbsoluteOwn = apiBase && profile_photo.startsWith(apiBase);
      if (isRelative || isAbsoluteOwn) {
        safeProfilePhoto = sanitize(profile_photo);
      } else {
        // Log suspicious external URL attempt, store null
        console.warn(`[SEC] Suspicious profile_photo URL rejected for user ${req.user.userId}: ${profile_photo}`);
      }
    }

    await pool.query(
      `UPDATE users 
       SET name = ?, phone_number = ?, address = ?, city = ?, state = ?, pin_code = ?, profile_photo = ?
       WHERE id = ?`,
      [sanitize(name), sanitize(phone_number) || null, sanitize(address) || null, sanitize(city) || null, sanitize(state) || null, sanitize(pin_code) || null, safeProfilePhoto, req.user.userId]
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

    // 2. Get referred users with deposit and FDR stats in a single query
    const [detailedReferrals] = await pool.query(
      `SELECT
         u.id, u.name, u.created_at AS joined_at,
         IFNULL(d.deposit_count, 0) > 0 AS has_deposited,
         IFNULL(f.active_fdr_total, 0) AS active_fdr_total
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS deposit_count
         FROM deposits WHERE status = 'approved'
         GROUP BY user_id
       ) d ON d.user_id = u.id
       LEFT JOIN (
         SELECT user_id, IFNULL(SUM(amount), 0) AS active_fdr_total
         FROM fdrs WHERE status = 'active'
         GROUP BY user_id
       ) f ON f.user_id = u.id
       WHERE u.invited_by = ?
       ORDER BY u.created_at DESC`,
      [userId]
    );

    res.json({
      lifetime_earnings: parseFloat(lifetimeEarnings),
      referrals: detailedReferrals.map(r => ({
        ...r,
        active_fdr_total: parseFloat(r.active_fdr_total)
      }))
    });
  } catch (err) {
    console.error('Referral stats error:', err);
    res.status(500).json({ error: 'Server error fetching referral stats.' });
  }
});

module.exports = router;
