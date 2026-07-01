const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const upload = multer();

const JWT_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;

const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all active sessions
router.get('/sessions', adminAuth, async (req, res) => {
  try {
    const [sessions] = await pool.query(`
      SELECT s.*, u.name, u.email, u.phone_number 
      FROM live_chat_sessions s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.last_message_at DESC
    `);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions', details: err.message });
  }
});

// Get messages for a specific session
router.get('/sessions/:id/messages', adminAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const [messages] = await pool.query('SELECT * FROM live_chat_messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId]);
    
    // Mark as read for admin
    await pool.query('UPDATE live_chat_sessions SET admin_unread_count = 0 WHERE id = ?', [sessionId]);

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages', details: err.message });
  }
});

// Post message via API (primarily for attachments)
router.post('/sessions/:id/message', adminAuth, upload.any(), async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { message, attachment_url } = req.body;

    const [result] = await pool.query(
      'INSERT INTO live_chat_messages (session_id, sender_type, message, attachment_url) VALUES (?, ?, ?, ?)',
      [sessionId, 'admin', message || '', attachment_url || null]
    );

    await pool.query(
      'UPDATE live_chat_sessions SET last_message_at = CURRENT_TIMESTAMP, user_unread_count = user_unread_count + 1 WHERE id = ?',
      [sessionId]
    );

    const [newMsg] = await pool.query('SELECT * FROM live_chat_messages WHERE id = ?', [result.insertId]);

    res.json({ success: true, message: newMsg[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

module.exports = router;
