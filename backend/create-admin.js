require('dotenv').config();
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
  });

  try {
    const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const [result] = await conn.query(
      'INSERT IGNORE INTO admins (name, email, password_hash) VALUES (?, ?, ?)',
      ['Super Admin', 'admin@digitalviser.com', passwordHash]
    );
    if (result.affectedRows > 0) {
      console.log('Admin user created: admin@digitalviser.com');
      console.log(`Password: ${adminPassword}`);
      console.log('⚠️  Save this password immediately. It will not be shown again.');
      if (!process.env.ADMIN_PASSWORD) {
        console.log('💡 Tip: Set ADMIN_PASSWORD env var to use a custom password.');
      }
    } else {
      console.log('Admin user already exists.');
    }
  } catch (err) {
    console.error('Failed to create admin:', err);
  } finally {
    await conn.end();
  }
}

createAdmin();
