const mysql = require('mysql2/promise');

async function up(conn) {
  // Create users table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      balance DECIMAL(15,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create deposits table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS deposits (
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

  // Create fdrs table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fdrs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      interest_percent DECIMAL(5,2) NOT NULL,
      period_days INT NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      accrued_interest DECIMAL(15,2) DEFAULT 0.00,
      last_installment_date DATE,
      next_installment_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create transactions table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(30) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create system_state table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS system_state (
      key_name VARCHAR(50) PRIMARY KEY,
      value_data VARCHAR(255)
    )
  `);

  // Insert default simulated_date as today's date
  const today = new Date().toISOString().split('T')[0];
  await conn.query(
    `INSERT IGNORE INTO system_state (key_name, value_data) VALUES ('simulated_date', ?)`,
    [today]
  );
}

module.exports = { up };
