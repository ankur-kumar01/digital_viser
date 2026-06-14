const mysql = require('mysql2/promise');

async function up(conn) {
  // Update the existing game thumbnail URLs to use the frontend public static folder
  await conn.query(`
    UPDATE games 
    SET image_url = '/images/games/aviator-thumb.png' 
    WHERE slug = 'aviator'
  `);
  
  await conn.query(`
    UPDATE games 
    SET image_url = '/images/games/colour-thumb.png' 
    WHERE slug = 'colour-trading'
  `);
}

module.exports = { up };
