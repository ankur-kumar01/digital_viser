const path = require('path');
// Fix for Hostinger: Ensure dotenv always looks in the backend folder, regardless of CWD
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('express-async-errors'); // Catch async errors globally (BUG-004)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { runMigrations } = require('./migrate');
const { requestIdMiddleware } = require('./utils');
const cache = require('./cache');
const AviatorGameLogic = require('./services/aviatorLogic');
const ColourTradingLogic = require('./services/colourTradingLogic');
const LudoLogic = require('./services/ludoLogic');
const LudoCleanup = require('./cron/ludoCleanup');

// Import route files
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const adminFantasyRoutes = require('./routes/adminFantasy');
const fdrRoutes = require('./routes/fdr');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const gamesRoutes = require('./routes/games');
const spinRoutes = require('./routes/spin');
const activityRoutes = require('./routes/activity');
const fantasyRoutes = require('./routes/fantasy');
const supportRoutes = require('./routes/support');
const adminSupportRoutes = require('./routes/adminSupport');
const adminAnalyticsRoutes = require('./routes/adminAnalytics');

// ISSUE-014 FIX: Hard fail if JWT_SECRET is missing — don't allow server to start broken
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. All JWT operations will fail.');
  console.error('Set a strong random secret in your .env file: JWT_SECRET=<your-secret>');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // Trust first proxy (needed for accurate IP rate limiting behind Hostinger/Passenger/Cloudflare)
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (process.env.ALLOWED_ORIGINS) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        callback(null, true);
      }
    },
    credentials: true
  }
});

// Initialize Game Engines
const aviatorEngine = new AviatorGameLogic(io);
const ctEngine = new ColourTradingLogic(io);
const ludoEngine = new LudoLogic(io);
const ludoCleanupCron = new LudoCleanup();

// Socket.io Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = decoded;
    next();
  });
});

io.on('connection', (socket) => {
  console.log('User connected to socket:', socket.user.userId);
  
  // Send current state immediately on connect
  socket.emit('aviator_state', {
    state: aviatorEngine.state,
    roundId: aviatorEngine.roundId,
    startTime: aviatorEngine.startTime,
    serverTime: Date.now(),
    hash: aviatorEngine.hash
  });

  socket.emit('aviator_bets_update', Array.from(aviatorEngine.activeBets.values()).map(b => ({
    id: b.id,
    userId: b.userId,
    name: b.name,
    phone_number: b.phone_number,
    bet: b.betAmount,
    cashedOut: b.cashedOut,
    targetMult: b.multiplier,
    winAmount: b.winAmount
  })));

  socket.on('aviator_bet', async (data, callback) => {
    try {
      const res = await aviatorEngine.handleBet(socket.user.userId, data.amount);
      if (typeof callback === 'function') callback({ success: true, newBalance: res.newBalance });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('aviator_cashout', async (data, callback) => {
    try {
      const res = await aviatorEngine.handleCashout(socket.user.userId);
      if (typeof callback === 'function') callback({ 
        success: true, 
        newBalance: res.newBalance,
        multiplier: res.multiplier,
        winAmount: res.winAmount
      });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // --- Colour Trading Sockets ---
  socket.emit('ct_state', {
    state: ctEngine.state,
    timeLeft: ctEngine.timeLeft,
    periodNumber: ctEngine.periodNumber,
    history: ctEngine.history
  });

  socket.on('ct_bet', async (data, callback) => {
    try {
      const res = await ctEngine.handleBet(socket.user.userId, data.amount, data.color);
      if (typeof callback === 'function') callback({ success: true, newBalance: res.newBalance });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  // --- Ludo Multiplayer Sockets ---
  ludoEngine.handleSocketConnection(socket);
});

// Middleware
// Dynamic CORS to allow any subdomain or specified origins, supporting credentials
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser requests (server-to-server)
    
    if (process.env.ALLOWED_ORIGINS) {
      const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        // Log a warning instead of throwing a hard error that causes 500 responses
        console.warn('[CORS] WARNING: ALLOWED_ORIGINS not set in production. Defaulting to allow. Please configure ALLOWED_ORIGINS in your .env for strict security.');
      }
      callback(null, true);
    }
  },
  credentials: true
}));
// HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && req.headers['x-forwarded-proto'] !== 'https, http/1.1') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(requestIdMiddleware);
app.use(express.json());

// Redis store for rate limiters (SEC-005)
let rateLimitStore;
if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    const RedisStore = require('rate-limit-redis').default;
    const redisClient = new Redis(process.env.REDIS_URL);
    rateLimitStore = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    });
    console.log('📶 Redis rate-limiting store initialized.');
  } catch (redisErr) {
    console.error('⚠️ Failed to initialize Redis rate-limiting store, falling back to memory:', redisErr.message);
  }
}

// Rate limiters
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, store: rateLimitStore, message: { error: 'Too many login attempts. Try again in 15 minutes.' } });
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, store: rateLimitStore, message: { error: 'Too many registration attempts. Try again in 15 minutes.' } });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, store: rateLimitStore, message: { error: 'Too many OTP requests. Try again in 15 minutes.' } });
const spinLimiter = rateLimit({ windowMs: 60 * 1000, max: 1, standardHeaders: true, legacyHeaders: false, store: rateLimitStore, message: { error: 'Too many spin requests.' } });
const adminLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, store: rateLimitStore, message: { error: 'Too many admin login attempts. Try again in 15 minutes.' } });

// Maintenance Mode Intercept Middleware
app.use(async (req, res, next) => {
  const path = req.path;
  
  // Allow admin endpoints, public config check, and local file serving uploads
  const isAdminPath = path.startsWith('/api/admin');
  const isPublicPath = path === '/api/config' || path.startsWith('/uploads') || path.startsWith('/api/uploads');
  
  if (isAdminPath || isPublicPath) {
    return next();
  }

  try {
    const cacheKey = 'config:public';
    let configData = cache.get(cacheKey);
    
    let isMaintenanceActive = false;
    let endTime = null;
    
    if (configData) {
      isMaintenanceActive = configData.maintenance_mode === true;
      endTime = configData.maintenance_end_time;
    } else {
      const [rows] = await pool.query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('maintenance_mode', 'maintenance_end_time')"
      );
      const settings = {};
      rows.forEach(r => {
        settings[r.setting_key] = r.setting_value;
      });
      isMaintenanceActive = settings.maintenance_mode === 'true';
      endTime = settings.maintenance_end_time || null;
    }

    if (isMaintenanceActive) {
      return res.status(503).json({
        error: 'Scheduled System Maintenance',
        maintenance: true,
        end_time: endTime
      });
    }
  } catch (err) {
    console.error('[MaintenanceMiddleware] Error checking status:', err);
  }

  next();
});

// Mount routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot-password', otpLimiter);
app.use('/api/auth/verify-otp', otpLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/fdr', fdrRoutes);
app.use('/api/admin/auth/login', adminLoginLimiter);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/admin/fantasy', adminFantasyRoutes);
app.use('/api/spin/claim', spinLimiter);
app.use('/api/spin', spinRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/fantasy', require('./middleware/auth'), fantasyRoutes);
app.use('/api/admin/ludo', require('./routes/adminLudo'));
app.use('/api/admin/bots', require('./routes/adminBots'));
app.use('/api/ludo/tournaments', require('./routes/ludoTournaments'));
app.use('/api/support', supportRoutes);
app.use('/api/admin/support', adminSupportRoutes);
app.use('/api/yield-boosters', require('./routes/yieldBoosters'));
app.use('/api/admin/yield-boosters', require('./routes/adminYieldBoosters'));
app.use('/api/daily-tasks', require('./routes/dailyTasks'));
app.use('/api/admin/daily-tasks', require('./routes/adminDailyTasks'));
app.use('/api/admin/cron', require('./routes/adminCron'));
app.use('/api/admin/analytics', adminAnalyticsRoutes);

// Public Config Endpoint
app.get('/api/config', async (req, res) => {
  try {
    const cacheKey = 'config:public';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings');
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
    
    const [schemeRows] = await pool.query("SELECT type, reward_amount FROM reward_schemes WHERE is_active = true");
    const referralPercent = schemeRows.find((s) => s.type === 'referral_percent');
    const fdrReferralPercent = schemeRows.find((s) => s.type === 'fdr_referral_percent');
    
    const configData = {
      global_timezone: settings.global_timezone || 'UTC',
      enable_aviator_chat_simulation: settings.enable_aviator_chat_simulation !== 'false',
      enable_aviator_bet_simulation: settings.enable_aviator_bet_simulation !== 'false',
      enable_colour_trading_bet_simulation: settings.enable_colour_trading_bet_simulation !== 'false',
      enable_spin_wheel: settings.enable_spin_wheel !== 'false',
      referral_percent: referralPercent ? parseFloat(referralPercent.reward_amount) : 10,
      fdr_referral_percent: fdrReferralPercent ? parseFloat(fdrReferralPercent.reward_amount) : 5,
      maintenance_mode: settings.maintenance_mode === 'true',
      maintenance_end_time: settings.maintenance_end_time || null
    };
    cache.set(cacheKey, configData, 30000);
    res.json(configData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// Initialize Cron Jobs
require('./cron');
const fantasyCricketCron = require('./cron/fantasyCricketCron');
fantasyCricketCron.start();

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Health check for API (Deep diagnostic)
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'success', 
      server: 'running', 
      database: 'connected', 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    // We return 503 so monitoring tools know it's unhealthy, but we include the exact error in the JSON
    res.status(503).json({ 
      status: 'error', 
      server: 'running', 
      database: 'disconnected', 
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// Basic API Root
app.get('/api', (req, res) => {
  res.json({ message: 'Digital_Viser API Server is running. Visit /api/health for diagnostic status.' });
});

// Serve frontend static files if they exist (for production deployment on same domain/subdomain)
const fs = require('fs');
const frontendDistPath = path.join(__dirname, '..', 'public', 'dist');

if (fs.existsSync(frontendDistPath)) {
  console.log(`Serving frontend static files from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  
  // Catch-all route to serve the React index.html for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // Fallback health check if frontend is not built/available
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Digital_Viser API Server is running. (Frontend build not found)',
      diagnostic: {
        searchedPath: frontendDistPath,
        currentDirname: __dirname,
        currentWorkingDirectory: process.cwd()
      }
    });
  });
}

// Global error handler registered at the end of the routing stack (ISSUE-032)
app.use((err, req, res, next) => {
  console.error(JSON.stringify({ level: 'error', requestId: req.requestId, message: err.message, stack: err.stack }));
  res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
});

// Graceful error handling to prevent silent 503 crashes on Hostinger
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Start server regardless of initial DB connection so Hostinger doesn't throw 503
server.listen(PORT, async () => {
  console.log(`🚀 Digital_Viser API & Socket Server running on port ${PORT}`);
  
  try {
    // Automatically run migrations on server startup (crucial for Hostinger/Passenger deployments)
    await runMigrations();
    
    // Verify database connection after server is running
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    // Start Ludo cleanup cron
    ludoCleanupCron.start();
  } catch (err) {
    console.error('❌ Failed to run startup tasks (DB/Migrations):', err.message);
    console.error('💡 TIP: Check your .env credentials. Visit /api/health to see live database status.');
    // We explicitly DO NOT process.exit(1) so the server stays alive to report errors via /api/health instead of crashing
  }
});
