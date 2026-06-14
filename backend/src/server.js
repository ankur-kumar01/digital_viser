const path = require('path');
// Fix for Hostinger: Ensure dotenv always looks in the backend folder, regardless of CWD
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

// Import route files
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const fdrRoutes = require('./routes/fdr');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

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

// Initialize Cron Jobs
require('./cron');

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

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
app.listen(PORT, () => {
  console.log(`🚀 Digital_Viser API Server running on port ${PORT}`);
  
  // Verify database connection after server is running
  pool.query('SELECT 1')
    .then(() => {
      console.log('✅ Database connection successful');
    })
    .catch((err) => {
      console.error('❌ Failed to connect to database at startup:', err.message);
      console.error('💡 TIP: Check your .env credentials. Visit /api/health to see live database status.');
      // We explicitly DO NOT process.exit(1) so the server stays alive to report errors via /api/health instead of crashing
    });
});
