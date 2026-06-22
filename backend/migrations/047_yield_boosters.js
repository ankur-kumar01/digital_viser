/**
 * Migration 047: Yield Booster Offer System
 */

exports.up = async (conn) => {
  // 1. Core Yield Booster Configurations
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fdr_yield_boosters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      yield_boost_percent DECIMAL(5,2) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      duration_days INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. User Booster Activations
  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_yield_boosters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      booster_id INT NOT NULL,
      status ENUM('active', 'completed') DEFAULT 'active',
      activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (booster_id) REFERENCES fdr_yield_boosters(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Migration 047: Yield booster tables created.');
};

exports.down = async (conn) => {
  await conn.query(`DROP TABLE IF EXISTS user_yield_boosters`);
  await conn.query(`DROP TABLE IF EXISTS fdr_yield_boosters`);
  console.log('❌ Migration 047: Yield booster tables dropped.');
};
