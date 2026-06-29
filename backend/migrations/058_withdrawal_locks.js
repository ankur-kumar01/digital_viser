const { pool } = require('../src/db');

async function up() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      ALTER TABLE users
      ADD COLUMN withdrawals_disabled_until DATETIME NULL;
    `);

    // Insert default global locks into system_settings if they don't exist
    await conn.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
      VALUES 
        ('global_withdrawals_disabled_until', '', 'If set to a future date, all withdrawals are disabled'),
        ('global_withdrawals_disabled_message', 'Withdrawals are currently disabled by the administrator.', 'Message to show when global withdrawals are disabled')
    `);

    console.log('Migration 058: withdrawals_disabled_until added successfully.');
  } catch (error) {
    console.error('Error running migration 058:', error);
    throw error;
  } finally {
    conn.release();
  }
}

async function down() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`ALTER TABLE users DROP COLUMN withdrawals_disabled_until`);
    await conn.query(`DELETE FROM system_settings WHERE setting_key IN ('global_withdrawals_disabled_until', 'global_withdrawals_disabled_message')`);
    console.log('Migration 058: withdrawal locks reverted successfully.');
  } catch (error) {
    console.error('Error reverting migration 058:', error);
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { up, down };
