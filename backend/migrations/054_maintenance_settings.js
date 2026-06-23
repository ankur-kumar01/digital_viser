/**
 * Migration 054: Maintenance Mode Settings
 */

exports.up = async (conn) => {
  try {
    await conn.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
      VALUES 
        ('maintenance_mode', 'false', 'Enable/disable maintenance mode globally (true/false)'),
        ('maintenance_end_time', '', 'Optional UTC ISO datetime string or empty for maintenance end time')
    `);
    console.log('✅ Migration 054: maintenance settings seeded.');
  } catch (e) {
    console.error('Error in migration 054 up:', e.message);
    throw e;
  }
};

exports.down = async (conn) => {
  try {
    await conn.query(`
      DELETE FROM system_settings WHERE setting_key IN ('maintenance_mode', 'maintenance_end_time')
    `);
    console.log('❌ Migration 054: maintenance settings cleaned up.');
  } catch (e) {
    console.error('Error in migration 054 down:', e.message);
  }
};
