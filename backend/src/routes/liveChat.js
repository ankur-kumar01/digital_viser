const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer();

// Get or Create user's chat session, and fetch history
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Try to get session
    let [sessions] = await pool.query('SELECT * FROM live_chat_sessions WHERE user_id = ?', [userId]);
    let sessionId;

    if (sessions.length === 0) {
      // Create session
      const [result] = await pool.query('INSERT INTO live_chat_sessions (user_id) VALUES (?)', [userId]);
      sessionId = result.insertId;
      sessions = [{ id: sessionId, user_id: userId, user_unread_count: 0, admin_unread_count: 0 }];
    } else {
      sessionId = sessions[0].id;
      // Mark as read for user
      if (sessions[0].user_unread_count > 0) {
        await pool.query('UPDATE live_chat_sessions SET user_unread_count = 0 WHERE id = ?', [sessionId]);
      }
    }

    const [messages] = await pool.query('SELECT * FROM live_chat_messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId]);

    res.json({
      session: sessions[0],
      messages
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live chat data', details: err.message });
  }
});

// Used primarily for file uploads - text messages are handled via socket.io
router.post('/message', auth, upload.any(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { message, attachment_url } = req.body;
    console.log('Incoming live chat message:', req.body);

    const [sessions] = await pool.query('SELECT id FROM live_chat_sessions WHERE user_id = ?', [userId]);
    if (sessions.length === 0) return res.status(404).json({ error: 'Session not found' });
    const sessionId = sessions[0].id;

    const [result] = await pool.query(
      'INSERT INTO live_chat_messages (session_id, sender_type, message, attachment_url) VALUES (?, ?, ?, ?)',
      [sessionId, 'user', message || '', attachment_url || null]
    );

    await pool.query(
      'UPDATE live_chat_sessions SET last_message_at = CURRENT_TIMESTAMP, admin_unread_count = admin_unread_count + 1 WHERE id = ?',
      [sessionId]
    );

    const [newMsg] = await pool.query('SELECT * FROM live_chat_messages WHERE id = ?', [result.insertId]);

    res.json({ success: true, message: newMsg[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

module.exports = router;
