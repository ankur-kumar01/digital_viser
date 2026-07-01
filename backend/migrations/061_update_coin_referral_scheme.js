const mysql = require('mysql2/promise');

async function up(conn) {
  // Update coin referral scheme default to 3% (applicable on all deposits)
  await conn.query(`
    UPDATE reward_schemes 
    SET reward_amount = 3.00 
    WHERE type = 'coin_referral_percent' AND reward_amount = 5.00
  `);
}

module.exports = { up };
