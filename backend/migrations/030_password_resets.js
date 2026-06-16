module.exports = {
  up: async (pool) => {
    // Create password_resets table to store OTP codes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },

  down: async (pool) => {
    await pool.query(`DROP TABLE IF EXISTS password_resets`);
  }
};
