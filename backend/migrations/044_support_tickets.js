exports.up = async (pool) => {
  await pool.query(`
    CREATE TABLE support_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'general',
      status ENUM('open', 'pending', 'closed') DEFAULT 'open',
      priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE support_ticket_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      sender_type ENUM('user', 'admin') NOT NULL,
      sender_id INT NOT NULL,
      message TEXT NOT NULL,
      attachment_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
    )
  `);
};

exports.down = async (pool) => {
  await pool.query('DROP TABLE IF EXISTS support_ticket_messages');
  await pool.query('DROP TABLE IF EXISTS support_tickets');
};
