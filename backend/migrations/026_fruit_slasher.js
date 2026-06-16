module.exports = {
  up: async (pool) => {
    // 1. Seed Fruit Slasher Game if not exists
    const [existing] = await pool.query("SELECT * FROM games WHERE slug = 'fruit-slasher'");
    if (existing.length === 0) {
      await pool.query(`
        INSERT INTO games (name, slug, description, image_url, is_active)
        VALUES (
          'Fruit Slasher',
          'fruit-slasher',
          'Slice flying fruits, build your cashout multiplier, and avoid the bombs!',
          '/images/games/fruit-slasher-thumb.png',
          true
        )
      `);
    }

    // 2. Insert Default Settings
    await pool.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
      VALUES 
      ('fruit_slasher_house_edge', '5', 'Percentage chance the game forces a bomb or crash point to protect house edge'),
      ('fruit_slasher_min_bet', '10', 'Minimum bet amount for Fruit Slasher'),
      ('fruit_slasher_max_bet', '5000', 'Maximum bet amount for Fruit Slasher')
    `);

    // 3. Create fruit_bets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fruit_bets (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        bet_amount DECIMAL(10,2) NOT NULL,
        multiplier_reached DECIMAL(10,2) DEFAULT 1.00,
        win_amount DECIMAL(10,2) DEFAULT 0.00,
        status ENUM('active', 'won', 'lost') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  },

  down: async (pool) => {
    await pool.query(`DROP TABLE IF EXISTS fruit_bets`);
    await pool.query(`DELETE FROM games WHERE slug = 'fruit-slasher'`);
    await pool.query(`DELETE FROM system_settings WHERE setting_key IN ('fruit_slasher_house_edge', 'fruit_slasher_min_bet', 'fruit_slasher_max_bet')`);
  }
};
