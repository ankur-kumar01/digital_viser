const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'digital_viser'
  });

  try {
    await conn.query("DELETE FROM reward_schemes WHERE type = 'fdr_referral_percent'");
    console.log("Reverted manually inserted scheme");
  } catch (e) {
    console.error(e);
  } finally {
    await conn.end();
  }
}
run();
