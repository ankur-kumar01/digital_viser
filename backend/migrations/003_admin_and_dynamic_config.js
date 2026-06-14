const mysql = require('mysql2/promise');

async function up(conn) {
  // Create admins table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create payment_methods table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL COMMENT 'deposit or withdraw',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create fdr_plans table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fdr_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      min_amount DECIMAL(15,2) NOT NULL,
      max_amount DECIMAL(15,2) NOT NULL,
      period_days INT NOT NULL,
      interest_percent DECIMAL(5,2) NOT NULL,
      duration_days INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Update default status for deposits and withdrawals to 'pending'
  await conn.query(`
    ALTER TABLE deposits MODIFY COLUMN status VARCHAR(20) DEFAULT 'pending'
  `);
  
  await conn.query(`
    ALTER TABLE withdrawals MODIFY COLUMN status VARCHAR(20) DEFAULT 'pending'
  `);
}

module.exports = { up };
