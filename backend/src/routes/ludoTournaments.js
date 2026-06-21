const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// GET /api/ludo/tournaments — list active + upcoming tournaments
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lt.*,
        (SELECT COUNT(*) FROM ludo_tournament_participants WHERE tournament_id = lt.id) AS participant_count
      FROM ludo_tournaments lt
      WHERE lt.status IN ('upcoming', 'active')
      ORDER BY lt.start_time ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// GET /api/ludo/tournaments/joined — user's joined tournaments (requires auth)
router.get('/joined', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lt.*, ltp.total_score, ltp.matches_played, ltp.\`rank\`, ltp.prize_amount,
        (SELECT COUNT(*) FROM ludo_tournament_participants WHERE tournament_id = lt.id) AS participant_count
      FROM ludo_tournaments lt
      JOIN ludo_tournament_participants ltp ON ltp.tournament_id = lt.id AND ltp.user_id = ?
      ORDER BY lt.start_time DESC
    `, [req.user.userId]);
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch joined tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch joined tournaments' });
  }
});

// GET /api/ludo/tournaments/:id — single tournament details
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lt.*,
        (SELECT COUNT(*) FROM ludo_tournament_participants WHERE tournament_id = lt.id) AS participant_count
      FROM ludo_tournaments lt WHERE lt.id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to fetch tournament:', err);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// POST /api/ludo/tournaments/:id/join — join tournament (requires auth)
router.post('/:id/join', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tournaments] = await conn.query(
      'SELECT * FROM ludo_tournaments WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (tournaments.length === 0) throw new Error('Tournament not found');
    const t = tournaments[0];

    if (t.status === 'cancelled') throw new Error('Tournament has been cancelled');
    if (t.status === 'completed') throw new Error('Tournament has ended');

    // Check participant count
    const [countRows] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM ludo_tournament_participants WHERE tournament_id = ?',
      [t.id]
    );
    if (countRows[0].cnt >= t.max_participants) throw new Error('Tournament is full');

    // Check already joined
    const [existing] = await conn.query(
      'SELECT id FROM ludo_tournament_participants WHERE tournament_id = ? AND user_id = ?',
      [t.id, userId]
    );
    if (existing.length > 0) throw new Error('You have already joined this tournament');

    // Deduct entry fee
    if (parseFloat(t.entry_fee) > 0) {
      const [userRows] = await conn.query(
        'SELECT balance, gaming_bonus_balance FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      if (userRows.length === 0) throw new Error('User not found');

      const mainBal = parseFloat(userRows[0].balance) || 0;
      const bonusBal = parseFloat(userRows[0].gaming_bonus_balance) || 0;
      const totalBal = Math.max(mainBal, bonusBal);

      if (totalBal < parseFloat(t.entry_fee)) throw new Error('Insufficient balance');

      const walletField = bonusBal >= parseFloat(t.entry_fee) ? 'gaming_bonus_balance' : 'balance';
      await conn.query(`UPDATE users SET ${walletField} = ${walletField} - ? WHERE id = ?`, [parseFloat(t.entry_fee), userId]);
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [userId, 'game_bet', -parseFloat(t.entry_fee), `Ludo Tournament Entry "${t.name}"`]
      );
    }

    // Insert participant
    await conn.query(
      'INSERT INTO ludo_tournament_participants (tournament_id, user_id, total_score, matches_played, best_scores) VALUES (?, ?, 0, 0, ?)',
      [t.id, userId, JSON.stringify([])]
    );

    // Auto-activate if start_time reached
    if (t.status === 'upcoming' && new Date(t.start_time) <= new Date()) {
      await conn.query('UPDATE ludo_tournaments SET status = "active" WHERE id = ?', [t.id]);
    }

    await conn.commit();
    res.json({ success: true, message: 'Joined tournament successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET /api/ludo/tournaments/:id/standings — public leaderboard
router.get('/:id/standings', async (req, res) => {
  try {
    const [tournament] = await pool.query('SELECT * FROM ludo_tournaments WHERE id = ?', [req.params.id]);
    if (tournament.length === 0) return res.status(404).json({ error: 'Tournament not found' });

    const [rows] = await pool.query(`
      SELECT ltp.user_id, u.name AS user_name, ltp.total_score, ltp.matches_played, ltp.\`rank\`, ltp.prize_amount
      FROM ludo_tournament_participants ltp
      JOIN users u ON ltp.user_id = u.id
      WHERE ltp.tournament_id = ?
      ORDER BY ltp.total_score DESC
      LIMIT 50
    `, [req.params.id]);

    res.json({ tournament: tournament[0], standings: rows });
  } catch (err) {
    console.error('Failed to fetch standings:', err);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// GET /api/ludo/tournaments/:id/my-stats — current user's stats (requires auth)
router.get('/:id/my-stats', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ltp.*, u.name AS user_name,
        (SELECT COUNT(*) + 1 FROM ludo_tournament_participants ltp2
         WHERE ltp2.tournament_id = ltp.tournament_id AND ltp2.total_score > ltp.total_score) AS current_rank
      FROM ludo_tournament_participants ltp
      JOIN users u ON ltp.user_id = u.id
      WHERE ltp.tournament_id = ? AND ltp.user_id = ?
    `, [req.params.id, req.user.userId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Not participating in this tournament' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to fetch my tournament stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
