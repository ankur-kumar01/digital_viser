require('dotenv').config();
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
    const passwordHash = await bcrypt.hash('admin123', 10);
    await conn.query(
      'INSERT IGNORE INTO admins (name, email, password_hash) VALUES (?, ?, ?)',
      ['Super Admin', 'admin@digitalviser.com', passwordHash]
    );
    console.log('Admin user created: admin@digitalviser.com / admin123');
  } catch (err) {
    console.error('Failed to create admin:', err);
  } finally {
    await conn.end();
  }
}

createAdmin();
