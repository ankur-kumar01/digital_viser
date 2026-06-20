module.exports = {
  up: async (conn) => {
    const defaults = [
      ['smtp_host', '', 'SMTP server hostname'],
      ['smtp_port', '587', 'SMTP server port'],
      ['smtp_user', '', 'SMTP username'],
      ['smtp_pass', '', 'SMTP password'],
      ['smtp_from_email', '', 'From email address for outgoing emails'],
      ['smtp_from_name', 'Digital Viser', 'From display name for outgoing emails'],
    ];
    for (const [key, value, desc] of defaults) {
      await conn.query(
        "INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)",
        [key, value, desc]
      );
    }
    console.log('Seeded SMTP settings defaults.');
  },
};
