/**
 * Migration 051: Daily Task Board checklist module
 */

exports.up = async (conn) => {
  try {
    // 1. Create daily_tasks table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS daily_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description VARCHAR(255) DEFAULT '',
        target_count INT NOT NULL DEFAULT 1,
        reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        reward_wallet ENUM('main', 'bonus') DEFAULT 'bonus',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create daily_task_progress table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS daily_task_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        task_id INT NOT NULL,
        date_str VARCHAR(10) NOT NULL,
        current_count INT NOT NULL DEFAULT 0,
        is_completed BOOLEAN DEFAULT FALSE,
        is_claimed BOOLEAN DEFAULT FALSE,
        claimed_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE,
        UNIQUE KEY user_task_date (user_id, task_id, date_str)
      )
    `);

    // 3. Create daily_task_all_done_claims table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS daily_task_all_done_claims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date_str VARCHAR(10) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        wallet_type VARCHAR(50) NOT NULL,
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY user_all_done_date (user_id, date_str)
      )
    `);

    // 4. Seed default tasks
    await conn.query(`
      INSERT INTO daily_tasks (task_type, title, description, target_count, reward_amount, reward_wallet, is_active)
      VALUES 
        ('check_in', 'Check in today', 'Log in and claim your check-in credit', 1, 1.00, 'bonus', TRUE),
        ('ludo', 'Play 3 Ludo matches', 'Play 3 matches of Ludo', 3, 3.00, 'bonus', TRUE),
        ('colour-trading', 'Predict 5 Colour Trading rounds', 'Place 5 bets in Colour Trading', 5, 5.00, 'bonus', TRUE)
    `);

    // 5. Seed default global settings in system_state
    await conn.query(`
      INSERT INTO system_state (key_name, value_data)
      VALUES 
        ('daily_tasks_all_done_reward', '15.00'),
        ('daily_tasks_all_done_wallet', 'main')
      ON DUPLICATE KEY UPDATE value_data = VALUES(value_data)
    `);

  } catch (e) {
    console.error('Error in migration 051 up:', e.message);
  }
  console.log('✅ Migration 051: Daily Task Board tables and seeds created.');
};

exports.down = async (conn) => {
  try {
    await conn.query(`DROP TABLE IF EXISTS daily_task_all_done_claims`);
    await conn.query(`DROP TABLE IF EXISTS daily_task_progress`);
    await conn.query(`DROP TABLE IF EXISTS daily_tasks`);
    await conn.query(`DELETE FROM system_state WHERE key_name IN ('daily_tasks_all_done_reward', 'daily_tasks_all_done_wallet')`);
  } catch (e) {
    console.error('Error in migration 051 down:', e.message);
  }
  console.log('❌ Migration 051: Daily Task Board tables dropped.');
};
