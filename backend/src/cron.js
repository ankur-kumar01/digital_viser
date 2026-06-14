const cron = require('node-cron');
const { processDailyFinancials } = require('./services/interestEngine');

// Schedule job to run at Midnight every day (00:00)
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Starting daily financial processing at Midnight...');
  await processDailyFinancials();
  console.log('[Cron] Daily financial processing completed.');
});

console.log('[Cron] Automated financial engine initialized and listening.');
