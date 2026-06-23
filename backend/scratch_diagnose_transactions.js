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
    const [transactions] = await connection.query(
      "SELECT * FROM transactions WHERE type IN ('interest', 'fdr_maturity') ORDER BY id DESC LIMIT 50"
    );
    console.log('--- Recent FDR Transactions ---');
    console.log(JSON.stringify(transactions, null, 2));

    const [completedFdrs] = await connection.query(
      "SELECT * FROM fdrs WHERE status = 'completed'"
    );
    console.log('--- Completed FDRs ---');
    console.log(JSON.stringify(completedFdrs, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

main();
