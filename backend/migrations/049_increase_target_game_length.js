/**
 * Migration 049: Increase target_game column length for Multi-Game Targeting
 */

exports.up = async (conn) => {
  try {
    await conn.query(`
      ALTER TABLE fdr_yield_boosters
      MODIFY COLUMN target_game VARCHAR(255) NULL DEFAULT NULL
    `);
  } catch (e) {
    console.error('Error in migration 049 up:', e.message);
  }
  console.log('✅ Migration 049: target_game column expanded to VARCHAR(255).');
};

exports.down = async (conn) => {
  try {
    await conn.query(`
      ALTER TABLE fdr_yield_boosters
      MODIFY COLUMN target_game VARCHAR(50) NULL DEFAULT NULL
    `);
  } catch (e) {
    console.error('Error in migration 049 down:', e.message);
  }
  console.log('❌ Migration 049: target_game column reverted to VARCHAR(50).');
};
