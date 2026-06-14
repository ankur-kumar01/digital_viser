const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('--- DIGITAL VISER PREFLIGHT CHECK ---');

const requiredEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'JWT_SECRET',
  'PORT'
];

let hasErrors = false;

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ CRITICAL ERROR: Missing environment variable -> ${envVar}`);
    hasErrors = true;
  } else {
    console.log(`✅ Found: ${envVar}`);
  }
});

if (!process.env.DB_PASSWORD) {
  console.warn(`⚠️ WARNING: DB_PASSWORD is empty. This might be fine for local testing, but it will fail in production.`);
} else {
  console.log(`✅ Found: DB_PASSWORD`);
}

if (hasErrors) {
  console.error('\n❌ PREFLIGHT FAILED: One or more critical environment variables are missing!');
  console.error('If you are on Hostinger, you MUST create a .env file in the backend folder and fill it with your Hostinger database credentials.');
  process.exit(1);
} else {
  console.log('✅ PREFLIGHT PASSED. Starting server...\n');
}
