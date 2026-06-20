const cron = require('node-cron');
const { pool } = require('../db');
const fantasyApi = require('../services/fantasyApi');

class FantasyCricketCron {
  
  start() {
    console.log('🏏 Fantasy Cricket Cron Engine Started');

    // Sync upcoming matches every hour
    cron.schedule('0 * * * *', async () => {
      console.log('🔄 [Fantasy] Syncing Upcoming Matches...');
      await this.syncUpcomingMatches();
    });

    // Every 5 minutes: Sync squads for upcoming matches that are within 24 hours
    cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 [Fantasy] Syncing Squads...');
      await this.syncSquads();
    });

    // Every 1 minute: Update live scores & points for LIVE matches
    cron.schedule('* * * * *', async () => {
      await this.processLiveMatches();
    });
  }

  async syncUpcomingMatches() {
    try {
      const matches = await fantasyApi.fetchUpcomingMatches();
      for (const m of matches) {
        await pool.query(`
          INSERT INTO fantasy_matches (api_match_id, title, short_title, subtitle, format, team_a, team_a_logo, team_b, team_b_logo, start_time, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            title=VALUES(title), start_time=VALUES(start_time), status=IF(status='upcoming', VALUES(status), status)
        `, [m.api_match_id, m.title, m.short_title, m.subtitle, m.format, m.team_a, m.team_a_logo, m.team_b, m.team_b_logo, m.start_time, m.status]);
      }
    } catch (err) {
      console.error('❌ [Fantasy] Sync matches failed:', err.message);
    }
  }

  async syncSquads() {
    try {
      // Get upcoming matches starting within 24 hours
      const [matches] = await pool.query(`
        SELECT id, api_match_id FROM fantasy_matches 
        WHERE status = 'upcoming' AND start_time < DATE_ADD(NOW(), INTERVAL 24 HOUR)
      `);

      for (const m of matches) {
        const squad = await fantasyApi.fetchMatchSquads(m.api_match_id);
        
        for (const player of squad) {
          // Insert player if not exists
          await pool.query(`
            INSERT INTO fantasy_players (api_player_id, name, team_name, role, credit_value)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE credit_value=VALUES(credit_value)
          `, [player.api_player_id, player.name, player.team_name, player.role, player.credit_value]);

          const [pRow] = await pool.query('SELECT id FROM fantasy_players WHERE api_player_id = ?', [player.api_player_id]);
          if (pRow.length > 0) {
            const playerId = pRow[0].id;
            // Map player to match
            await pool.query(`
              INSERT IGNORE INTO fantasy_match_players (match_id, player_id, is_playing)
              VALUES (?, ?, true)
            `, [m.id, playerId]);
          }
        }
      }
    } catch (err) {
      console.error('❌ [Fantasy] Sync squads failed:', err.message);
    }
  }

  async processLiveMatches() {
    try {
      // 1. Mark matches as LIVE if start_time has passed
      await pool.query(`UPDATE fantasy_matches SET status = 'live' WHERE status = 'upcoming' AND start_time <= NOW()`);

      const [liveMatches] = await pool.query(`SELECT id, api_match_id FROM fantasy_matches WHERE status = 'live'`);
      if (liveMatches.length === 0) return;

      // 2. Fetch point system configuration
      const [pointRows] = await pool.query('SELECT action_key, points FROM fantasy_point_system');
      const pointsConfig = pointRows.reduce((acc, row) => ({ ...acc, [row.action_key]: parseFloat(row.points) }), {});

      for (const m of liveMatches) {
        const scorecard = await fantasyApi.fetchLiveScorecard(m.api_match_id);
        
        // 3. Update points
        for (const p of scorecard.players) {
          // Calculate points based on mock stats
          const s = p.stats;
          let calculatedPoints = 0;
          calculatedPoints += (s.runs || 0) * (pointsConfig['run'] || 1);
          calculatedPoints += (s.boundaries || 0) * (pointsConfig['boundary'] || 1);
          calculatedPoints += (s.sixes || 0) * (pointsConfig['six'] || 2);
          calculatedPoints += (s.wickets || 0) * (pointsConfig['wicket'] || 25);
          calculatedPoints += (s.catches || 0) * (pointsConfig['catch'] || 8);
          if (s.runs >= 100) calculatedPoints += (pointsConfig['century'] || 16);
          else if (s.runs >= 50) calculatedPoints += (pointsConfig['half_century'] || 8);
          if (s.is_duck) calculatedPoints += (pointsConfig['duck'] || -2);

          const [dbPlayer] = await pool.query('SELECT id FROM fantasy_players WHERE api_player_id = ?', [p.api_player_id]);
          if (dbPlayer.length > 0) {
            await pool.query(`
              UPDATE fantasy_match_players SET points = ?, stats_json = ? 
              WHERE match_id = ? AND player_id = ?
            `, [calculatedPoints, JSON.stringify(s), m.id, dbPlayer[0].id]);
          }
        }

        // 4. Recalculate User Team Points
        // We sum the points of all 11 players for each team. Cap = 2x, VC = 1.5x
        const [teams] = await pool.query('SELECT id, captain_player_id, vice_captain_player_id FROM fantasy_user_teams WHERE match_id = ?', [m.id]);
        
        for (const team of teams) {
          const [players] = await pool.query(`
            SELECT tp.player_id, mp.points 
            FROM fantasy_team_players tp
            JOIN fantasy_match_players mp ON tp.player_id = mp.player_id AND mp.match_id = ?
            WHERE tp.team_id = ?
          `, [m.id, team.id]);

          let total = 0;
          players.forEach(pl => {
            let pts = parseFloat(pl.points || 0);
            if (pl.player_id === team.captain_player_id) pts *= 2;
            else if (pl.player_id === team.vice_captain_player_id) pts *= 1.5;
            total += pts;
          });

          await pool.query('UPDATE fantasy_user_teams SET total_points = ? WHERE id = ?', [total, team.id]);
        }

        // 5. Update Contest Ranks
        // Simplified: Rank teams by total_points DESC
        const [rankedTeams] = await pool.query('SELECT id FROM fantasy_user_teams WHERE match_id = ? ORDER BY total_points DESC', [m.id]);
        for (let i = 0; i < rankedTeams.length; i++) {
          await pool.query('UPDATE fantasy_user_teams SET team_rank = ? WHERE id = ?', [i + 1, rankedTeams[i].id]);
        }

        // 6. Check if match is completed
        if (scorecard.status === 'completed') {
          await pool.query('UPDATE fantasy_matches SET status = "completed", winning_team = ? WHERE id = ?', [scorecard.winning_team, m.id]);
          await this.distributePrizes(m.id);
        }
      }
    } catch (err) {
      console.error('❌ [Fantasy] Process Live Matches failed:', err.message);
    }
  }

  async distributePrizes(matchId) {
    console.log(`🏆 [Fantasy] Distributing prizes for match \${matchId}`);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [contests] = await conn.query('SELECT id, prize_pool, admin_commission_pct FROM fantasy_contests WHERE match_id = ? AND status != "completed"', [matchId]);

      for (const contest of contests) {
        // Get all entries for this contest, ordered by team rank
        const [entries] = await conn.query(`
          SELECT ce.id, ce.user_id, ce.team_id, ut.team_rank 
          FROM fantasy_contest_entries ce
          JOIN fantasy_user_teams ut ON ce.team_id = ut.id
          WHERE ce.contest_id = ?
          ORDER BY ut.team_rank ASC
        `, [contest.id]);

        if (entries.length === 0) {
          await conn.query('UPDATE fantasy_contests SET status = "completed" WHERE id = ?', [contest.id]);
          continue;
        }

        // Very simple prize distribution: Winner takes all (Prize Pool minus Commission)
        // A robust system would have a 'prize_breakdown' table.
        const totalPrize = parseFloat(contest.prize_pool);
        const commission = (totalPrize * parseFloat(contest.admin_commission_pct)) / 100;
        const distributablePrize = totalPrize - commission;

        const winner = entries[0]; // Rank 1

        // Update Entry
        await conn.query('UPDATE fantasy_contest_entries SET prize_won = ? WHERE id = ?', [distributablePrize, winner.id]);
        
        // Update User Wallet
        await conn.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [distributablePrize, winner.user_id]);
        
        // Log Transaction
        await conn.query(`
          INSERT INTO transactions (user_id, amount, type, description, status) 
          VALUES (?, ?, 'game_win', ?, 'completed')
        `, [winner.user_id, distributablePrize, `Fantasy Cricket Won - Contest #\${contest.id}`]);

        // Mark Contest Completed
        await conn.query('UPDATE fantasy_contests SET status = "completed" WHERE id = ?', [contest.id]);
      }

      await conn.commit();
      console.log(`✅ [Fantasy] Prizes distributed for match \${matchId}`);
    } catch (err) {
      await conn.rollback();
      console.error('❌ [Fantasy] Distribute Prizes failed:', err.message);
    } finally {
      conn.release();
    }
  }

}

module.exports = new FantasyCricketCron();
