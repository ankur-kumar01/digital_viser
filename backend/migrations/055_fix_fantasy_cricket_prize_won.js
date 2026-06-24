/**
 * Migration 055: Fix Fantasy Cricket prize_won Default and Add team_rank to Entries
 */

exports.up = async (conn) => {
  try {
    // 1. Modify column prize_won to DEFAULT NULL
    await conn.query(`
      ALTER TABLE fantasy_contest_entries MODIFY COLUMN prize_won DECIMAL(10,2) DEFAULT NULL
    `);
    
    // 2. Update existing entries where prize_won = 0 to NULL
    await conn.query(`
      UPDATE fantasy_contest_entries SET prize_won = NULL WHERE prize_won = 0.00
    `);

    // 3. Add column team_rank to fantasy_contest_entries
    await conn.query(`
      ALTER TABLE fantasy_contest_entries ADD COLUMN team_rank INT DEFAULT NULL AFTER team_id
    `);

    console.log('✅ Migration 055: prize_won and team_rank fixes applied.');
  } catch (e) {
    console.error('Error in migration 055 up:', e.message);
    throw e;
  }
};

exports.down = async (conn) => {
  try {
    // Remove the added column and restore previous structure
    await conn.query(`
      ALTER TABLE fantasy_contest_entries DROP COLUMN team_rank
    `);
    await conn.query(`
      ALTER TABLE fantasy_contest_entries MODIFY COLUMN prize_won DECIMAL(10,2) DEFAULT 0.00
    `);
    console.log('❌ Migration 055: prize_won and team_rank fixes rolled back.');
  } catch (e) {
    console.error('Error in migration 055 down:', e.message);
  }
};
