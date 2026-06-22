const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { SPIN } = require('../constants');

const router = express.Router();
router.use(authMiddleware);

// Helper: Pick a weighted random segment
function pickWeightedSegment(segments) {
  const totalWeight = segments.reduce((sum, s) => sum + s.probability, 0);
  let rand = Math.random() * totalWeight;
  for (const seg of segments) {
    rand -= seg.probability;
    if (rand <= 0) return seg;
  }
  return segments[segments.length - 1];
}

// GET /api/spin/segments — Public list for wheel display
router.get('/segments', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM spin_wheel_segments WHERE is_active = true ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
});

// GET /api/spin/status — Can user spin? Streak info?
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check last spin
    const [lastSpin] = await pool.query(
      'SELECT spun_at FROM user_spin_history WHERE user_id = ? ORDER BY spun_at DESC LIMIT 1',
      [userId]
    );

    // Get streak
    const [streak] = await pool.query(
      'SELECT current_streak, last_spin_date, total_spins FROM user_spin_streaks WHERE user_id = ?',
      [userId]
    );

    // Get gaming bonus balance
    const [user] = await pool.query(
      'SELECT gaming_bonus_balance FROM users WHERE id = ?',
      [userId]
    );

    // Get total deposits
    const [depositResult] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE user_id = ? AND status = 'approved'",
      [userId]
    );
    const total_deposits = parseFloat(depositResult[0].total);

    let can_spin = true;
    let next_spin_at = null;
    let seconds_remaining = 0;

    if (lastSpin.length > 0) {
      const lastSpunAt = new Date(lastSpin[0].spun_at);
      const cooldownMs = SPIN.COOLDOWN_MS;
      const nextAllowed = new Date(lastSpunAt.getTime() + cooldownMs);
      const now = new Date();

      if (now < nextAllowed) {
        can_spin = false;
        next_spin_at = nextAllowed.toISOString();
        seconds_remaining = Math.ceil((nextAllowed - now) / 1000);
      }
    }

    // Get last 5 spins for history display
    const [history] = await pool.query(
      `SELECT ush.prize_amount, ush.prize_type, ush.spun_at, sws.label, sws.emoji, sws.bg_color
       FROM user_spin_history ush
       JOIN spin_wheel_segments sws ON sws.id = ush.segment_id
       WHERE ush.user_id = ?
       ORDER BY ush.spun_at DESC LIMIT 5`,
      [userId]
    );

    res.json({
      can_spin,
      next_spin_at,
      seconds_remaining,
      current_streak: streak.length > 0 ? streak[0].current_streak : 0,
      total_spins: streak.length > 0 ? streak[0].total_spins : 0,
      gaming_bonus_balance: user.length > 0 ? parseFloat(user[0].gaming_bonus_balance) : 0,
      total_deposits,
      spin_history: history
    });
  } catch (err) {
    console.error('Spin status error:', err);
    res.status(500).json({ error: 'Failed to fetch spin status' });
  }
});

// POST /api/spin/claim — Perform the spin
router.post('/claim', async (req, res) => {
  const userId = req.user.userId;

  // 1. Check 24h cooldown (outside transaction to avoid holding connections)
  const [lastSpin] = await pool.query(
    'SELECT spun_at FROM user_spin_history WHERE user_id = ? ORDER BY spun_at DESC LIMIT 1',
    [userId]
  );

  if (lastSpin.length > 0) {
    const lastSpunAt = new Date(lastSpin[0].spun_at);
    const cooldownMs = SPIN.COOLDOWN_MS;
    const nextAllowed = new Date(lastSpunAt.getTime() + cooldownMs);
    if (new Date() < nextAllowed) {
      const secondsLeft = Math.ceil((nextAllowed - new Date()) / 1000);
      const hoursLeft = Math.floor(secondsLeft / 3600);
      const minsLeft = Math.floor((secondsLeft % 3600) / 60);
      return res.status(429).json({
        error: `Already spun today! Next spin in ${hoursLeft}h ${minsLeft}m`,
        next_spin_at: nextAllowed.toISOString(),
        seconds_remaining: secondsLeft
      });
    }
  }

  // 1.5 Check minimum deposit requirement
  const [depositCheck] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE user_id = ? AND status = 'approved'",
    [userId]
  );
  if (parseFloat(depositCheck[0].total) < 100) {
    return res.status(403).json({ error: 'Minimum ₹100 deposit required to spin' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 2. Get active segments
    const [segments] = await conn.query(
      'SELECT * FROM spin_wheel_segments WHERE is_active = true ORDER BY sort_order ASC'
    );
    if (segments.length === 0) {
      await conn.rollback();
      return res.status(500).json({ error: 'No wheel segments configured' });
    }

    // 3. Pick a weighted segment
    const chosen = pickWeightedSegment(segments);

    // 4. Update streak
    const today = new Date().toISOString().split('T')[0];
    const [streakRows] = await conn.query(
      'SELECT * FROM user_spin_streaks WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    let newStreak = 1;
    if (streakRows.length > 0) {
      const last = streakRows[0];
      const lastDate = last.last_spin_date ? new Date(last.last_spin_date).toISOString().split('T')[0] : null;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      if (lastDate === yesterday) {
        // Consecutive day
        newStreak = last.current_streak + 1;
      } else if (lastDate === today) {
        // Already spun today (race condition guard)
        newStreak = last.current_streak;
      } else {
        // Streak broken
        newStreak = 1;
      }

      await conn.query(
        'UPDATE user_spin_streaks SET current_streak = ?, last_spin_date = ?, total_spins = total_spins + 1 WHERE user_id = ?',
        [newStreak, today, userId]
      );
    } else {
      await conn.query(
        'INSERT INTO user_spin_streaks (user_id, current_streak, last_spin_date, total_spins) VALUES (?, 1, ?, 1)',
        [userId, today]
      );
    }

    // 5. Streak day 7 bonus: double the prize
    let finalAmount = parseFloat(chosen.prize_amount);
    let isStreakBonus = false;
    if (newStreak > 0 && newStreak % 7 === 0 && chosen.prize_type === 'gaming_bonus') {
      finalAmount = finalAmount * 2;
      isStreakBonus = true;
    }

    // 6. Credit gaming bonus if applicable
    let newGamingBonusBalance = 0;
    if (chosen.prize_type === 'gaming_bonus' && finalAmount > 0) {
      await conn.query(
        'UPDATE users SET gaming_bonus_balance = gaming_bonus_balance + ? WHERE id = ?',
        [finalAmount, userId]
      );
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [userId, 'gaming_bonus_credit', finalAmount, `Daily Spin Reward: ${chosen.label}${isStreakBonus ? ' (7-Day Streak 2x Bonus!)' : ''}`]
      );
    }

    // 7. Log spin history
    await conn.query(
      'INSERT INTO user_spin_history (user_id, segment_id, prize_amount, prize_type, streak_day) VALUES (?, ?, ?, ?, ?)',
      [userId, chosen.id, finalAmount, chosen.prize_type, newStreak]
    );

    await conn.commit();

    // Fetch updated balance
    const [updatedUser] = await pool.query(
      'SELECT gaming_bonus_balance FROM users WHERE id = ?',
      [userId]
    );
    newGamingBonusBalance = parseFloat(updatedUser[0].gaming_bonus_balance);

    res.json({
      success: true,
      segment: {
        id: chosen.id,
        label: isStreakBonus ? `${chosen.label} (🔥 2x Streak Bonus!)` : chosen.label,
        prize_type: chosen.prize_type,
        prize_amount: finalAmount,
        bg_color: chosen.bg_color,
        emoji: chosen.emoji
      },
      is_streak_bonus: isStreakBonus,
      streak_day: newStreak,
      new_gaming_bonus_balance: newGamingBonusBalance
    });
  } catch (err) {
    await conn.rollback();
    console.error('Spin claim error:', err);
    res.status(500).json({ error: 'Failed to process spin' });
  } finally {
    conn.release();
  }
});

// GET /api/spin/history — User's recent spins
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.query(
      `SELECT ush.id, ush.prize_amount, ush.prize_type, ush.streak_day, ush.spun_at,
              sws.label, sws.emoji, sws.bg_color
       FROM user_spin_history ush
       JOIN spin_wheel_segments sws ON sws.id = ush.segment_id
       WHERE ush.user_id = ?
       ORDER BY ush.spun_at DESC LIMIT 20`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spin history' });
  }
});

module.exports = router;
