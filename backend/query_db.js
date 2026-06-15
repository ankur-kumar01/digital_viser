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
    const [offers] = await connection.query('SELECT * FROM fdr_offers');
    console.log('--- fdr_offers ---');
    console.log(offers);

    const [systemState] = await connection.query('SELECT * FROM system_state');
    console.log('--- system_state ---');
    console.log(systemState);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

main();
