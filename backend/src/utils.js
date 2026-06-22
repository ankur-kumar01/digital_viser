const crypto = require('crypto');

const ALLOWED_WALLET_COLUMNS = ['balance', 'bonus_balance', 'referral_balance', 'gaming_bonus_balance'];

function resolveWalletColumn(sourceWallet) {
  const map = {
    bonus: 'bonus_balance',
    referral: 'referral_balance',
    gaming_bonus: 'gaming_bonus_balance'
  };
  const column = map[sourceWallet] || 'balance';
  if (!ALLOWED_WALLET_COLUMNS.includes(column)) {
    throw new Error(`Invalid wallet type: ${sourceWallet}`);
  }
  return column;
}

// Structured logger
const logger = {
  info(msg, meta = {}) {
    const entry = { level: 'info', timestamp: new Date().toISOString(), message: msg, ...meta };
    console.log(JSON.stringify(entry));
  },
  warn(msg, meta = {}) {
    const entry = { level: 'warn', timestamp: new Date().toISOString(), message: msg, ...meta };
    console.warn(JSON.stringify(entry));
  },
  error(msg, meta = {}) {
    const entry = { level: 'error', timestamp: new Date().toISOString(), message: msg, ...meta };
    console.error(JSON.stringify(entry));
  }
};

// Express async error wrapper (Express 4.x doesn't catch rejected promises)
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Add days to a date string (YYYY-MM-DD) and return YYYY-MM-DD
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Request ID middleware
function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}

module.exports = { resolveWalletColumn, ALLOWED_WALLET_COLUMNS, logger, asyncHandler, addDays, requestIdMiddleware };
