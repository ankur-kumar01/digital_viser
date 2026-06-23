const cron = require('node-cron');
const { pool } = require('../db');
const fantasyApi = require('../services/fantasyApi');

class FantasyCricketCron {
  
  constructor() {
    this._processingMatches = new Set(); // Prevent overlapping cron runs
    this._prizeRetryQueue = []; // Match IDs that need prize distribution retry
    this._lastLiveSync = {}; // api_match_id -> timestamp, for API quota protection
  }

  start() {
    console.log('🏏 Fantasy Cricket Cron Engine Started');

    // Sync upcoming matches every 2 hours (reduced from 1 hour to save API quota)
    cron.schedule('0 */2 * * *', async () => {
      console.log('🔄 [Fantasy] Syncing Upcoming Matches...');
      const cronManager = require('../services/cronManager');
      await cronManager.runJob('fantasy_sync_matches', 'system').catch(err => {
        console.error('Fantasy sync matches scheduled job failed:', err.message);
      });
    });

    // Every 15 minutes: Sync squads for upcoming matches within 24 hours
    // Reduced from 5 min to 15 min to preserve API quota
    cron.schedule('*/15 * * * *', async () => {
      console.log('🔄 [Fantasy] Syncing Squads...');
      const cronManager = require('../services/cronManager');
      await cronManager.runJob('fantasy_sync_squads', 'system').catch(err => {
        console.error('Fantasy sync squads scheduled job failed:', err.message);
      });
    });

    // Every 2 minutes: Update live scores & points for LIVE matches
    // Reduced from 1 min to 2 min to preserve API quota
    cron.schedule('*/2 * * * *', async () => {
      const cronManager = require('../services/cronManager');
      await cronManager.runJob('fantasy_process_live', 'system').catch(err => {
        console.error('Fantasy process live scheduled job failed:', err.message);
      });
    });

    // Check prize retry queue every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      if (this._prizeRetryQueue.length > 0) {
        const matchId = this._prizeRetryQueue[0];
        console.log(`🔄 [Fantasy] Retrying prize distribution for match ${matchId}...`);
        await this.distributePrizes(matchId);
      }
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

      // Auto-sync squads for any newly synced matches that don't have players yet
      const [matchesWithoutSquads] = await pool.query(`
        SELECT fm.id, fm.api_match_id FROM fantasy_matches fm
        LEFT JOIN fantasy_match_players fmp ON fm.id = fmp.match_id
        WHERE fm.status = 'upcoming' AND fmp.match_id IS NULL
      `);

      if (matchesWithoutSquads.length > 0) {
        console.log(`🔄 [Fantasy] Auto-syncing squads for ${matchesWithoutSquads.length} matches without players...`);
        await this._syncSquadsForMatches(matchesWithoutSquads);
      }
    } catch (err) {
      console.error('❌ [Fantasy] Sync matches failed:', err.message);
    }
  }

  async syncSquads(force = true) {
    try {
      const [matches] = await pool.query(`
        SELECT id, api_match_id FROM fantasy_matches 
        WHERE status = 'upcoming' AND start_time < DATE_ADD(NOW(), INTERVAL 72 HOUR)
      `);

      await this._syncSquadsForMatches(matches, force);
    } catch (err) {
      console.error('❌ [Fantasy] Sync squads failed:', err.message);
    }
  }

  async _syncSquadsForMatches(matches, force = false) {
    if (matches.length === 0) return;

    for (const m of matches) {
      const squad = await fantasyApi.fetchMatchSquads(m.api_match_id, force);

      if (!squad || squad.length === 0) {
        console.log(`⚠️ [Fantasy] No squad data returned for match ${m.id} (${m.api_match_id})`);
        continue;
      }

      for (const player of squad) {
        await pool.query(`
          INSERT INTO fantasy_players (api_player_id, name, team_name, role, credit_value)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            name=VALUES(name), team_name=VALUES(team_name), role=VALUES(role), credit_value=VALUES(credit_value)
        `, [player.api_player_id, player.name, player.team_name, player.role, player.credit_value]);

        const [pRow] = await pool.query('SELECT id FROM fantasy_players WHERE api_player_id = ?', [player.api_player_id]);
        if (pRow.length > 0) {
          const playerId = pRow[0].id;
          await pool.query(`
            INSERT IGNORE INTO fantasy_match_players (match_id, player_id, is_playing)
            VALUES (?, ?, true)
          `, [m.id, playerId]);
        }
      }

      console.log(`✅ [Fantasy] Synced ${squad.length} players for match ${m.id}`);
    }
  }

  async processLiveMatches() {
    // Prevent overlapping runs
    if (this._processingMatches.size > 0) {
      console.log('⚠️ [Fantasy] Skipping processLiveMatches — previous run still in progress');
      return;
    }

    try {
      // 1. Mark matches as LIVE if start_time has passed
      await pool.query(`UPDATE fantasy_matches SET status = 'live' WHERE status = 'upcoming' AND start_time <= NOW()`);

      const [liveMatches] = await pool.query(`SELECT id, api_match_id FROM fantasy_matches WHERE status = 'live'`);
      if (liveMatches.length === 0) return;

      const [pointRows] = await pool.query('SELECT action_key, points FROM fantasy_point_system');
      const pointsConfig = pointRows.reduce((acc, row) => ({ ...acc, [row.action_key]: parseFloat(row.points) }), {});

      for (const m of liveMatches) {
        this._processingMatches.add(m.id);

        // API quota protection: skip if we synced this match less than 2 minutes ago (real API only)
        const apiKey = await fantasyApi.getApiKey();
        if (apiKey && this._lastLiveSync[m.api_match_id]) {
          const elapsed = Date.now() - this._lastLiveSync[m.api_match_id];
          if (elapsed < 120000) { // 2 min cooldown
            // Still recalc points from stored data without hitting API
            await this._recalculateTeamPoints(m.id, pointsConfig);
            this._processingMatches.delete(m.id);
            continue;
          }
        }

        const scorecard = await fantasyApi.fetchLiveScorecard(m.api_match_id);
        this._lastLiveSync[m.api_match_id] = Date.now();
        
        // 2. Update player points (PERF-001)
        if (scorecard.players && scorecard.players.length > 0) {
          const apiPlayerIds = scorecard.players.map(p => p.api_player_id);
          const [dbPlayers] = await pool.query('SELECT id, api_player_id FROM fantasy_players WHERE api_player_id IN (?)', [apiPlayerIds]);
          const playerMap = new Map(dbPlayers.map(r => [r.api_player_id, r.id]));

          for (const p of scorecard.players) {
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

            const dbPlayerId = playerMap.get(p.api_player_id);
            if (dbPlayerId) {
              await pool.query(`
                UPDATE fantasy_match_players SET points = ?, stats_json = ? 
                WHERE match_id = ? AND player_id = ?
              `, [calculatedPoints, JSON.stringify(s), m.id, dbPlayerId]);
            }
          }
        }

        // 3. Recalculate all team points
        await this._recalculateTeamPoints(m.id, pointsConfig);

        // 4. Check for abandoned/completed
        if (scorecard.status === 'abandoned') {
          // Refund all entries for all contests in this match
          await this._refundMatchEntries(m.id);
          await pool.query('UPDATE fantasy_matches SET status = "abandoned" WHERE id = ?', [m.id]);
        } else if (scorecard.status === 'completed') {
          await pool.query('UPDATE fantasy_matches SET status = "completed", winning_team = ? WHERE id = ?', [scorecard.winning_team, m.id]);
          await this.distributePrizes(m.id);
        }

        this._processingMatches.delete(m.id);
      }
    } catch (err) {
      console.error('❌ [Fantasy] Process Live Matches failed:', err.message);
      this._processingMatches.clear();
    }
  }

  async _recalculateTeamPoints(matchId, pointsConfig) {
    // PERF-002: Batch update total points for all teams in this match
    await pool.query(`
      UPDATE fantasy_user_teams ut
      JOIN (
        SELECT 
          ut.id as team_id,
          SUM(
            CASE 
              WHEN tp.player_id = ut.captain_player_id THEN COALESCE(mp.points, 0) * 2
              WHEN tp.player_id = ut.vice_captain_player_id THEN COALESCE(mp.points, 0) * 1.5
              ELSE COALESCE(mp.points, 0)
            END
          ) as calculated_points
        FROM fantasy_user_teams ut
        JOIN fantasy_team_players tp ON ut.id = tp.team_id
        LEFT JOIN fantasy_match_players mp ON tp.player_id = mp.player_id AND mp.match_id = ut.match_id
        WHERE ut.match_id = ?
        GROUP BY ut.id
      ) as calc ON ut.id = calc.team_id
      SET ut.total_points = calc.calculated_points
    `, [matchId]);

    // PERF-002: Batch update ranks for all contest entries in this match using ROW_NUMBER()
    await pool.query(`
      UPDATE fantasy_user_teams ut
      JOIN (
        SELECT 
          ce.team_id,
          ROW_NUMBER() OVER (PARTITION BY ce.contest_id ORDER BY ut.total_points DESC) as rnk
        FROM fantasy_contest_entries ce
        JOIN fantasy_user_teams ut ON ce.team_id = ut.id
        WHERE ut.match_id = ?
      ) as ranked ON ut.id = ranked.team_id
      SET ut.team_rank = ranked.rnk
    `, [matchId]);
  }

  async _refundMatchEntries(matchId) {
    console.log(`💸 [Fantasy] Refunding all entries for abandoned match ${matchId}`);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [contests] = await conn.query(
        'SELECT id FROM fantasy_contests WHERE match_id = ? AND status NOT IN ("completed", "cancelled")',
        [matchId]
      );

      for (const contest of contests) {
        const [entries] = await conn.query(
          'SELECT id, user_id, fee_paid FROM fantasy_contest_entries WHERE contest_id = ? AND prize_won IS NULL',
          [contest.id]
        );

        for (const entry of entries) {
          const fee = parseFloat(entry.fee_paid);
          // FIX ISSUE-009: Application uses 'users' table for balance, not a separate 'wallets' table
          await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [fee, entry.user_id]);
          await conn.query(`
            INSERT INTO transactions (user_id, amount, type, description, status) 
            VALUES (?, ?, 'refund', ?, 'completed')
          `, [entry.user_id, fee, `Refund for abandoned match contest #${contest.id}`]);
        }

        await conn.query('UPDATE fantasy_contests SET status = "cancelled" WHERE id = ?', [contest.id]);
      }

      await conn.commit();
      console.log(`✅ [Fantasy] Refunds complete for match ${matchId}`);
    } catch (err) {
      await conn.rollback();
      console.error('❌ [Fantasy] Refund failed:', err.message);
    } finally {
      conn.release();
    }
  }

  async distributePrizes(matchId) {
    console.log(`🏆 [Fantasy] Distributing prizes for match ${matchId}`);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [contests] = await conn.query(
        'SELECT id, prize_pool, admin_commission_pct, is_guaranteed, total_spots FROM fantasy_contests WHERE match_id = ? AND status NOT IN ("completed", "cancelled")',
        [matchId]
      );

      for (const contest of contests) {
        // Get entries ranked by per-contest rank (use team_rank from recalculate)
        const [entries] = await conn.query(`
          SELECT ce.id, ce.user_id, ce.team_id, ut.team_rank, ut.total_points
          FROM fantasy_contest_entries ce
          JOIN fantasy_user_teams ut ON ce.team_id = ut.id
          WHERE ce.contest_id = ?
          ORDER BY ut.team_rank ASC
        `, [contest.id]);

        if (entries.length === 0) {
          await conn.query('UPDATE fantasy_contests SET status = "completed" WHERE id = ?', [contest.id]);
          continue;
        }

        const totalPrize = parseFloat(contest.prize_pool);
        const commission = (totalPrize * parseFloat(contest.admin_commission_pct)) / 100;
        const distributablePrize = totalPrize - commission;
        const isGuaranteed = contest.is_guaranteed === 1 || contest.is_guaranteed === true;

        // Multi-tier prize distribution
        let prizeTiers;
        const entryCount = entries.length;

        if (entryCount === 1) {
          // Solo entry - refund fee minus commission
          prizeTiers = [{ rank: 1, pct: 100 }];
        } else if (entryCount === 2) {
          prizeTiers = [{ rank: 1, pct: 70 }, { rank: 2, pct: 30 }];
        } else if (entryCount <= 5) {
          prizeTiers = [{ rank: 1, pct: 50 }, { rank: 2, pct: 30 }, { rank: 3, pct: 20 }];
        } else if (entryCount <= 10) {
          prizeTiers = [{ rank: 1, pct: 40 }, { rank: 2, pct: 25 }, { rank: 3, pct: 15 }, { rank: 4, pct: 10 }, { rank: 5, pct: 10 }];
        } else {
          prizeTiers = [
            { rank: 1, pct: 30 }, { rank: 2, pct: 20 }, { rank: 3, pct: 12 },
            { rank: 4, pct: 8 }, { rank: 5, pct: 6 },
            { rank: 6, pct: 5 }, { rank: 7, pct: 4 }, { rank: 8, pct: 3 },
            { rank: 9, pct: 2 }, { rank: 10, pct: 2 },
            { rank: 11, pct: 2 }, { rank: 12, pct: 2 },
            { rank: 13, pct: 1 }, { rank: 14, pct: 1 }, { rank: 15, pct: 1 },
          ];
        }

        // If not guaranteed and not enough entries, scale prizes or refund
        if (!isGuaranteed && entryCount < Math.min(3, contest.total_spots)) {
          // Not enough entries for non-guaranteed: refund all
          for (const entry of entries) {
            const fee = parseFloat(entry.fee_paid || 0);
            // FIX ISSUE-009: Use users table (no separate 'wallets' table exists)
            await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [fee, entry.user_id]);
            await conn.query(`
              INSERT INTO transactions (user_id, amount, type, description, status) 
              VALUES (?, ?, 'refund', ?, 'completed')
            `, [entry.user_id, fee, `Refund - contest #${contest.id} did not fill`]);
          }
          await conn.query('UPDATE fantasy_contests SET status = "cancelled", filled_spots = 0 WHERE id = ?', [contest.id]);
          continue;
        }

        // Distribute prizes per tier
        for (const tier of prizeTiers) {
          if (tier.rank > entries.length) break;
          const entry = entries[tier.rank - 1];
          const prizeAmount = (distributablePrize * tier.pct) / 100;

          await conn.query('UPDATE fantasy_contest_entries SET prize_won = ? WHERE id = ?', [prizeAmount, entry.id]);
          // FIX ISSUE-009: Use users table for prize payout
          await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [prizeAmount, entry.user_id]);
          await conn.query(`
            INSERT INTO transactions (user_id, amount, type, description, status) 
            VALUES (?, ?, 'game_win', ?, 'completed')
          `, [entry.user_id, prizeAmount, `Fantasy Cricket Won - Contest #${contest.id}`]);
        }

        await conn.query('UPDATE fantasy_contests SET status = "completed" WHERE id = ?', [contest.id]);
      }

      await conn.commit();
      console.log(`✅ [Fantasy] Prizes distributed for match ${matchId}`);
      // Remove from retry queue if present
      this._prizeRetryQueue = this._prizeRetryQueue.filter(id => id !== matchId);
    } catch (err) {
      await conn.rollback();
      console.error('❌ [Fantasy] Distribute Prizes failed:', err.message);
      // Add to retry queue (don't set match as completed)
      if (!this._prizeRetryQueue.includes(matchId)) {
        this._prizeRetryQueue.push(matchId);
        console.log(`🔄 [Fantasy] Added match ${matchId} to prize retry queue`);
      }
    } finally {
      conn.release();
    }
  }

}

module.exports = new FantasyCricketCron();
