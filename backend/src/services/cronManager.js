const { pool } = require('../db');
const { logger } = require('../utils');

const jobs = {
  daily_financials: {
    key: 'daily_financials',
    name: "Daily Financial Payouts",
    schedule: "Hourly (checks for date change)",
    description: "Calculates FDR daily interests, unlocks matured FDR principal/bonus, updates referral commissions.",
    selfLogging: true,
    run: async () => {
      const { processDailyFinancials } = require('./interestEngine');
      await processDailyFinancials();
    }
  },
  fantasy_sync_matches: {
    key: 'fantasy_sync_matches',
    name: "Fantasy Sync Upcoming Matches",
    schedule: "Every 2 hours",
    description: "Fetch and insert upcoming cricket matches from the Fantasy sports API.",
    run: async () => {
      const fantasyCricketCron = require('../cron/fantasyCricketCron');
      await fantasyCricketCron.syncUpcomingMatches();
    }
  },
  fantasy_sync_squads: {
    key: 'fantasy_sync_squads',
    name: "Fantasy Sync Squads",
    schedule: "Every 15 minutes",
    description: "Sync player squads for matches starting within 72 hours.",
    run: async () => {
      const fantasyCricketCron = require('../cron/fantasyCricketCron');
      await fantasyCricketCron.syncSquads(true);
    }
  },
  fantasy_process_live: {
    key: 'fantasy_process_live',
    name: "Fantasy Process Live Matches",
    schedule: "Every 2 minutes",
    description: "Fetch live matches, calculate player fantasy points, and distribute prizes upon match completion.",
    run: async () => {
      const fantasyCricketCron = require('../cron/fantasyCricketCron');
      await fantasyCricketCron.processLiveMatches();
    }
  },
  ludo_cleanup: {
    key: 'ludo_cleanup',
    name: "Ludo Cleanup Engine",
    schedule: "Every 15 minutes",
    description: "Cancels and refunds waiting rooms older than 12 hours, resolves abandoned matches.",
    run: async () => {
      const LudoCleanup = require('../cron/ludoCleanup');
      const cleanupInstance = new LudoCleanup();
      await cleanupInstance.cleanup();
    }
  },
  ludo_tournaments: {
    key: 'ludo_tournaments',
    name: "Ludo Tournament Processor",
    schedule: "Every 5 minutes",
    description: "Activates scheduled tournaments, finalizes ended tournaments, distributes rank payouts.",
    run: async () => {
      const LudoCleanup = require('../cron/ludoCleanup');
      const cleanupInstance = new LudoCleanup();
      await cleanupInstance.processTournaments();
    }
  }
};

async function runJob(key, triggeredBy = 'manual') {
  const job = jobs[key];
  if (!job) {
    throw new Error(`Job ${key} not found`);
  }

  if (job.selfLogging) {
    await job.run();
    return { success: true };
  }

  let historyId = null;
  try {
    const [histResult] = await pool.query(
      "INSERT INTO cron_history (cron_name, status, details) VALUES (?, 'running', ?)",
      [key, JSON.stringify({ triggered_by: triggeredBy })]
    );
    historyId = histResult.insertId;
    const startTime = Date.now();

    await job.run();

    const durationMs = Date.now() - startTime;
    const details = {
      duration_ms: durationMs,
      triggered_by: triggeredBy
    };

    await pool.query(
      "UPDATE cron_history SET status = 'success', completed_at = CURRENT_TIMESTAMP, details = ? WHERE id = ?",
      [JSON.stringify(details), historyId]
    );
    logger.info(`[CronManager] Job ${key} executed successfully (${triggeredBy}) in ${durationMs}ms`);
    return { success: true, duration_ms: durationMs };
  } catch (err) {
    logger.error(`[CronManager] Job ${key} failed (${triggeredBy}):`, { error: err.message });
    if (historyId) {
      await pool.query(
        "UPDATE cron_history SET status = 'failure', completed_at = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?",
        [err.message, historyId]
      );
    }
    throw err;
  }
}

module.exports = {
  jobs,
  runJob
};
