const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkEligibility } = require('../services/audienceResolver');

const router = express.Router();
router.use(authMiddleware);

// GET /api/yield-boosters
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get simulated date
    const [stateRows] = await pool.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    // Fetch user's claimed boosters
    const [claimedRows] = await pool.query(
      `SELECT uyb.id as user_booster_id, uyb.booster_id, uyb.status, uyb.activated_at, uyb.expires_at,
              b.name, b.description, b.yield_boost_percent, b.duration_days, b.target_type
       FROM user_yield_boosters uyb
       JOIN fdr_yield_boosters b ON uyb.booster_id = b.id
       WHERE uyb.user_id = ?
       ORDER BY uyb.activated_at DESC`,
      [userId]
    );

    const active = [];
    const completed = [];

    claimedRows.forEach(row => {
      // booster is active if status is 'active' and expires_at is >= simulatedDate
      const expiresDateStr = row.expires_at.split(' ')[0] || new Date(row.expires_at).toISOString().split('T')[0];
      if (row.status === 'active' && expiresDateStr >= simulatedDate) {
        active.push(row);
      } else {
        completed.push(row);
      }
    });

    // Fetch all active booster configs
    const [boosterConfigs] = await pool.query(
      `SELECT * FROM fdr_yield_boosters WHERE is_active = TRUE`
    );

    const claimable = [];

    for (const config of boosterConfigs) {
      // Check if user already has an active activation of this booster
      const alreadyActive = active.some(a => a.booster_id === config.id);
      if (alreadyActive) {
        continue;
      }

      // Check eligibility
      const isEligible = await checkEligibility(userId, config.target_type, config);
      if (isEligible) {
        claimable.push(config);
      }
    }

    res.json({
      active,
      completed,
      claimable,
      simulatedDate
    });
  } catch (err) {
    console.error('Error fetching yield boosters:', err);
    res.status(500).json({ error: 'Server error fetching yield boosters.' });
  }
});

// POST /api/yield-boosters/:id/claim
router.post('/:id/claim', async (req, res) => {
  const boosterId = parseInt(req.params.id, 10);
  const userId = req.user.userId;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch booster config
    const [configs] = await conn.query(
      'SELECT * FROM fdr_yield_boosters WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [boosterId]
    );
    if (configs.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Active Yield Booster not found.' });
    }
    const booster = configs[0];

    // 2. Fetch simulated date
    const [stateRows] = await conn.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    // 3. Check if already active
    const [activeCheck] = await conn.query(
      `SELECT id FROM user_yield_boosters 
       WHERE user_id = ? AND booster_id = ? AND status = 'active' AND DATE(expires_at) >= DATE(?)`,
      [userId, boosterId, simulatedDate]
    );

    if (activeCheck.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'You already have this yield booster active.' });
    }

    // 4. Check eligibility
    const isEligible = await checkEligibility(userId, booster.target_type, booster);
    if (!isEligible) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'You are not eligible for this offer.' });
    }

    // 5. Insert activation
    // Use simulatedDate + duration_days to calculate expires_at
    await conn.query(
      `INSERT INTO user_yield_boosters (user_id, booster_id, status, activated_at, expires_at)
       VALUES (?, ?, 'active', DATE(?), DATE_ADD(DATE(?), INTERVAL ? DAY))`,
      [userId, boosterId, simulatedDate, simulatedDate, booster.duration_days]
    );

    await conn.commit();
    res.json({ message: 'Yield booster successfully claimed and activated!' });
  } catch (err) {
    await conn.rollback();
    console.error('Error claiming yield booster:', err);
    res.status(500).json({ error: 'Server error claiming yield booster.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
