const { pool } = require('../src/db');

async function up() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL COMMENT 'If NULL, this is a global rule',
        wallet_type ENUM('main', 'bonus', 'referral', 'gaming_bonus', 'overall') NOT NULL DEFAULT 'overall',
        limit_type ENUM('fixed', 'percent_of_balance') NOT NULL,
        limit_value DECIMAL(10, 2) NOT NULL,
        time_window ENUM('per_transaction', 'daily') NOT NULL DEFAULT 'per_transaction',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_wallet_type (wallet_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Insert a default global rule for testing if none exists
    const [existing] = await conn.query('SELECT id FROM withdrawal_limits LIMIT 1');
    if (existing.length === 0) {
      // Just a placeholder, initially inactive so it doesn't break existing setups
      await conn.query(`
        INSERT INTO withdrawal_limits (user_id, wallet_type, limit_type, limit_value, time_window, is_active)
        VALUES (NULL, 'main', 'percent_of_balance', 100, 'per_transaction', FALSE)
      `);
    }

    console.log('Migration 057: withdrawal_limits table created successfully.');
  } catch (error) {
    console.error('Error running migration 057:', error);
    throw error;
  } finally {
    conn.release();
  }
}

async function down() {
  const conn = await pool.getConnection();
  try {
    await conn.query('DROP TABLE IF EXISTS withdrawal_limits');
    console.log('Migration 057: withdrawal_limits table dropped successfully.');
  } catch (error) {
    console.error('Error reverting migration 057:', error);
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { up, down };
