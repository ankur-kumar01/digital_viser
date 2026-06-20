const mysql = require('mysql2/promise');

async function update() {
  try {
    const pool = mysql.createPool({host:'localhost',user:'root',password:'root',database:'digital_viser'});
    await pool.query('UPDATE games SET description = ? WHERE slug = ?', ['Create rooms, set wagers, roll dice and challenge players in the real-world Ludo wagers game!', 'ludo']);
    console.log('Description updated');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
update();
