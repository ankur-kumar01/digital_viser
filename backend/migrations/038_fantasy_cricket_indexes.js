const mysql = require('mysql2/promise');

async function up(conn) {
  // 1. Add max_entries_per_user column to fantasy_contests
  try {
    await conn.query(`
      ALTER TABLE fantasy_contests 
      ADD COLUMN max_entries_per_user INT DEFAULT 1
    `);
    console.log('✅ Added max_entries_per_user to fantasy_contests');
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_COLUMN') throw err;
    console.log('⏩ max_entries_per_user already exists');
  }

  // 2. Add indexes for performance
  const indexes = [
    { table: 'fantasy_contests', column: 'match_id', name: 'idx_fc_match_id' },
    { table: 'fantasy_user_teams', column: 'match_id', name: 'idx_fut_match_id' },
    { table: 'fantasy_user_teams', column: 'user_id', name: 'idx_fut_user_id' },
    { table: 'fantasy_contest_entries', column: 'contest_id', name: 'idx_fce_contest_id' },
    { table: 'fantasy_contest_entries', column: 'user_id', name: 'idx_fce_user_id' },
    { table: 'fantasy_match_players', column: 'match_id', name: 'idx_fmp_match_id' },
    { table: 'fantasy_team_players', column: 'team_id', name: 'idx_ftp_team_id' },
    { table: 'fantasy_players', column: 'api_player_id', name: 'idx_fp_api_id' },
  ];

  for (const idx of indexes) {
    try {
      await conn.query(`ALTER TABLE ${idx.table} ADD INDEX ${idx.name} (${idx.column})`);
      console.log(`✅ Added index ${idx.name} on ${idx.table}(${idx.column})`);
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') throw err;
      console.log(`⏩ Index ${idx.name} already exists`);
    }
  }
}

module.exports = { up };
