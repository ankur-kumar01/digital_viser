const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100, // ISSUE-021 FIX: Limit queue size so excess requests fail fast (was 0 = unlimited)
  timezone: '+00:00',
  dateStrings: true,
});

module.exports = { pool };

