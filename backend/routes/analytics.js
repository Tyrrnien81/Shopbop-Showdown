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
    const allGames = await db.scanAllGames();
    const gameStats = computeGameStats(allGames);

    res.json({ gameStats });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ------------------------------------------------------------
// GAME STATS
// ------------------------------------------------------------

function computeGameStats(games) {
  const total = games.length;
  if (total === 0) {
    return {
      totalGames: 0,
      completionRate: 0,
      byTheme: {},
      byStatus: {},
      soloVsMultiplayer: { solo: 0, multiplayer: 0 },
      avgPlayersPerGame: 0,
      avgDurationSeconds: null,
      gamesOverTime: {},
    };
  }

  // Status breakdown + completion rate
  const byStatus = {};
  for (const g of games) {
    byStatus[g.status] = (byStatus[g.status] || 0) + 1;
  }
  const completionRate = parseFloat(((byStatus['COMPLETED'] || 0) / total * 100).toFixed(1));

  // Theme breakdown
  const byTheme = {};
  for (const g of games) {
    const label = g.themeName || g.theme || 'unknown';
    byTheme[label] = (byTheme[label] || 0) + 1;
  }

  // Solo vs multiplayer
  const soloVsMultiplayer = { solo: 0, multiplayer: 0 };
  for (const g of games) {
    if (g.singlePlayer) soloVsMultiplayer.solo += 1;
    else soloVsMultiplayer.multiplayer += 1;
  }

  // Average players per game
  const totalPlayers = games.reduce((sum, g) => sum + (g.playerIds?.length || 0), 0);
  const avgPlayersPerGame = parseFloat((totalPlayers / total).toFixed(1));

  // Average duration for completed games (startedAt → endedAt)
  const completedWithTimes = games.filter(g => g.status === 'COMPLETED' && g.startedAt && g.endedAt);
  let avgDurationSeconds = null;
  if (completedWithTimes.length > 0) {
    const totalSecs = completedWithTimes.reduce((sum, g) => {
      return sum + (new Date(g.endedAt) - new Date(g.startedAt)) / 1000;
    }, 0);
    avgDurationSeconds = Math.round(totalSecs / completedWithTimes.length);
  }

  // Games created per day (YYYY-MM-DD)
  const gamesOverTime = {};
  for (const g of games) {
    if (!g.createdAt) continue;
    const day = g.createdAt.slice(0, 10);
    gamesOverTime[day] = (gamesOverTime[day] || 0) + 1;
  }

  return {
    totalGames: total,
    completionRate,
    byTheme,
    byStatus,
    soloVsMultiplayer,
    avgPlayersPerGame,
    avgDurationSeconds,
    gamesOverTime,
  };
}

module.exports = router;
