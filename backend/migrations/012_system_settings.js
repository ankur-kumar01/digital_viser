module.exports = {
  up: async (pool) => {
    // 1. System Settings Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value VARCHAR(255) NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert default RTP for Aviator
    await pool.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
      VALUES ('aviator_house_edge', '3', 'House edge percentage for Aviator game (e.g. 3 = 97% RTP)')
    `);

    // 2. Aviator Rounds Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aviator_rounds (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        server_seed VARCHAR(64) NOT NULL,
        client_seed VARCHAR(64) NOT NULL,
        hash VARCHAR(64) NOT NULL,
        crash_point DECIMAL(10,2) NOT NULL,
        start_time BIGINT NULL,
        status ENUM('pending', 'active', 'crashed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Aviator Bets Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aviator_bets (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        round_id BIGINT NOT NULL,
        user_id INT NOT NULL,
        bet_amount DECIMAL(10,2) NOT NULL,
        cashout_multiplier DECIMAL(10,2) NULL,
        win_amount DECIMAL(10,2) NULL,
        status ENUM('active', 'cashed_out', 'lost') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (round_id) REFERENCES aviator_rounds(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  },

  down: async (pool) => {
    await pool.query(`DROP TABLE IF EXISTS aviator_bets`);
    await pool.query(`DROP TABLE IF EXISTS aviator_rounds`);
    await pool.query(`DROP TABLE IF EXISTS system_settings`);
  }
};
