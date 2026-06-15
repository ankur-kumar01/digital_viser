const mysql = require('mysql2/promise');

async function up(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fdr_offers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      bonus_percent DECIMAL(5,2) NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { up };
