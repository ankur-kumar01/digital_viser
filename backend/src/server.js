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
app.use(cors());
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

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Digital_Viser API Server is running.' });
});

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
