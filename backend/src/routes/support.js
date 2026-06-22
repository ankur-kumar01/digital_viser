const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/support
// List all tickets for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch tickets error:', err);
    res.status(500).json({ error: 'Server error fetching tickets.' });
  }
});

// POST /api/support
// Create a new support ticket
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { subject, category, priority, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [ticketResult] = await connection.query(
        'INSERT INTO support_tickets (user_id, subject, category, priority, status) VALUES (?, ?, ?, ?, ?)',
        [req.user.userId, subject, category || 'general', priority || 'medium', 'open']
      );

      const ticketId = ticketResult.insertId;

      await connection.query(
        'INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?)',
        [ticketId, 'user', req.user.userId, message]
      );

      await connection.commit();
      res.status(201).json({ success: true, ticketId });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Server error creating ticket.' });
  }
});

// GET /api/support/:id
// Get a specific ticket and its messages
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const ticketId = req.params.id;

    const [tickets] = await pool.query(
      'SELECT * FROM support_tickets WHERE id = ? AND user_id = ?',
      [ticketId, req.user.userId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const [messages] = await pool.query(
      'SELECT * FROM support_ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticketId]
    );

    res.json({ ticket: tickets[0], messages });
  } catch (err) {
    console.error('Fetch ticket details error:', err);
    res.status(500).json({ error: 'Server error fetching ticket details.' });
  }
});

// POST /api/support/:id/reply
// Reply to an existing ticket
router.post('/:id/reply', authMiddleware, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const [tickets] = await pool.query(
      'SELECT status FROM support_tickets WHERE id = ? AND user_id = ?',
      [ticketId, req.user.userId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    if (tickets[0].status === 'closed') {
      return res.status(400).json({ error: 'Cannot reply to a closed ticket.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        'INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?)',
        [ticketId, 'user', req.user.userId, message]
      );

      await connection.query(
        'UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['open', ticketId]
      );

      await connection.commit();
      res.json({ success: true });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Reply ticket error:', err);
    res.status(500).json({ error: 'Server error replying to ticket.' });
  }
});

// PUT /api/support/:id/close
// Close a ticket
router.put('/:id/close', authMiddleware, async (req, res) => {
  try {
    const ticketId = req.params.id;

    const [result] = await pool.query(
      'UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      ['closed', ticketId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ticket not found or could not be updated.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Close ticket error:', err);
    res.status(500).json({ error: 'Server error closing ticket.' });
  }
});

module.exports = router;
