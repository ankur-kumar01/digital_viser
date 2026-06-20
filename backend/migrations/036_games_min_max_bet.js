const mysql = require('mysql2/promise');

async function up(conn) {
  // Add min_bet and max_bet columns to games table
  await conn.query(`
    ALTER TABLE games 
    ADD COLUMN min_bet DECIMAL(10,2) DEFAULT 10.00,
    ADD COLUMN max_bet DECIMAL(10,2) DEFAULT 100000.00
  `);
}

module.exports = { up };
