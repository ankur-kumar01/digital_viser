require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const cron = require('./cron/fantasyCricketCron');

async function run() {
  console.log('Triggering syncSquads manually...');
  await cron.syncSquads();
  console.log('SyncSquads complete.');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
