const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

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

// Apply admin middleware to all routes in this file
router.use(adminAuth);

// GET /api/admin/support
// List all tickets
router.get('/', async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    
    let query = `
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }
    if (priority) {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }
    if (search) {
      query += ` AND (t.subject LIKE ? OR u.name LIKE ? OR u.email LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ` ORDER BY t.updated_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch all tickets error:', err);
    res.status(500).json({ error: 'Server error fetching tickets.' });
  }
});

// GET /api/admin/support/:id
// Get a specific ticket and its messages
router.get('/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;

    const [tickets] = await pool.query(
      `SELECT t.*, u.name as user_name, u.email as user_email 
       FROM support_tickets t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.id = ?`,
      [ticketId]
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

// POST /api/admin/support/:id/reply
// Reply to an existing ticket
router.post('/:id/reply', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const [tickets] = await pool.query('SELECT status FROM support_tickets WHERE id = ?', [ticketId]);

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
        [ticketId, 'admin', req.admin.adminId, message]
      );

      // Optionally, set status to pending or keep it open. 'pending' usually implies waiting for user.
      await connection.query(
        'UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['pending', ticketId]
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
    console.error('Admin reply ticket error:', err);
    res.status(500).json({ error: 'Server error replying to ticket.' });
  }
});

// PUT /api/admin/support/:id/status
// Update ticket status or priority
router.put('/:id/status', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status, priority } = req.body;

    let updates = [];
    let params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No status or priority provided.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(ticketId);

    const [result] = await pool.query(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update ticket status error:', err);
    res.status(500).json({ error: 'Server error updating ticket status.' });
  }
});

module.exports = router;
