const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, game: 'fruit-slasher', type: 'free' });
});

module.exports = router;
