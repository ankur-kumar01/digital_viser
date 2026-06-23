/**
 * Migration 053: Cron Job History Logging
 */

exports.up = async (conn) => {
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cron_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cron_name VARCHAR(100) NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        status ENUM('running', 'success', 'failure') DEFAULT 'running',
        details JSON DEFAULT NULL,
        error_message TEXT DEFAULT NULL
      )
    `);
    console.log('✅ Migration 053: cron_history table created.');
  } catch (e) {
    console.error('Error in migration 053 up:', e.message);
    throw e;
  }
};

exports.down = async (conn) => {
  try {
    await conn.query(`DROP TABLE IF EXISTS cron_history`);
    console.log('❌ Migration 053: cron_history table dropped.');
  } catch (e) {
    console.error('Error in migration 053 down:', e.message);
  }
};
