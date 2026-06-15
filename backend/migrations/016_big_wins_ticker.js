async function up(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS big_wins (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_name VARCHAR(255) NOT NULL,
      amount VARCHAR(255) NOT NULL,
      game_name VARCHAR(255) NOT NULL,
      game_color VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await conn.query('SELECT COUNT(*) as count FROM big_wins');
  if (rows[0].count === 0) {
    const sampleData = [
      ['Rahul_99', '₹14,500', 'Aviator', 'var(--accent-secondary)'],
      ['PriyaK', '₹8,200', 'Colour Trading', 'var(--accent-primary)'],
      ['VikramSingh', '₹32,000', 'Aviator', 'var(--accent-secondary)'],
      ['Anita_D', '₹5,600', 'Colour Trading', 'var(--accent-primary)'],
      ['Rajesh007', '₹21,000', 'Aviator', 'var(--accent-secondary)'],
      ['Sneha_M', '₹11,400', 'Colour Trading', 'var(--accent-primary)'],
      ['KaranB', '₹4,500', 'Aviator', 'var(--accent-secondary)'],
      ['Deepa22', '₹18,000', 'Colour Trading', 'var(--accent-primary)']
    ];

    for (const win of sampleData) {
      await conn.query(
        'INSERT INTO big_wins (user_name, amount, game_name, game_color) VALUES (?, ?, ?, ?)',
        win
      );
    }
  }
}

module.exports = { up };
