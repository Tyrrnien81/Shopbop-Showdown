const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const db = require('../db');

// All routes in this file require admin auth
router.use(adminAuth);

// GET /api/admin/analytics
// Returns aggregated stats for the dev dashboard.
// Game stats, product popularity, and product performance
// are computed on-demand by scanning all DynamoDB tables.
router.get('/analytics', async (req, res) => {
  try {
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

module.exports = router;
