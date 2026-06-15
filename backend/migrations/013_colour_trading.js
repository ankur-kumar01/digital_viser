module.exports = {
  up: async (pool) => {
    // Insert default House Edge for Colour Trading (e.g., 30% chance of forcing liability win)
    await pool.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
      VALUES ('colour_trading_house_edge', '30', 'Percentage chance the server forcefully minimizes player payouts (Liability Algorithm)')
    `);

    // 1. Colour Trading Rounds Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ct_rounds (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        period_number BIGINT NOT NULL UNIQUE,
        result_color ENUM('red', 'green', 'violet') NULL,
        status ENUM('betting', 'processing', 'completed') DEFAULT 'betting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Colour Trading Bets Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ct_bets (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        round_id BIGINT NOT NULL,
        user_id INT NOT NULL,
        color ENUM('red', 'green', 'violet') NOT NULL,
        bet_amount DECIMAL(10,2) NOT NULL,
        win_amount DECIMAL(10,2) NULL,
        status ENUM('active', 'won', 'lost') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (round_id) REFERENCES ct_rounds(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  },

  down: async (pool) => {
    await pool.query(`DROP TABLE IF EXISTS ct_bets`);
    await pool.query(`DROP TABLE IF EXISTS ct_rounds`);
  }
};
