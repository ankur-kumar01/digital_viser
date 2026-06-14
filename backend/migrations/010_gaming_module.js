const mysql = require('mysql2/promise');

async function up(conn) {
  // Create games table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS games (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      image_url VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default games if they don't exist
  const [rows] = await conn.query('SELECT COUNT(*) as count FROM games');
  if (rows[0].count === 0) {
    await conn.query(`
      INSERT INTO games (name, slug, description, image_url, is_active) VALUES 
      ('Aviator', 'aviator', 'Watch the plane fly and cash out before it crashes!', '/games/aviator-thumb.jpg', true),
      ('Colour Trading', 'colour-trading', 'Predict the next colour (Red/Green/Violet) and multiply your money.', '/games/colour-thumb.jpg', true)
    `);
  }
}

module.exports = { up };
