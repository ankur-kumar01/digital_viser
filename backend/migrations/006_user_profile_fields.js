const mysql = require('mysql2/promise');

async function up(conn) {
  // Add demographic and profile photo columns to users table
  await conn.query(`
    ALTER TABLE users
    ADD COLUMN phone_number VARCHAR(20) NULL,
    ADD COLUMN address VARCHAR(255) NULL,
    ADD COLUMN city VARCHAR(100) NULL,
    ADD COLUMN state VARCHAR(100) NULL,
    ADD COLUMN pin_code VARCHAR(20) NULL,
    ADD COLUMN profile_photo VARCHAR(255) NULL;
  `);
}

module.exports = { up };
