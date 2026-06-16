require('dotenv').config();
const { processDailyFinancials } = require('./src/services/interestEngine');
const { pool } = require('./src/db');

async function test() {
  console.log("Running processDailyFinancials...");
  await processDailyFinancials();
  await pool.end();
}
test();
