const { pool } = require('../db');

/**
 * Check user eligibility for yield booster target types based on simulated date.
 * @param {number} userId - ID of the user to check
 * @param {string} targetType - Type of targeting ('all', 'inactive_2d', 'inactive_7d_reg', 'custom')
 * @param {object|number|string|null} booster - Booster configuration object, or booster ID
 * @returns {Promise<boolean>}
 */
async function checkEligibility(userId, targetType, booster = null) {
  if (targetType === 'all') {
    return true;
  }

  // Get simulated date
  const [stateRows] = await pool.query(
    "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
  );
  const simulatedDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

  if (targetType === 'inactive_2d') {
    // Check if user has played any of the 5 games in the previous 2 days relative to simulated_date
    const [aviator] = await pool.query(
      `SELECT COUNT(*) as count FROM aviator_bets 
       WHERE user_id = ? AND DATE(created_at) >= DATE(?) - INTERVAL 2 DAY`,
      [userId, simulatedDate]
    );

    const [ct] = await pool.query(
      `SELECT COUNT(*) as count FROM ct_bets 
       WHERE user_id = ? AND DATE(created_at) >= DATE(?) - INTERVAL 2 DAY`,
      [userId, simulatedDate]
    );

    const [fruit] = await pool.query(
      `SELECT COUNT(*) as count FROM fruit_bets 
       WHERE user_id = ? AND DATE(created_at) >= DATE(?) - INTERVAL 2 DAY`,
      [userId, simulatedDate]
    );

    const [ludo] = await pool.query(
      `SELECT COUNT(*) as count FROM ludo_rooms 
       WHERE (host_id = ? OR challenger_id = ?) AND DATE(created_at) >= DATE(?) - INTERVAL 2 DAY`,
      [userId, userId, simulatedDate]
    );

    const [fantasy] = await pool.query(
      `SELECT COUNT(*) as count FROM fantasy_contest_entries 
       WHERE user_id = ? AND DATE(created_at) >= DATE(?) - INTERVAL 2 DAY`,
      [userId, simulatedDate]
    );

    const totalRecentGames = 
      (aviator[0]?.count || 0) + 
      (ct[0]?.count || 0) + 
      (fruit[0]?.count || 0) + 
      (ludo[0]?.count || 0) + 
      (fantasy[0]?.count || 0);

    return totalRecentGames === 0;
  }

  if (targetType === 'inactive_7d_reg') {
    // Check if user created_at is older than 7 days relative to simulated_date
    const [regCheck] = await pool.query(
      `SELECT (DATE(created_at) <= DATE(?) - INTERVAL 7 DAY) as registered_7_days_ago FROM users WHERE id = ?`,
      [simulatedDate, userId]
    );
    
    if (!regCheck[0]?.registered_7_days_ago) {
      return false;
    }

    // Verify user has placed exactly 0 bets/games ever
    const [aviator] = await pool.query(
      `SELECT COUNT(*) as count FROM aviator_bets WHERE user_id = ?`,
      [userId]
    );
    const [ct] = await pool.query(
      `SELECT COUNT(*) as count FROM ct_bets WHERE user_id = ?`,
      [userId]
    );
    const [fruit] = await pool.query(
      `SELECT COUNT(*) as count FROM fruit_bets WHERE user_id = ?`,
      [userId]
    );
    const [ludo] = await pool.query(
      `SELECT COUNT(*) as count FROM ludo_rooms WHERE host_id = ? OR challenger_id = ?`,
      [userId, userId]
    );
    const [fantasy] = await pool.query(
      `SELECT COUNT(*) as count FROM fantasy_contest_entries WHERE user_id = ?`,
      [userId]
    );

    const totalLifetimeGames = 
      (aviator[0]?.count || 0) + 
      (ct[0]?.count || 0) + 
      (fruit[0]?.count || 0) + 
      (ludo[0]?.count || 0) + 
      (fantasy[0]?.count || 0);

    return totalLifetimeGames === 0;
  }

  if (targetType === 'custom') {
    if (!booster) return false;

    // Load booster config if only ID was passed
    if (typeof booster === 'number' || typeof booster === 'string') {
      const [boosterRows] = await pool.query('SELECT * FROM fdr_yield_boosters WHERE id = ?', [booster]);
      booster = boosterRows[0] || null;
    }

    if (!booster) return false;

    const game = booster.target_game || 'any';
    const operator = booster.target_operator || '>=';
    const targetValue = parseInt(booster.target_value, 10) || 0;
    const days = booster.target_days; // null or positive number

    let queryDateFilter = '';
    let queryParams = [];

    if (days !== null && days !== undefined && !isNaN(parseInt(days, 10))) {
      queryDateFilter = ' AND DATE(created_at) >= DATE(?) - INTERVAL ? DAY';
    }

    const getCount = async (table, userCol = 'user_id') => {
      let sql = `SELECT COUNT(*) as count FROM ${table} WHERE `;
      let params = [];
      if (table === 'ludo_rooms') {
        sql += `(host_id = ? OR challenger_id = ?)`;
        params.push(userId, userId);
      } else {
        sql += `${userCol} = ?`;
        params.push(userId);
      }

      if (queryDateFilter) {
        sql += queryDateFilter;
        params.push(simulatedDate, parseInt(days, 10));
      }

      const [res] = await pool.query(sql, params);
      return res[0]?.count || 0;
    };

    let totalPlays = 0;
    const selectedGames = game.split(',').map(g => g.trim());

    for (const g of selectedGames) {
      if (g === 'any') {
        const pAviator = await getCount('aviator_bets');
        const pCt = await getCount('ct_bets');
        const pFruit = await getCount('fruit_bets');
        const pLudo = await getCount('ludo_rooms');
        const pFantasy = await getCount('fantasy_contest_entries');
        totalPlays += (pAviator + pCt + pFruit + pLudo + pFantasy);
      } else if (g === 'aviator') {
        totalPlays += await getCount('aviator_bets');
      } else if (g === 'colour-trading') {
        totalPlays += await getCount('ct_bets');
      } else if (g === 'fruit-slasher') {
        totalPlays += await getCount('fruit_bets');
      } else if (g === 'ludo') {
        totalPlays += await getCount('ludo_rooms');
      } else if (g === 'cricket-fantasy') {
        totalPlays += await getCount('fantasy_contest_entries');
      }
    }

    if (operator === '<') {
      return totalPlays < targetValue;
    } else if (operator === '>=') {
      return totalPlays >= targetValue;
    } else if (operator === '=') {
      return totalPlays === targetValue;
    }
  }

  return false;
}

module.exports = {
  checkEligibility
};
