const mysql = require('mysql2/promise');

async function up(conn) {
  // Alter users table to add wallet balances and referral tracking
  await conn.query(`
    ALTER TABLE users
    ADD COLUMN bonus_balance DECIMAL(15,2) DEFAULT 0.00,
    ADD COLUMN referral_balance DECIMAL(15,2) DEFAULT 0.00,
    ADD COLUMN locked_balance DECIMAL(15,2) DEFAULT 0.00,
    ADD COLUMN locked_bonus_balance DECIMAL(15,2) DEFAULT 0.00,
    ADD COLUMN locked_referral_balance DECIMAL(15,2) DEFAULT 0.00,
    ADD COLUMN referral_code VARCHAR(50) UNIQUE NULL,
    ADD COLUMN invited_by INT NULL,
    ADD FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;
  `);

  // Initialize existing users with a referral code (simple fallback)
  await conn.query(`
    UPDATE users SET referral_code = CONCAT('REF', id, FLOOR(RAND() * 10000)) WHERE referral_code IS NULL;
  `);

  // Create reward_schemes table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS reward_schemes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50) NOT NULL, -- 'fdr_bonus', 'referral_bonus'
      min_amount DECIMAL(15,2) DEFAULT 0.00,
      reward_amount DECIMAL(15,2) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create locked_funds table to track when things unlock
  await conn.query(`
    CREATE TABLE IF NOT EXISTS locked_funds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      wallet_type VARCHAR(50) NOT NULL, -- 'normal', 'bonus', 'referral'
      amount DECIMAL(15,2) NOT NULL,
      linked_entity_id INT NULL, -- e.g., FDR ID or Deposit ID
      linked_entity_type VARCHAR(50) NULL, -- 'fdr', 'deposit'
      status VARCHAR(20) DEFAULT 'locked', -- 'locked', 'unlocked'
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      unlocked_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

module.exports = { up };
