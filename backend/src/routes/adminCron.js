const express = require('express');
const { pool } = require('../db');
const jwt = require('jsonwebtoken');
const { jobs, runJob } = require('../services/cronManager');

const router = express.Router();

const JWT_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;

const adminAuthMiddleware = (req, res, next) => {
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

router.use(adminAuthMiddleware);

// GET /api/admin/cron/jobs
router.get('/jobs', async (req, res) => {
  try {
    // Query last run details for each job
    const [lastRuns] = await pool.query(`
      SELECT ch1.* 
      FROM cron_history ch1
      INNER JOIN (
        SELECT cron_name, MAX(id) as max_id 
        FROM cron_history 
        GROUP BY cron_name
      ) ch2 ON ch1.id = ch2.max_id
    `);

    const runsMap = {};
    lastRuns.forEach(run => {
      runsMap[run.cron_name] = {
        id: run.id,
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        details: run.details,
        error_message: run.error_message
      };
    });

    const jobsList = Object.keys(jobs).map(key => {
      const job = jobs[key];
      return {
        key: job.key,
        name: job.name,
        schedule: job.schedule,
        description: job.description,
        last_run: runsMap[key] || null
      };
    });

    res.json({ jobs: jobsList });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs: ' + err.message });
  }
});

// GET /api/admin/cron/settings
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT key_name, value_data FROM system_state WHERE key_name IN ('cron_global_enabled', 'cron_enabled_daily_financials', 'cron_enabled_fantasy_sync_matches', 'cron_enabled_fantasy_sync_squads', 'cron_enabled_fantasy_process_live', 'cron_enabled_ludo_cleanup', 'cron_enabled_ludo_tournaments')"
    );

    const settings = {
      cron_global_enabled: true,
      cron_enabled_daily_financials: true,
      cron_enabled_fantasy_sync_matches: true,
      cron_enabled_fantasy_sync_squads: true,
      cron_enabled_fantasy_process_live: true,
      cron_enabled_ludo_cleanup: true,
      cron_enabled_ludo_tournaments: true
    };

    rows.forEach(r => {
      settings[r.key_name] = r.value_data !== 'false';
    });

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings: ' + err.message });
  }
});

// POST /api/admin/cron/settings
router.post('/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key || typeof value !== 'boolean') {
    return res.status(400).json({ error: 'Invalid settings body' });
  }

  try {
    const valStr = value ? 'true' : 'false';
    await pool.query(
      "INSERT INTO system_state (key_name, value_data) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_data = ?",
      [key, valStr, valStr]
    );
    res.json({ message: 'Setting updated successfully.', key, value });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update setting: ' + err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const [history] = await pool.query(
      'SELECT * FROM cron_history ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM cron_history');
    const total = countRows[0].total;

    res.json({ 
      history, 
      total, 
      page, 
      totalPages: Math.ceil(total / limit) 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history: ' + err.message });
  }
});

// POST /api/admin/cron/trigger/:jobKey
router.post('/trigger/:jobKey', async (req, res) => {
  const { jobKey } = req.params;
  if (!jobs[jobKey]) {
    return res.status(400).json({ error: 'Invalid job key' });
  }

  try {
    const result = await runJob(jobKey, 'admin');
    res.json({ message: `Job '${jobKey}' executed successfully.`, ...result });
  } catch (err) {
    res.status(500).json({ error: `Job '${jobKey}' execution failed: ` + err.message });
  }
});

module.exports = router;
