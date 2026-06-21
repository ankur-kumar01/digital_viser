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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM ludo_rooms');
    const total = countResult[0].total;

    const [rows] = await pool.query(`
      SELECT lr.*, u1.name AS host_name, u2.name AS challenger_name, uw.name AS winner_name
      FROM ludo_rooms lr
      LEFT JOIN users u1 ON lr.host_id = u1.id
      LEFT JOIN users u2 ON lr.challenger_id = u2.id
      LEFT JOIN users uw ON lr.winner_id = uw.id
      ORDER BY lr.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    res.json({ rooms: rows, total, page, limit });
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

// --- Ludo Tournaments (Admin) ---

// GET /api/admin/ludo/tournaments — list all tournaments
router.get('/tournaments', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lt.*,
        (SELECT COUNT(*) FROM ludo_tournament_participants WHERE tournament_id = lt.id) AS participant_count
      FROM ludo_tournaments lt
      ORDER BY lt.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// POST /api/admin/ludo/tournaments — create tournament
router.post('/tournaments', async (req, res) => {
  const { name, description, entry_fee, prize_pool, max_participants, num_matches, admin_commission, start_time, end_time, prize_brackets } = req.body;
  if (!name || !start_time || !end_time) {
    return res.status(400).json({ error: 'Name, start_time, and end_time are required' });
  }
  if (new Date(end_time) <= new Date(start_time)) {
    return res.status(400).json({ error: 'End time must be after start time' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO ludo_tournaments (name, description, entry_fee, prize_pool, max_participants, num_matches, admin_commission, status, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'upcoming', ?, ?)`,
      [name, description || '', parseFloat(entry_fee) || 0, parseFloat(prize_pool) || 0,
       parseInt(max_participants) || 50, parseInt(num_matches) || 5, parseFloat(admin_commission) || 5,
       start_time, end_time]
    );

    // Insert prize brackets if provided
    if (Array.isArray(prize_brackets) && prize_brackets.length > 0) {
      const values = prize_brackets.map(b => [result.insertId, b.rank_from, b.rank_to, b.prize_percentage]);
      await pool.query(
        'INSERT INTO ludo_tournament_prizes (tournament_id, rank_from, rank_to, prize_percentage) VALUES ?',
        [values]
      );
    } else {
      // Auto-generate default brackets based on participant count
      await autoGeneratePrizeBrackets(result.insertId, parseInt(max_participants) || 50);
    }

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Failed to create tournament:', err);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// PUT /api/admin/ludo/tournaments/:id — update tournament
router.put('/tournaments/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, entry_fee, prize_pool, max_participants, num_matches, admin_commission, start_time, end_time, status, prize_brackets } = req.body;
  try {
    const [existing] = await pool.query('SELECT * FROM ludo_tournaments WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    if (existing[0].status === 'completed') return res.status(400).json({ error: 'Cannot edit completed tournament' });

    const updates = []; const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (entry_fee !== undefined) { updates.push('entry_fee = ?'); params.push(parseFloat(entry_fee)); }
    if (prize_pool !== undefined) { updates.push('prize_pool = ?'); params.push(parseFloat(prize_pool)); }
    if (max_participants !== undefined) { updates.push('max_participants = ?'); params.push(parseInt(max_participants)); }
    if (num_matches !== undefined) { updates.push('num_matches = ?'); params.push(parseInt(num_matches)); }
    if (admin_commission !== undefined) { updates.push('admin_commission = ?'); params.push(parseFloat(admin_commission)); }
    if (start_time !== undefined) { updates.push('start_time = ?'); params.push(start_time); }
    if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time); }
    if (status !== undefined && ['upcoming','active','cancelled'].includes(status)) {
      updates.push('status = ?'); params.push(status);
    }
    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE ludo_tournaments SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Update prize brackets if provided
    if (Array.isArray(prize_brackets)) {
      await pool.query('DELETE FROM ludo_tournament_prizes WHERE tournament_id = ?', [id]);
      if (prize_brackets.length > 0) {
        const values = prize_brackets.map(b => [id, b.rank_from, b.rank_to, b.prize_percentage]);
        await pool.query('INSERT INTO ludo_tournament_prizes (tournament_id, rank_from, rank_to, prize_percentage) VALUES ?', [values]);
      }
    }

    const [updated] = await pool.query('SELECT * FROM ludo_tournaments WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Failed to update tournament:', err);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// DELETE /api/admin/ludo/tournaments/:id — cancel tournament + refund
router.delete('/tournaments/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [tournaments] = await conn.query('SELECT * FROM ludo_tournaments WHERE id = ? FOR UPDATE', [req.params.id]);
    if (tournaments.length === 0) throw new Error('Tournament not found');
    const t = tournaments[0];
    if (t.status === 'completed') throw new Error('Cannot delete completed tournament');

    // Refund all participants
    const [participants] = await conn.query(
      'SELECT user_id FROM ludo_tournament_participants WHERE tournament_id = ?',
      [t.id]
    );
    for (const p of participants) {
      await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(t.entry_fee), p.user_id]);
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [p.user_id, 'refund', parseFloat(t.entry_fee), `Ludo Tournament Refund: "${t.name}"`]
      );
    }
    await conn.query('UPDATE ludo_tournaments SET status = "cancelled" WHERE id = ?', [t.id]);
    await conn.commit();
    res.json({ success: true, message: `Tournament cancelled, ${participants.length} participants refunded` });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET /api/admin/ludo/tournaments/:id/standings — admin view standings
router.get('/tournaments/:id/standings', async (req, res) => {
  try {
    const [tournament] = await pool.query('SELECT * FROM ludo_tournaments WHERE id = ?', [req.params.id]);
    if (tournament.length === 0) return res.status(404).json({ error: 'Tournament not found' });

    const [prizes] = await pool.query('SELECT * FROM ludo_tournament_prizes WHERE tournament_id = ? ORDER BY rank_from', [req.params.id]);
    const [standings] = await pool.query(`
      SELECT ltp.*, u.name AS user_name
      FROM ludo_tournament_participants ltp
      JOIN users u ON ltp.user_id = u.id
      WHERE ltp.tournament_id = ?
      ORDER BY ltp.total_score DESC
    `, [req.params.id]);

    res.json({ tournament: tournament[0], prizes, standings });
  } catch (err) {
    console.error('Failed to fetch tournament standings:', err);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// POST /api/admin/ludo/tournaments/:id/process — force finalize + distribute prizes
router.post('/tournaments/:id/process', async (req, res) => {
  try {
    await finalizeTournament(parseInt(req.params.id), pool);
    res.json({ success: true, message: 'Tournament finalized and prizes distributed' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- helper functions ---

async function autoGeneratePrizeBrackets(tournamentId, maxParticipants) {
  let brackets = [];
  if (maxParticipants <= 10) {
    brackets = [[1,1,50],[2,2,30],[3,3,20]];
  } else if (maxParticipants <= 20) {
    brackets = [[1,1,35],[2,2,25],[3,3,15],[4,5,5],[6,10,2]];
  } else if (maxParticipants <= 50) {
    brackets = [[1,1,30],[2,2,20],[3,3,12],[4,5,5],[6,10,3],[11,20,1]];
  } else if (maxParticipants <= 100) {
    brackets = [[1,1,25],[2,2,15],[3,3,10],[4,5,4],[6,10,2],[11,20,1],[21,50,0.5]];
  } else {
    brackets = [[1,1,20],[2,2,12],[3,3,8],[4,5,3],[6,10,2],[11,20,1],[21,100,0.5]];
  }
  const values = brackets.map(b => [tournamentId, b[0], b[1], b[2]]);
  await pool.query('INSERT INTO ludo_tournament_prizes (tournament_id, rank_from, rank_to, prize_percentage) VALUES ?', [values]);
}

async function finalizeTournament(tournamentId, dbPool) {
  const [tournaments] = await dbPool.query('SELECT * FROM ludo_tournaments WHERE id = ?', [tournamentId]);
  if (tournaments.length === 0) throw new Error('Tournament not found');
  const t = tournaments[0];
  if (t.status === 'completed') throw new Error('Tournament already finalized');
  if (t.status === 'cancelled') throw new Error('Tournament was cancelled');

  const [prizes] = await dbPool.query('SELECT * FROM ludo_tournament_prizes WHERE tournament_id = ? ORDER BY rank_from', [tournamentId]);
  if (prizes.length === 0) throw new Error('No prize brackets configured');

  const [participants] = await dbPool.query(
    'SELECT * FROM ludo_tournament_participants WHERE tournament_id = ? ORDER BY total_score DESC',
    [tournamentId]
  );
  if (participants.length === 0) {
    await dbPool.query('UPDATE ludo_tournaments SET status = "completed" WHERE id = ?', [tournamentId]);
    return;
  }

  const netPool = parseFloat(t.prize_pool) * (1 - parseFloat(t.admin_commission) / 100);
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    let rank = 1;
    for (const p of participants) {
      await conn.query('UPDATE ludo_tournament_participants SET `rank` = ? WHERE id = ?', [rank, p.id]);
      rank++;
    }

    // Distribute prizes per bracket
    for (const bracket of prizes) {
      const from = bracket.rank_from;
      const to = Math.min(bracket.rank_to, participants.length);
      if (from > participants.length) continue;

      const bracketShare = netPool * (parseFloat(bracket.prize_percentage) / 100);
      const count = to - from + 1;
      const perPerson = count > 0 ? Math.floor((bracketShare / count) * 100) / 100 : 0;

      for (let r = from; r <= to; r++) {
        const idx = r - 1;
        if (idx >= participants.length) break;
        const p = participants[idx];
        if (perPerson > 0 && p.user_id < 10000) { // Don't pay bots
          await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [perPerson, p.user_id]);
          await conn.query(
            'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
            [p.user_id, 'game_win', perPerson, `Ludo Tournament Prize: "${t.name}" (#${r})`]
          );
        }
        await conn.query('UPDATE ludo_tournament_participants SET prize_amount = ? WHERE id = ?', [perPerson, p.id]);
      }
    }

    await conn.query('UPDATE ludo_tournaments SET status = "completed" WHERE id = ?', [tournamentId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Export for use in cron
module.exports = router;
module.exports.finalizeTournament = finalizeTournament;
