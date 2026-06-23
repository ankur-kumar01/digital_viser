const express = require('express');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');
const { getGameplayCount } = require('../services/audienceResolver');

const router = express.Router();
router.use(authMiddleware);

// GET /api/daily-tasks
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Get simulated date
    const [stateRows] = await pool.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    // 2. Fetch active daily tasks
    const [tasks] = await pool.query(
      "SELECT * FROM daily_tasks WHERE is_active = TRUE"
    );

    // 3. Retrieve user's progress for today
    const tasksList = [];
    for (const task of tasks) {
      const [progressRows] = await pool.query(
        "SELECT is_claimed, is_completed, current_count FROM daily_task_progress WHERE user_id = ? AND task_id = ? AND date_str = ?",
        [userId, task.id, simulatedDate]
      );

      const dbProgress = progressRows[0] || null;
      let isClaimed = dbProgress ? dbProgress.is_claimed === 1 : false;
      let dbCompleted = dbProgress ? dbProgress.is_completed === 1 : false;
      let dbCount = dbProgress ? dbProgress.current_count : 0;

      let currentCount = dbCount;
      if (!isClaimed) {
        if (task.task_type === 'check_in') {
          currentCount = dbCount;
        } else {
          // Compute gameplay count dynamically
          const gameplayCount = await getGameplayCount(userId, task.task_type, simulatedDate, simulatedDate);
          currentCount = Math.max(dbCount, gameplayCount);
        }
      }

      const isCompleted = dbCompleted || (currentCount >= task.target_count);

      tasksList.push({
        id: task.id,
        task_type: task.task_type,
        title: task.title,
        description: task.description,
        target_count: task.target_count,
        reward_amount: parseFloat(task.reward_amount),
        reward_wallet: task.reward_wallet,
        current_count: currentCount,
        is_completed: isCompleted,
        is_claimed: isClaimed
      });
    }

    // 4. Check all-done reward status
    const allClaimsDone = tasksList.length > 0 && tasksList.every(t => t.is_claimed);

    const [allDoneRows] = await pool.query(
      "SELECT id FROM daily_task_all_done_claims WHERE user_id = ? AND date_str = ?",
      [userId, simulatedDate]
    );
    const isAllDoneClaimed = allDoneRows.length > 0;

    // 5. Get global all-done settings
    const [rewardSetting] = await pool.query("SELECT value_data FROM system_state WHERE key_name = 'daily_tasks_all_done_reward'");
    const [walletSetting] = await pool.query("SELECT value_data FROM system_state WHERE key_name = 'daily_tasks_all_done_wallet'");

    const allDoneAmount = rewardSetting.length > 0 ? parseFloat(rewardSetting[0].value_data) : 15.00;
    const allDoneWallet = walletSetting.length > 0 ? walletSetting[0].value_data : 'main';

    res.json({
      tasks: tasksList,
      all_done_eligible: allClaimsDone && !isAllDoneClaimed,
      all_done_claimed: isAllDoneClaimed,
      all_done_amount: allDoneAmount,
      all_done_wallet: allDoneWallet,
      simulated_date: simulatedDate
    });

  } catch (err) {
    console.error('Error fetching daily tasks:', err);
    res.status(500).json({ error: 'Server error fetching daily tasks.' });
  }
});

// POST /api/daily-tasks/check-in
router.post('/check-in', async (req, res) => {
  const userId = req.user.userId;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Get simulated date
    const [stateRows] = await conn.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    // 2. Find active check-in task
    const [tasks] = await conn.query(
      "SELECT * FROM daily_tasks WHERE task_type = 'check_in' AND is_active = TRUE LIMIT 1"
    );
    if (tasks.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No active check-in task configured.' });
    }
    const task = tasks[0];

    // 3. Verify not already checked in
    const [progress] = await conn.query(
      "SELECT id, is_claimed FROM daily_task_progress WHERE user_id = ? AND task_id = ? AND date_str = ?",
      [userId, task.id, simulatedDate]
    );

    if (progress.length > 0 && progress[0].is_claimed) {
      await conn.rollback();
      return res.status(400).json({ error: 'Already checked in today.' });
    }

    // 4. Save progress as completed & claimed
    await conn.query(
      `INSERT INTO daily_task_progress (user_id, task_id, date_str, current_count, is_completed, is_claimed, claimed_at)
       VALUES (?, ?, ?, 1, TRUE, TRUE, NOW())
       ON DUPLICATE KEY UPDATE current_count = 1, is_completed = TRUE, is_claimed = TRUE, claimed_at = NOW()`,
      [userId, task.id, simulatedDate]
    );

    // 5. Credit reward wallet
    const rewardVal = parseFloat(task.reward_amount);
    const walletField = task.reward_wallet === 'main' ? 'balance' : 'bonus_balance';
    await conn.query(
      `UPDATE users SET ${walletField} = ${walletField} + ? WHERE id = ?`,
      [rewardVal, userId]
    );

    // 6. Record transaction
    const walletName = task.reward_wallet === 'main' ? 'Main' : 'Bonus';
    await conn.query(
      "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'daily_task_reward', ?, ?)",
      [userId, rewardVal, `Daily Check-In Reward (+₹${rewardVal.toFixed(2)} ${walletName} Credit)`]
    );

    await conn.commit();
    res.json({ message: 'Checked in successfully! Reward credited.' });

  } catch (err) {
    await conn.rollback();
    console.error('Error during daily check-in:', err);
    res.status(500).json({ error: 'Server error processing check-in.' });
  } finally {
    conn.release();
  }
});

// POST /api/daily-tasks/:id/claim
router.post('/:id/claim', async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const userId = req.user.userId;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Fetch simulated date
    const [stateRows] = await conn.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    // 2. Fetch task config
    const [tasks] = await conn.query(
      "SELECT * FROM daily_tasks WHERE id = ? AND is_active = TRUE",
      [taskId]
    );
    if (tasks.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Active daily task not found.' });
    }
    const task = tasks[0];

    // 3. Verify not already claimed today
    const [progress] = await conn.query(
      "SELECT id, is_claimed FROM daily_task_progress WHERE user_id = ? AND task_id = ? AND date_str = ?",
      [userId, task.id, simulatedDate]
    );
    if (progress.length > 0 && progress[0].is_claimed) {
      await conn.rollback();
      return res.status(400).json({ error: 'Reward already claimed for today.' });
    }

    // 4. Calculate counts and verify completion
    let currentCount = 0;
    if (task.task_type === 'check_in') {
      currentCount = (progress.length > 0 && progress[0].is_completed) ? 1 : 0;
    } else {
      currentCount = await getGameplayCount(userId, task.task_type, simulatedDate, simulatedDate);
    }

    if (currentCount < task.target_count) {
      await conn.rollback();
      return res.status(400).json({ error: 'Task gameplay milestone not yet reached.' });
    }

    // 5. Update progress to completed & claimed
    await conn.query(
      `INSERT INTO daily_task_progress (user_id, task_id, date_str, current_count, is_completed, is_claimed, claimed_at)
       VALUES (?, ?, ?, ?, TRUE, TRUE, NOW())
       ON DUPLICATE KEY UPDATE current_count = ?, is_completed = TRUE, is_claimed = TRUE, claimed_at = NOW()`,
      [userId, task.id, simulatedDate, currentCount, currentCount]
    );

    // 6. Credit reward wallet
    const rewardVal = parseFloat(task.reward_amount);
    const walletField = task.reward_wallet === 'main' ? 'balance' : 'bonus_balance';
    await conn.query(
      `UPDATE users SET ${walletField} = ${walletField} + ? WHERE id = ?`,
      [rewardVal, userId]
    );

    // 7. Record transaction
    const walletName = task.reward_wallet === 'main' ? 'Main' : 'Bonus';
    await conn.query(
      "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'daily_task_reward', ?, ?)",
      [userId, rewardVal, `Task Reward: ${task.title} (+₹${rewardVal.toFixed(2)} ${walletName} Credit)`]
    );

    await conn.commit();
    res.json({ message: 'Task reward claimed successfully!' });

  } catch (err) {
    await conn.rollback();
    console.error('Error claiming task reward:', err);
    res.status(500).json({ error: 'Server error claiming task reward.' });
  } finally {
    conn.release();
  }
});

// POST /api/daily-tasks/claim-all-done
router.post('/claim-all-done', async (req, res) => {
  const userId = req.user.userId;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Get simulated date
    const [stateRows] = await conn.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    // 2. Fetch all active tasks
    const [tasks] = await conn.query(
      "SELECT * FROM daily_tasks WHERE is_active = TRUE"
    );
    if (tasks.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No active tasks configured for today.' });
    }

    // 3. Verify all active tasks are claimed in progress table
    for (const task of tasks) {
      const [progress] = await conn.query(
        "SELECT is_claimed FROM daily_task_progress WHERE user_id = ? AND task_id = ? AND date_str = ?",
        [userId, task.id, simulatedDate]
      );
      if (progress.length === 0 || !progress[0].is_claimed) {
        await conn.rollback();
        return res.status(400).json({ error: 'Please claim all individual daily tasks before unlocking All Done reward.' });
      }
    }

    // 4. Verify all-done not already claimed today
    const [allDoneCheck] = await conn.query(
      "SELECT id FROM daily_task_all_done_claims WHERE user_id = ? AND date_str = ?",
      [userId, simulatedDate]
    );
    if (allDoneCheck.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'You have already claimed today\'s All Done reward.' });
    }

    // 5. Retrieve global all-done config
    const [rewardSetting] = await conn.query("SELECT value_data FROM system_state WHERE key_name = 'daily_tasks_all_done_reward'");
    const [walletSetting] = await conn.query("SELECT value_data FROM system_state WHERE key_name = 'daily_tasks_all_done_wallet'");

    const rewardVal = rewardSetting.length > 0 ? parseFloat(rewardSetting[0].value_data) : 15.00;
    const rewardWallet = walletSetting.length > 0 ? walletSetting[0].value_data : 'main';

    // 6. Insert All Done Claim
    await conn.query(
      "INSERT INTO daily_task_all_done_claims (user_id, date_str, amount, wallet_type) VALUES (?, ?, ?, ?)",
      [userId, simulatedDate, rewardVal, rewardWallet]
    );

    // 7. Credit wallet
    const walletField = rewardWallet === 'main' ? 'balance' : 'bonus_balance';
    await conn.query(
      `UPDATE users SET ${walletField} = ${walletField} + ? WHERE id = ?`,
      [rewardVal, userId]
    );

    // 8. Record transaction
    const walletName = rewardWallet === 'main' ? 'Main' : 'Bonus';
    await conn.query(
      "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'daily_task_all_done', ?, ?)",
      [userId, rewardVal, `Daily Checklist All Done Bonus (+₹${rewardVal.toFixed(2)} ${walletName} Cash)`]
    );

    await conn.commit();
    res.json({ message: 'Congratulations! All Done reward credited successfully.' });

  } catch (err) {
    await conn.rollback();
    console.error('Error claiming All Done reward:', err);
    res.status(500).json({ error: 'Server error processing All Done reward.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
