const mysql = require('mysql2/promise');

async function up(conn) {
  // 1. Insert the game into the main games table
  const [rows] = await conn.query('SELECT id FROM games WHERE slug = ?', ['cricket-fantasy']);
  if (rows.length === 0) {
    await conn.query(`
      INSERT INTO games (name, slug, description, image_url, is_active, min_bet, max_bet) VALUES 
      ('Cricket Fantasy', 'cricket-fantasy', 'Create your dream team, join contests, and win real cash based on real-world match performance!', '/games/cricket-thumb.jpg', true, 10, 100000)
    `);
  }

  // 2. Fantasy Matches
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fantasy_matches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      api_match_id VARCHAR(255) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      short_title VARCHAR(100),
      subtitle VARCHAR(255),
      format VARCHAR(50),
      team_a VARCHAR(100),
      team_a_logo VARCHAR(255),
      team_b VARCHAR(100),
      team_b_logo VARCHAR(255),
      start_time DATETIME NOT NULL,
      status ENUM('upcoming', 'live', 'completed', 'abandoned') DEFAULT 'upcoming',
      winning_team VARCHAR(100),
      toss_winner VARCHAR(100),
      toss_decision VARCHAR(50),
      score_team_a VARCHAR(100),
      score_team_b VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // 3. Fantasy Players
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fantasy_players (
      id INT AUTO_INCREMENT PRIMARY KEY,
      api_player_id VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      team_name VARCHAR(100),
      role ENUM('batsman', 'bowler', 'all-rounder', 'wicket-keeper') NOT NULL,
      image_url VARCHAR(255),
      credit_value DECIMAL(4, 1) DEFAULT 8.5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // 4. Match Players (Players playing in a specific match with their live stats)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fantasy_match_players (
      id INT AUTO_INCREMENT PRIMARY KEY,
      match_id INT NOT NULL,
      player_id INT NOT NULL,
      is_playing BOOLEAN DEFAULT FALSE,
      points DECIMAL(8, 2) DEFAULT 0.00,
      stats_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_match_player (match_id, player_id),
      FOREIGN KEY (match_id) REFERENCES fantasy_matches(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES fantasy_players(id) ON DELETE CASCADE
    )
  `);

  // 5. Fantasy Contests
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fantasy_contests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      match_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      entry_fee DECIMAL(10, 2) NOT NULL,
      prize_pool DECIMAL(10, 2) NOT NULL,
      total_spots INT NOT NULL,
      filled_spots INT DEFAULT 0,
      is_guaranteed BOOLEAN DEFAULT FALSE,
      status ENUM('open', 'closed', 'completed', 'cancelled') DEFAULT 'open',
      first_prize DECIMAL(10, 2),
      admin_commission_pct DECIMAL(5, 2) DEFAULT 10.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES fantasy_matches(id) ON DELETE CASCADE
    )
  `);

  // 6. User Teams
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fantasy_user_teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      match_id INT NOT NULL,
      captain_player_id INT NOT NULL,
      vice_captain_player_id INT NOT NULL,
      total_points DECIMAL(8, 2) DEFAULT 0.00,
      team_rank INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (match_id) REFERENCES fantasy_matches(id) ON DELETE CASCADE,
      FOREIGN KEY (captain_player_id) REFERENCES fantasy_players(id),
      FOREIGN KEY (vice_captain_player_id) REFERENCES fantasy_players(id)
    )
  `);

  // 7. Team Players (11 mapping)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fantasy_team_players (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_id INT NOT NULL,
      player_id INT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES fantasy_user_teams(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES fantasy_players(id) ON DELETE CASCADE
    )
  `);

  // 8. Contest Entries
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fantasy_contest_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      contest_id INT NOT NULL,
      team_id INT NOT NULL,
      fee_paid DECIMAL(10, 2) NOT NULL,
      prize_won DECIMAL(10, 2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (contest_id) REFERENCES fantasy_contests(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES fantasy_user_teams(id) ON DELETE CASCADE
    )
  `);

  // 9. Point System Configuration
  await conn.query(`
    CREATE TABLE IF NOT EXISTS fantasy_point_system (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action_key VARCHAR(100) UNIQUE NOT NULL,
      action_name VARCHAR(255) NOT NULL,
      points DECIMAL(5, 1) NOT NULL,
      format VARCHAR(50) DEFAULT 'T20',
      description TEXT
    )
  `);

  // Seed default point system for T20
  const [pointRows] = await conn.query('SELECT COUNT(*) as count FROM fantasy_point_system');
  if (pointRows[0].count === 0) {
    await conn.query(`
      INSERT INTO fantasy_point_system (action_key, action_name, points, description) VALUES
      ('run', 'Every Run', 1.0, 'Points per run scored'),
      ('boundary', 'Boundary Bonus', 1.0, 'Extra points for hitting a 4'),
      ('six', 'Six Bonus', 2.0, 'Extra points for hitting a 6'),
      ('half_century', 'Half Century', 8.0, 'Bonus for reaching 50 runs'),
      ('century', 'Century', 16.0, 'Bonus for reaching 100 runs'),
      ('duck', 'Duck Penalty', -2.0, 'Penalty for getting out on 0 (Batsmen, WK, AR only)'),
      ('wicket', 'Wicket', 25.0, 'Points per wicket taken (excluding runouts)'),
      ('lbw_bowled', 'LBW / Bowled Bonus', 8.0, 'Bonus points for LBW or Bowled'),
      ('three_wickets', '3 Wicket Haul', 4.0, 'Bonus for taking 3 wickets'),
      ('four_wickets', '4 Wicket Haul', 8.0, 'Bonus for taking 4 wickets'),
      ('five_wickets', '5 Wicket Haul', 16.0, 'Bonus for taking 5 wickets'),
      ('maiden_over', 'Maiden Over', 12.0, 'Bonus for bowling a maiden over'),
      ('catch', 'Catch', 8.0, 'Points for taking a catch'),
      ('three_catches', '3 Catch Bonus', 4.0, 'Bonus for 3 catches in a match'),
      ('stumping', 'Stumping', 12.0, 'Points for a stumping'),
      ('run_out_direct', 'Run Out (Direct Hit)', 12.0, 'Points for a direct hit run out'),
      ('run_out_thrower', 'Run Out (Thrower)', 6.0, 'Points for the thrower in run out'),
      ('run_out_catcher', 'Run Out (Catcher)', 6.0, 'Points for the catcher in run out')
    `);
  }
}

module.exports = { up };
