module.exports = {
  up: async (pool) => {
    await pool.query(`
      ALTER TABLE fruit_bets
      ADD COLUMN server_crash_multiplier DECIMAL(10,2) DEFAULT 1.00 AFTER bet_amount,
      ADD COLUMN wallet_type ENUM('main', 'gaming_bonus') DEFAULT 'main' AFTER user_id
    `);
  },

  down: async (pool) => {
    await pool.query(`
      ALTER TABLE fruit_bets
      DROP COLUMN server_crash_multiplier,
      DROP COLUMN wallet_type
    `);
  }
};
