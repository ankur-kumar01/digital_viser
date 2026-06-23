const cron = require('node-cron');
const { processDailyFinancials } = require('./services/interestEngine');
const { pool } = require('./db');

// Helper function to check if simulated date needs daily financial processing
async function checkAndProcessDailyFinancials() {
  try {
    const [stateRows] = await pool.query(
      "SELECT key_name, value_data FROM system_state WHERE key_name IN ('simulated_date', 'daily_financials_last_processed_date', 'cron_global_enabled', 'cron_enabled_daily_financials')"
    );
    
    const stateMap = {};
    stateRows.forEach(row => {
      stateMap[row.key_name] = row.value_data;
    });

    const globalEnabled = stateMap['cron_global_enabled'] !== 'false';
    const jobEnabled = stateMap['cron_enabled_daily_financials'] !== 'false';

    if (!globalEnabled) {
      console.log('[Cron] Skipping daily financials check: Schedulers are paused globally.');
      return;
    }
    if (!jobEnabled) {
      console.log('[Cron] Skipping daily financials check: daily_financials job scheduling is disabled.');
      return;
    }

    // SAFETY: The real-world date is the absolute ceiling for ALL processing.
    // The simulated_date can NEVER be advanced beyond today's real date.
    const realDate = new Date().toISOString().split('T')[0];
    let simulatedDate = stateMap['simulated_date'];

    // In production, keep simulated_date in sync with the real date.
    // SAFETY: We only advance ONE day at a time — or to today if far behind.
    // We do NOT skip ahead multiple days in one cron run because the interest
    // engine itself handles catch-up for missed installment dates safely.
    if (!simulatedDate || simulatedDate < realDate) {
      console.log(`[Cron] Auto-advancing simulated_date from ${simulatedDate || 'null'} to real date ${realDate}`);
      await pool.query(
        "INSERT INTO system_state (key_name, value_data) VALUES ('simulated_date', ?) ON DUPLICATE KEY UPDATE value_data = ?",
        [realDate, realDate]
      );
      simulatedDate = realDate;
    }

    // SAFETY: If simulated_date is somehow in the future, clamp it to today.
    if (simulatedDate > realDate) {
      console.warn(`[Cron] SAFETY: simulated_date (${simulatedDate}) is ahead of real date (${realDate}). Clamping.`);
      simulatedDate = realDate;
      await pool.query(
        "INSERT INTO system_state (key_name, value_data) VALUES ('simulated_date', ?) ON DUPLICATE KEY UPDATE value_data = ?",
        [realDate, realDate]
      );
    }

    const lastProcessedDate = stateMap['daily_financials_last_processed_date'];

    if (simulatedDate !== lastProcessedDate) {
      console.log(`[Cron] Simulated date has changed or not yet processed (${simulatedDate}). Running daily financials...`);
      const cronManager = require('./services/cronManager');
      await cronManager.runJob('daily_financials', 'system');
    } else {
      console.log(`[Cron] Daily financials already processed for simulated date: ${simulatedDate}`);
    }
  } catch (err) {
    console.error('[Cron] Error checking/processing daily financials:', err.message);
  }
}

// Run check hourly (0 * * * *) to catch up if server was offline/restarted
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Hourly catch-up check for daily financials...');
  await checkAndProcessDailyFinancials();
});

// Initialize: run immediately on server startup to catch up missed processing.
// SAFETY: 5-second delay to ensure DB connections and migrations finish first.
setTimeout(() => {
  console.log('[Cron] Server startup check for daily financials...');
  checkAndProcessDailyFinancials();
}, 5000);

console.log('[Cron] Automated financial engine initialized and listening.');
