require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

// Import route files
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const fdrRoutes = require('./routes/fdr');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const path = require('path');

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

// Health check for API
app.get('/api', (req, res) => {
  res.json({ message: 'Digital_Viser API Server is running.' });
});

// Serve frontend static files if they exist (for production deployment on same domain/subdomain)
const fs = require('fs');
const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');

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
    res.json({ message: 'Digital_Viser API Server is running. (Frontend build not found)' });
  });
}

// Verify database connection and start server
pool.query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Digital_Viser API Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to database:', err);
    process.exit(1);
  });
