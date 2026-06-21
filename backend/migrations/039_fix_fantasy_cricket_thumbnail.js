module.exports = {
  up: async (conn) => {
    // Fix the incorrect image_url for Cricket Fantasy game so it shows up correctly on the frontend
    await conn.query(`
      UPDATE games 
      SET image_url = '/images/games/cricket-thumb.png' 
      WHERE slug = 'cricket-fantasy'
    `);
  }
};
