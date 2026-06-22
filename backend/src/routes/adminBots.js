const express = require('express');
const { pool } = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

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

router.use(adminAuth);

// Safety net: create game_bots table if migration hasn't run yet
async function ensureBotsTable() {
  try {
    await pool.query(`SELECT 1 FROM game_bots LIMIT 1`);
  } catch (_) {
    console.log('⏹️ game_bots table not found — creating on-the-fly');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_bots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL DEFAULT 'disabled',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      INSERT IGNORE INTO game_bots (id, name, email, password_hash, is_active)
      VALUES (1, 'Guest_7842', 'bot@ludoclash.com', 'disabled', 1)
    `);
  }
}
ensureBotsTable();

// GET /api/admin/bots — list all bots
router.get('/', async (req, res) => {
  try {
    await ensureBotsTable();
    const [rows] = await pool.query(
      'SELECT id, name, email, is_active, created_at, updated_at FROM game_bots ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch bots:', err);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

// POST /api/admin/bots — create a new bot
router.post('/', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  try {
    // Check email uniqueness
    const [existing] = await pool.query('SELECT id FROM game_bots WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A bot with this email already exists' });
    }

    const [result] = await pool.query(
      'INSERT INTO game_bots (name, email, password_hash, is_active) VALUES (?, ?, "disabled", 1)',
      [name, email]
    );

    // Also create corresponding users entry
    const botUserId = 10000 + result.insertId;
    await pool.query(
      'INSERT IGNORE INTO users (id, name, email, password_hash) VALUES (?, ?, ?, "disabled")',
      [botUserId, name, email]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      email,
      is_active: 1,
      userId: botUserId
    });
  } catch (err) {
    console.error('Failed to create bot:', err);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// PUT /api/admin/bots/:id — update a bot
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, is_active } = req.body;
  try {
    const [bots] = await pool.query('SELECT * FROM game_bots WHERE id = ?', [id]);
    if (bots.length === 0) return res.status(404).json({ error: 'Bot not found' });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE game_bots SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Update corresponding users entry
    const botUserId = 10000 + parseInt(id);
    if (name !== undefined) {
      await pool.query('UPDATE users SET name = ? WHERE id = ?', [name, botUserId]);
    }

    const [updated] = await pool.query(
      'SELECT id, name, email, is_active, created_at, updated_at FROM game_bots WHERE id = ?',
      [id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error('Failed to update bot:', err);
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// DELETE /api/admin/bots/:id — delete a bot
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [bots] = await pool.query('SELECT * FROM game_bots WHERE id = ?', [id]);
    if (bots.length === 0) return res.status(404).json({ error: 'Bot not found' });

    const botUserId = 10000 + parseInt(id);
    await pool.query('DELETE FROM game_bots WHERE id = ?', [id]);
    // Soft-delete the users entry (keep for FK integrity but mark inactive)
    await pool.query('UPDATE users SET name = CONCAT(name, "_deleted") WHERE id = ?', [botUserId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete bot:', err);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

module.exports = router;
