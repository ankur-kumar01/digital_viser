/**
 * Migration 050: Gameplay Unlock Requirements for Yield Boosters
 */

exports.up = async (conn) => {
  try {
    await conn.query(`
      ALTER TABLE fdr_yield_boosters
      ADD COLUMN unlock_game VARCHAR(255) NULL DEFAULT NULL,
      ADD COLUMN unlock_value INT DEFAULT 0
    `);
  } catch (e) {
    console.error('Error in migration 050 up:', e.message);
  }
  console.log('✅ Migration 050: Unlock requirements columns added.');
};

exports.down = async (conn) => {
  try {
    await conn.query(`
      ALTER TABLE fdr_yield_boosters
      DROP COLUMN unlock_game,
      DROP COLUMN unlock_value
    `);
  } catch (e) {
    console.error('Error in migration 050 down:', e.message);
  }
  console.log('❌ Migration 050: Unlock requirements columns dropped.');
};
