const mysql = require('mysql2/promise');

async function up(conn) {
  // Create withdrawals table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      payment_method VARCHAR(50),
      transaction_id VARCHAR(100) UNIQUE,
      status VARCHAR(20) DEFAULT 'success',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

module.exports = { up };
