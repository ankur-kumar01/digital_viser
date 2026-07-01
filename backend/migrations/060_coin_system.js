const mysql = require('mysql2/promise');

async function up(conn) {
  // Add coin_balance to users table
  await conn.query(`
    ALTER TABLE users
    ADD COLUMN coin_balance DECIMAL(15,2) DEFAULT 0.00
  `);

  // Insert default reward scheme for coin referral
  await conn.query(`
    INSERT INTO reward_schemes (type, min_amount, reward_amount, is_active) 
    VALUES ('coin_referral_percent', 0, 5.00, true)
  `);
}

module.exports = { up };
