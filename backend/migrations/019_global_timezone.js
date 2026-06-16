module.exports = {
  up: async (pool) => {
    await pool.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
      VALUES ('global_timezone', 'Asia/Kolkata', 'Global timezone for the entire application (e.g. Asia/Kolkata, UTC)')
    `);
  },

  down: async (pool) => {
    await pool.query(`DELETE FROM system_settings WHERE setting_key = 'global_timezone'`);
  }
};
