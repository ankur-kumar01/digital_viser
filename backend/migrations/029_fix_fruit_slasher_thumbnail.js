module.exports = {
  up: async (pool) => {
    await pool.query(`
      UPDATE games 
      SET image_url = '/images/games/fruit-slasher-thumb.png' 
      WHERE slug = 'fruit-slasher'
    `);
  },
  down: async (pool) => {
    await pool.query(`
      UPDATE games 
      SET image_url = '/images/games/fruit-slasher-thumb.jpg' 
      WHERE slug = 'fruit-slasher'
    `);
  }
};
