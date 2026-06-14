const mysql = require('mysql2/promise');

async function up(conn) {
  await conn.query(
    `INSERT IGNORE INTO system_state (key_name, value_data) VALUES ('admin_upi_id', 'admin@upi')`
  );
}

module.exports = { up };
