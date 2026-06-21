module.exports = {
  up: async (pool) => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ludo_tournaments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        entry_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        prize_pool DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_participants INT NOT NULL DEFAULT 50,
        num_matches INT NOT NULL DEFAULT 5,
        admin_commission DECIMAL(5,2) NOT NULL DEFAULT 5,
        status ENUM('upcoming', 'active', 'completed', 'cancelled') DEFAULT 'upcoming',
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ludo_tournament_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tournament_id INT NOT NULL,
        user_id INT NOT NULL,
        total_score INT NOT NULL DEFAULT 0,
        matches_played INT NOT NULL DEFAULT 0,
        best_scores JSON,
        \`rank\` INT DEFAULT NULL,
        prize_amount DECIMAL(10,2) DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tournament_id) REFERENCES ludo_tournaments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_participant (tournament_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ludo_tournament_prizes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tournament_id INT NOT NULL,
        rank_from INT NOT NULL,
        rank_to INT NOT NULL,
        prize_percentage DECIMAL(5,2) NOT NULL,
        FOREIGN KEY (tournament_id) REFERENCES ludo_tournaments(id) ON DELETE CASCADE
      )
    `);

    try {
      await pool.query(`
        ALTER TABLE ludo_rooms ADD COLUMN tournament_id INT DEFAULT NULL AFTER challenger_id
      `);
    } catch (e) {
      if (e.errno !== 1060) throw e;
    }
    try {
      await pool.query(`
        ALTER TABLE ludo_rooms ADD FOREIGN KEY (tournament_id) REFERENCES ludo_tournaments(id) ON DELETE SET NULL
      `);
    } catch (e) {
      if (e.errno !== 1826 && e.errno !== 1061) throw e;
    }
  },

  down: async (pool) => {
    try { await pool.query('ALTER TABLE ludo_rooms DROP FOREIGN KEY ludo_rooms_ibfk_4'); } catch (_) {}
    try { await pool.query('ALTER TABLE ludo_rooms DROP COLUMN tournament_id'); } catch (_) {}
    await pool.query('DROP TABLE IF EXISTS ludo_tournament_participants');
    await pool.query('DROP TABLE IF EXISTS ludo_tournament_prizes');
    await pool.query('DROP TABLE IF EXISTS ludo_tournaments');
  }
};
