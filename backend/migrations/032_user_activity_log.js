module.exports = {
  up: async (pool) => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activity_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        page_url VARCHAR(500),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await pool.query(`CREATE INDEX idx_activity_user ON user_activity_log(user_id)`);
    await pool.query(`CREATE INDEX idx_activity_created ON user_activity_log(created_at)`);
  },

  down: async (pool) => {
    await pool.query(`DROP TABLE IF EXISTS user_activity_log`);
  }
};
