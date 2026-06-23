const express = require('express');
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

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

// GET /api/admin/daily-tasks
router.get('/', async (req, res) => {
  try {
    const [tasks] = await pool.query("SELECT * FROM daily_tasks ORDER BY created_at DESC");

    const [rewardSetting] = await pool.query("SELECT value_data FROM system_state WHERE key_name = 'daily_tasks_all_done_reward'");
    const [walletSetting] = await pool.query("SELECT value_data FROM system_state WHERE key_name = 'daily_tasks_all_done_wallet'");

    const allDoneReward = rewardSetting.length > 0 ? parseFloat(rewardSetting[0].value_data) : 15.00;
    const allDoneWallet = walletSetting.length > 0 ? walletSetting[0].value_data : 'main';

    res.json({
      tasks,
      all_done_reward: allDoneReward,
      all_done_wallet: allDoneWallet
    });
  } catch (err) {
    console.error('Error fetching admin tasks:', err);
    res.status(500).json({ error: 'Server error fetching tasks.' });
  }
});

// POST /api/admin/daily-tasks
router.post('/', async (req, res) => {
  const { task_type, title, description, target_count, reward_amount, reward_wallet, is_active } = req.body;

  if (!title || !task_type) {
    return res.status(400).json({ error: 'Title and task type are required.' });
  }

  const validTypes = ['check_in', 'ludo', 'colour-trading', 'aviator', 'fruit-slasher', 'cricket-fantasy', 'custom'];
  if (!validTypes.includes(task_type)) {
    return res.status(400).json({ error: 'Invalid task type.' });
  }

  const targetCountInt = parseInt(target_count, 10);
  if (isNaN(targetCountInt) || targetCountInt <= 0) {
    return res.status(400).json({ error: 'Target count must be a positive integer.' });
  }

  const rewardAmountFloat = parseFloat(reward_amount);
  if (isNaN(rewardAmountFloat) || rewardAmountFloat < 0) {
    return res.status(400).json({ error: 'Reward amount must be a positive number.' });
  }

  if (reward_wallet !== 'main' && reward_wallet !== 'bonus') {
    return res.status(400).json({ error: 'Wallet must be either main or bonus.' });
  }

  try {
    await pool.query(
      `INSERT INTO daily_tasks (task_type, title, description, target_count, reward_amount, reward_wallet, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [task_type, title, description || '', targetCountInt, rewardAmountFloat, reward_wallet, is_active === undefined ? true : !!is_active]
    );

    res.json({ message: 'Daily task created successfully!' });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Server error creating task.' });
  }
});

// PUT /api/admin/daily-tasks/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { task_type, title, description, target_count, reward_amount, reward_wallet, is_active } = req.body;

  if (!title || !task_type) {
    return res.status(400).json({ error: 'Title and task type are required.' });
  }

  const targetCountInt = parseInt(target_count, 10);
  if (isNaN(targetCountInt) || targetCountInt <= 0) {
    return res.status(400).json({ error: 'Target count must be a positive integer.' });
  }

  const rewardAmountFloat = parseFloat(reward_amount);
  if (isNaN(rewardAmountFloat) || rewardAmountFloat < 0) {
    return res.status(400).json({ error: 'Reward amount must be a positive number.' });
  }

  if (reward_wallet !== 'main' && reward_wallet !== 'bonus') {
    return res.status(400).json({ error: 'Wallet must be either main or bonus.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE daily_tasks 
       SET task_type = ?, title = ?, description = ?, target_count = ?, reward_amount = ?, reward_wallet = ?, is_active = ?
       WHERE id = ?`,
      [task_type, title, description || '', targetCountInt, rewardAmountFloat, reward_wallet, !!is_active, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Daily task not found.' });
    }

    res.json({ message: 'Daily task updated successfully!' });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Server error updating task.' });
  }
});

// DELETE /api/admin/daily-tasks/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const [result] = await pool.query("DELETE FROM daily_tasks WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Daily task not found.' });
    }

    res.json({ message: 'Daily task deleted successfully!' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Server error deleting task.' });
  }
});

// POST /api/admin/daily-tasks/settings
router.post('/settings', async (req, res) => {
  const { reward_amount, wallet_type } = req.body;

  const rewardAmountFloat = parseFloat(reward_amount);
  if (isNaN(rewardAmountFloat) || rewardAmountFloat < 0) {
    return res.status(400).json({ error: 'All Done reward amount must be positive.' });
  }

  if (wallet_type !== 'main' && wallet_type !== 'bonus') {
    return res.status(400).json({ error: 'All Done reward wallet must be main or bonus.' });
  }

  try {
    await pool.query(
      "UPDATE system_state SET value_data = ? WHERE key_name = 'daily_tasks_all_done_reward'",
      [rewardAmountFloat.toFixed(2)]
    );

    await pool.query(
      "UPDATE system_state SET value_data = ? WHERE key_name = 'daily_tasks_all_done_wallet'",
      [wallet_type]
    );

    res.json({ message: 'Global daily task board configurations saved successfully!' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Server error saving settings.' });
  }
});

module.exports = router;
