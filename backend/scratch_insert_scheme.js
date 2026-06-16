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
    const [rows] = await conn.query("SELECT * FROM reward_schemes WHERE type = 'fdr_referral_percent'");
    if (rows.length === 0) {
      await conn.query("INSERT INTO reward_schemes (type, min_amount, reward_amount, is_active) VALUES ('fdr_referral_percent', 0, 5, 1)");
      console.log("Inserted fdr_referral_percent scheme");
    } else {
      console.log("fdr_referral_percent already exists");
    }
  } catch (e) {
    console.error(e);
  } finally {
    await conn.end();
  }
}
run();
