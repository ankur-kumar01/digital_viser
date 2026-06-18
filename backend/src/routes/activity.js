const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /activity/track - log a page visit / app open
router.post('/track', authMiddleware, async (req, res) => {
  try {
    const { page_url } = req.body;
    const user_id = req.user.userId;
    const ip_address = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const user_agent = req.headers['user-agent'] || '';

    await pool.query(
      'INSERT INTO user_activity_log (user_id, page_url, ip_address, user_agent) VALUES (?, ?, ?, ?)',
      [user_id, page_url || '/', ip_address, user_agent]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Activity tracking error:', err);
    res.status(500).json({ error: 'Failed to track activity' });
  }
});

module.exports = router;
