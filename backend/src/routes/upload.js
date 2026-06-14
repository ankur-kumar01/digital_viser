const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Base upload directory
const baseUploadDir = path.join(__dirname, '..', 'public', 'uploads');

// Ensure directories exist
['admin', 'deposits', 'withdrawals', 'profiles'].forEach(folder => {
  const dirPath = path.join(baseUploadDir, folder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Expected to pass folder as a query param or body
    const folder = req.query.folder || 'admin'; 
    if (!['admin', 'deposits', 'withdrawals', 'profiles'].includes(folder)) {
      return cb(new Error('Invalid folder specified'), '');
    }
    cb(null, path.join(baseUploadDir, folder));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const folder = req.query.folder || 'admin';
  const fileUrl = `/uploads/${folder}/${req.file.filename}`;

  res.json({
    success: true,
    url: fileUrl,
    filename: req.file.originalname
  });
});

module.exports = router;
