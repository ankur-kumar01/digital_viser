async function up(conn) {
  // 1. Add gaming_bonus_balance to users table
  try {
    await conn.query(`ALTER TABLE users ADD COLUMN gaming_bonus_balance DECIMAL(15,2) DEFAULT 0.00`);
  } catch (e) {
    if (!e.message.includes('Duplicate column')) throw e;
  }

  // 2. Spin Wheel Segments (admin configurable)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS spin_wheel_segments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      label VARCHAR(100) NOT NULL,
      prize_type ENUM('gaming_bonus', 'try_again') NOT NULL DEFAULT 'gaming_bonus',
      prize_amount DECIMAL(10,2) DEFAULT 0.00,
      probability INT NOT NULL DEFAULT 10,
      bg_color VARCHAR(20) NOT NULL DEFAULT '#22c55e',
      text_color VARCHAR(20) NOT NULL DEFAULT '#ffffff',
      emoji VARCHAR(10) DEFAULT '🎁',
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. User Spin History
  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_spin_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      segment_id INT NOT NULL,
      prize_amount DECIMAL(10,2) DEFAULT 0.00,
      prize_type VARCHAR(50) NOT NULL,
      streak_day INT DEFAULT 1,
      spun_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (segment_id) REFERENCES spin_wheel_segments(id)
    )
  `);

  // 4. Spin Streaks Table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS user_spin_streaks (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL UNIQUE,
      current_streak INT DEFAULT 0,
      last_spin_date DATE NULL,
      total_spins INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 5. Seed default segments
  const [existing] = await conn.query('SELECT COUNT(*) as count FROM spin_wheel_segments');
  if (existing[0].count === 0) {
    const segments = [
      ['₹10 Gaming Bonus',  'gaming_bonus', 10.00,  30, '#22c55e', '#ffffff', '💚', 1],
      ['₹25 Gaming Bonus',  'gaming_bonus', 25.00,  22, '#f59e0b', '#ffffff', '🌟', 2],
      ['Try Again',         'try_again',    0.00,   18, '#6b7280', '#ffffff', '😅', 3],
      ['₹50 Gaming Bonus',  'gaming_bonus', 50.00,  13, '#3b82f6', '#ffffff', '💙', 4],
      ['₹15 Gaming Bonus',  'gaming_bonus', 15.00,  8,  '#8b5cf6', '#ffffff', '💜', 5],
      ['₹100 Gaming Bonus', 'gaming_bonus', 100.00, 5,  '#ec4899', '#ffffff', '🔥', 6],
      ['₹200 Gaming Bonus', 'gaming_bonus', 200.00, 3,  '#ef4444', '#ffffff', '💥', 7],
      ['₹500 Gaming Bonus', 'gaming_bonus', 500.00, 1,  '#f97316', '#ffffff', '🚀', 8],
    ];
    for (const s of segments) {
      await conn.query(
        'INSERT INTO spin_wheel_segments (label, prize_type, prize_amount, probability, bg_color, text_color, emoji, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        s
      );
    }
  }
}

module.exports = { up };
