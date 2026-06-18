module.exports = {
  up: async (pool) => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        device_info VARCHAR(255),
        login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await pool.query(`CREATE INDEX idx_login_history_user ON login_history(user_id)`);
    await pool.query(`CREATE INDEX idx_login_history_at ON login_history(login_at)`);
  },

  down: async (pool) => {
    await pool.query(`DROP TABLE IF EXISTS login_history`);
  }
};
