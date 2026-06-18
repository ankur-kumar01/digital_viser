const path = require('path');
// Fix for Hostinger: Ensure dotenv always looks in the backend folder, regardless of CWD
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { runMigrations } = require('./migrate');
const AviatorGameLogic = require('./services/aviatorLogic');
const ColourTradingLogic = require('./services/colourTradingLogic');

// Import route files
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const fdrRoutes = require('./routes/fdr');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const gamesRoutes = require('./routes/games');
const spinRoutes = require('./routes/spin');
const activityRoutes = require('./routes/activity');

const app = express();
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

// Socket.io Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, decoded) => {
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
});

// Middleware
// Dynamic CORS to allow any subdomain or specified origins, supporting credentials
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser requests
    
    if (process.env.ALLOWED_ORIGINS) {
      const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // If no ALLOWED_ORIGINS is set, allow all dynamically (perfect for dynamic subdomains)
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/fdr', fdrRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/spin', spinRoutes);
app.use('/api/activity', activityRoutes);

// Public Config Endpoint
app.get('/api/config', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings');
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
    
    const [schemeRows] = await pool.query("SELECT type, reward_amount FROM reward_schemes WHERE is_active = true");
    const referralPercent = schemeRows.find((s) => s.type === 'referral_percent');
    const fdrReferralPercent = schemeRows.find((s) => s.type === 'fdr_referral_percent');
    
    res.json({
      global_timezone: settings.global_timezone || 'UTC',
      enable_aviator_chat_simulation: settings.enable_aviator_chat_simulation !== 'false',
      enable_aviator_bet_simulation: settings.enable_aviator_bet_simulation !== 'false',
      enable_colour_trading_bet_simulation: settings.enable_colour_trading_bet_simulation !== 'false',
      referral_percent: referralPercent ? parseFloat(referralPercent.reward_amount) : 10,
      fdr_referral_percent: fdrReferralPercent ? parseFloat(fdrReferralPercent.reward_amount) : 5
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// Initialize Cron Jobs
require('./cron');

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
  } catch (err) {
    console.error('❌ Failed to run startup tasks (DB/Migrations):', err.message);
    console.error('💡 TIP: Check your .env credentials. Visit /api/health to see live database status.');
    // We explicitly DO NOT process.exit(1) so the server stays alive to report errors via /api/health instead of crashing
  }
});
