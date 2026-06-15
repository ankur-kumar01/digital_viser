const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'digital_viser',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  });

  try {
    const today = new Date().toISOString().split('T')[0];
    await connection.query(
      "UPDATE system_state SET value_data = ? WHERE key_name = 'simulated_date'",
      [today]
    );
    console.log(`Successfully updated simulated_date in database to: ${today}`);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

main();
