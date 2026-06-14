const mysql = require('mysql2/promise');

async function up(conn) {
  // Add custom fields to payment_methods
  await conn.query(`
    ALTER TABLE payment_methods 
    ADD COLUMN admin_instructions JSON NULL,
    ADD COLUMN user_form JSON NULL
  `);

  // Add custom_data to deposits
  await conn.query(`
    ALTER TABLE deposits 
    ADD COLUMN custom_data JSON NULL
  `);

  // Add custom_data to withdrawals
  await conn.query(`
    ALTER TABLE withdrawals 
    ADD COLUMN custom_data JSON NULL
  `);
}

module.exports = { up };
