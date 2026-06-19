module.exports = {
  up: async (pool) => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fdr_plan_blocks (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES fdr_plans(id) ON DELETE CASCADE,
        UNIQUE INDEX idx_user_plan (user_id, plan_id)
      )
    `);
  },

  down: async (pool) => {
    await pool.query('DROP TABLE IF EXISTS fdr_plan_blocks');
  }
};
