const bcrypt = require('bcryptjs');

async function up(conn) {
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  // Use INSERT IGNORE to prevent duplicate errors if ran multiple times or if already seeded by create-admin.js
  await conn.query(
    'INSERT IGNORE INTO admins (name, email, password_hash) VALUES (?, ?, ?)',
    ['Test Admin', 'admin@digitalviser.com', passwordHash]
  );
}

module.exports = { up };
