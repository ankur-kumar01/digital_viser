module.exports = {
  up: async (pool) => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_bots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL DEFAULT 'disabled',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Migrate existing bot user (ID 9999) into game_bots if not already there
    const [existingBot] = await pool.query(`SELECT id FROM game_bots WHERE id = 1`);
    if (existingBot.length === 0) {
      await pool.query(`
        INSERT IGNORE INTO game_bots (id, name, email, password_hash, is_active)
        VALUES (1, 'Guest_7842', 'bot@ludoclash.com', 'disabled', 1)
      `);
    }

    // Ensure the corresponding users row exists
    await pool.query(`
      INSERT IGNORE INTO users (id, name, email, password_hash)
      VALUES (9999, 'Guest_7842', 'bot@ludoclash.com', 'disabled')
    `);
  },

  down: async (pool) => {
    await pool.query(`DROP TABLE IF EXISTS game_bots`);
  }
};
