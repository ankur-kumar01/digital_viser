/**
 * Migration 048: Dynamic Targeting Rules for Yield Boosters
 */

exports.up = async (conn) => {
  try {
    await conn.query(`
      ALTER TABLE fdr_yield_boosters
      ADD COLUMN target_game VARCHAR(50) NULL DEFAULT NULL,
      ADD COLUMN target_operator VARCHAR(10) NULL DEFAULT NULL,
      ADD COLUMN target_value INT DEFAULT 0,
      ADD COLUMN target_days INT NULL DEFAULT NULL
    `);
  } catch (e) {
    console.error('Error in migration 048 up:', e.message);
  }
  console.log('✅ Migration 048: Dynamic targeting columns added.');
};

exports.down = async (conn) => {
  try {
    await conn.query(`
      ALTER TABLE fdr_yield_boosters
      DROP COLUMN target_game,
      DROP COLUMN target_operator,
      DROP COLUMN target_value,
      DROP COLUMN target_days
    `);
  } catch (e) {
    console.error('Error in migration 048 down:', e.message);
  }
  console.log('❌ Migration 048: Dynamic targeting columns dropped.');
};
