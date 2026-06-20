module.exports = {
  up: async (pool) => {
    // 1. Seed Ludo Game if not exists
    const [existing] = await pool.query("SELECT * FROM games WHERE slug = 'ludo'");
    if (existing.length === 0) {
      await pool.query(`
        INSERT INTO games (name, slug, description, image_url, is_active)
        VALUES (
          'Ludo Multiplayer',
          'ludo',
          'Create rooms, set wagers, roll dice and challenge players or bots in the real-world Ludo wagers game!',
          '/images/games/ludo-thumb.png',
          true
        )
      `);
    }

    // 2. Insert Default Settings
    await pool.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
      VALUES 
      ('ludo_house_edge', '5', 'Platform fee/commission percentage deducted from Ludo game pools'),
      ('ludo_min_bet', '10', 'Minimum wager entry fee for Ludo matches'),
      ('ludo_max_bet', '5000', 'Maximum wager entry fee for Ludo matches')
    `);

    // 3. Create ludo_rooms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ludo_rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entry_fee DECIMAL(10,2) NOT NULL,
        host_id INT NOT NULL,
        challenger_id INT DEFAULT NULL,
        winner_id INT DEFAULT NULL,
        status ENUM('waiting', 'playing', 'completed', 'cancelled') DEFAULT 'waiting',
        board_state JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (host_id) REFERENCES users(id),
        FOREIGN KEY (challenger_id) REFERENCES users(id),
        FOREIGN KEY (winner_id) REFERENCES users(id)
      )
    `);

    // 4. Create ludo_moves table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ludo_moves (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        piece_index INT NOT NULL,
        from_pos INT NOT NULL,
        to_pos INT NOT NULL,
        dice_value INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES ludo_rooms(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  },

  down: async (pool) => {
    await pool.query(`DROP TABLE IF EXISTS ludo_moves`);
    await pool.query(`DROP TABLE IF EXISTS ludo_rooms`);
    await pool.query(`DELETE FROM games WHERE slug = 'ludo'`);
    await pool.query(`DELETE FROM system_settings WHERE setting_key IN ('ludo_house_edge', 'ludo_min_bet', 'ludo_max_bet')`);
  }
};
