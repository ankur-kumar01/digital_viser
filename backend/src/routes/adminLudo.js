const express = require('express');
const { pool } = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

router.use(adminAuth);

// --- Ludo Settings ---

// GET /api/admin/ludo/settings
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_key, setting_value, description FROM system_settings WHERE setting_key LIKE 'ludo_%' ORDER BY setting_key"
    );
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (err) {
    console.error('Failed to fetch ludo settings:', err);
    res.status(500).json({ error: 'Failed to fetch ludo settings' });
  }
});

// PUT /api/admin/ludo/settings
router.put('/settings', async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object is required' });
  }
  try {
    for (const [key, value] of Object.entries(settings)) {
      if (!key.startsWith('ludo_')) continue;
      await pool.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, String(value), String(value)]
      );
    }
    const [rows] = await pool.query(
      "SELECT setting_key, setting_value, description FROM system_settings WHERE setting_key LIKE 'ludo_%' ORDER BY setting_key"
    );
    const result = {};
    rows.forEach(r => { result[r.setting_key] = r.setting_value; });
    res.json(result);
  } catch (err) {
    console.error('Failed to update ludo settings:', err);
    res.status(500).json({ error: 'Failed to update ludo settings' });
  }
});

// --- Ludo Rooms Management ---

// GET /api/admin/ludo/rooms
router.get('/rooms', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lr.*, u1.name AS host_name, u2.name AS challenger_name, uw.name AS winner_name
      FROM ludo_rooms lr
      LEFT JOIN users u1 ON lr.host_id = u1.id
      LEFT JOIN users u2 ON lr.challenger_id = u2.id
      LEFT JOIN users uw ON lr.winner_id = uw.id
      ORDER BY lr.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch ludo rooms:', err);
    res.status(500).json({ error: 'Failed to fetch ludo rooms' });
  }
});

// GET /api/admin/ludo/rooms/:id
router.get('/rooms/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lr.*, u1.name AS host_name, u2.name AS challenger_name, uw.name AS winner_name
      FROM ludo_rooms lr
      LEFT JOIN users u1 ON lr.host_id = u1.id
      LEFT JOIN users u2 ON lr.challenger_id = u2.id
      LEFT JOIN users uw ON lr.winner_id = uw.id
      WHERE lr.id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });

    const [moves] = await pool.query(
      'SELECT * FROM ludo_moves WHERE room_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({ room: rows[0], moves });
  } catch (err) {
    console.error('Failed to fetch room details:', err);
    res.status(500).json({ error: 'Failed to fetch room details' });
  }
});

// DELETE /api/admin/ludo/rooms/:id — force cancel/delete a room
router.delete('/rooms/:id', async (req, res) => {
  try {
    const [rooms] = await pool.query('SELECT * FROM ludo_rooms WHERE id = ?', [req.params.id]);
    if (rooms.length === 0) return res.status(404).json({ error: 'Room not found' });

    const room = rooms[0];
    if (room.status === 'playing' || room.status === 'waiting') {
      // Refund both players if playing, or just host if waiting
      if (room.status === 'playing') {
        await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [room.entry_fee, room.host_id]);
        await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [room.entry_fee, room.challenger_id]);
      } else {
        await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [room.entry_fee, room.host_id]);
      }
    }

    await pool.query('UPDATE ludo_rooms SET status = "cancelled" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Room cancelled and refunded' });
  } catch (err) {
    console.error('Failed to cancel room:', err);
    res.status(500).json({ error: 'Failed to cancel room' });
  }
});

// GET /api/admin/ludo/stats — aggregate stats
router.get('/stats', async (req, res) => {
  try {
    const [totalRooms] = await pool.query('SELECT COUNT(*) AS count FROM ludo_rooms');
    const [activeRooms] = await pool.query("SELECT COUNT(*) AS count FROM ludo_rooms WHERE status = 'playing'");
    const [completedRooms] = await pool.query("SELECT COUNT(*) AS count FROM ludo_rooms WHERE status = 'completed'");
    const [totalRevenue] = await pool.query(
      "SELECT COALESCE(SUM(lr.entry_fee * 2 * 0.05), 0) AS revenue FROM ludo_rooms lr WHERE lr.status = 'completed' AND lr.winner_id IS NOT NULL AND lr.winner_id != 9999 AND lr.winner_id < 10000"
    );
    const [totalPlayers] = await pool.query('SELECT COUNT(DISTINCT user_id) AS count FROM ludo_moves');

    res.json({
      totalRooms: totalRooms[0].count,
      activeRooms: activeRooms[0].count,
      completedRooms: completedRooms[0].count,
      totalRevenue: totalRevenue[0].revenue,
      totalPlayers: totalPlayers[0].count
    });
  } catch (err) {
    console.error('Failed to fetch ludo stats:', err);
    res.status(500).json({ error: 'Failed to fetch ludo stats' });
  }
});

module.exports = router;
