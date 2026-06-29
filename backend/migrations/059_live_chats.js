exports.up = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_chat_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_unread_count INT DEFAULT 0,
      admin_unread_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      sender_type ENUM('user', 'admin') NOT NULL,
      message TEXT,
      attachment_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES live_chat_sessions(id) ON DELETE CASCADE
    )
  `);
};

exports.down = async (pool) => {
  await pool.query('DROP TABLE IF EXISTS live_chat_messages');
  await pool.query('DROP TABLE IF EXISTS live_chat_sessions');
};
