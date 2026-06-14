const mysql = require('mysql2/promise');

async function up(conn) {
  await conn.query(`
    ALTER TABLE locked_funds
    ADD COLUMN unlock_date DATE NULL;
  `);
}

module.exports = { up };
