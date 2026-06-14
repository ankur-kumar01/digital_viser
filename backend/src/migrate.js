const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigrations() {
  console.log('🔄 Starting database migrations...');

  // 1. Establish a temporary connection without a database to create it if it doesn't exist
  const tempConn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
  });

  try {
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    console.log(`✅ Database "${process.env.DB_NAME}" verified/created`);
  } finally {
    await tempConn.end();
  }

  // 2. Connect to the database
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
  });

  try {
    // 3. Create migrations table if it doesn't exist
    await conn.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of executed migrations
    const [rows] = await conn.query('SELECT name FROM migrations');
    const executedMigrations = new Set(rows.map(row => row.name));

    // 4. Get migration files from folder
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('ℹ️ No migrations folder found.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Run in alphabetical order

    // Check if we are running on an existing DB that already has tables, but no migrations logged yet
    // If the 'users' table exists, but '001_initial_schema.js' is NOT in the executed list, we should auto-mark it as executed
    const [tables] = await conn.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `, [process.env.DB_NAME]);

    const usersTableExists = tables.length > 0;

    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`⏭️  Migration "${file}" already executed.`);
        continue;
      }

      if (file === '001_initial_schema.js' && usersTableExists) {
        console.log(`⚠️  Detected existing tables. Auto-marking "${file}" as executed without running SQL.`);
        await conn.query('INSERT INTO migrations (name) VALUES (?)', [file]);
        executedMigrations.add(file);
        continue;
      }

      console.log(`🚀 Executing migration: ${file}`);
      const migration = require(path.join(migrationsDir, file));
      
      // Run the migration
      await migration.up(conn);

      // Record in the database
      await conn.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      console.log(`✅ Successfully executed: ${file}`);
    }

    console.log('🎉 Migrations completed successfully.');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigrations };
