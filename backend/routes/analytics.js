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
    const [allGames, allOutfits] = await Promise.all([
      db.scanAllGames(),
      db.scanAllOutfits(),
    ]);

    const gameStats = computeGameStats(allGames);
    const productPopularity = computeProductPopularity(allOutfits);

    res.json({ gameStats, productPopularity });
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

// ------------------------------------------------------------
// PRODUCT POPULARITY
// ------------------------------------------------------------

function computeProductPopularity(outfits, topN = 20) {
  // productId → { id, name, brand, category, price, imageUrl, pickCount }
  const productMap = new Map();
  // category → total picks
  const categoryPickCount = {};

  for (const outfit of outfits) {
    if (!Array.isArray(outfit.products)) continue;
    for (const p of outfit.products) {
      const id = p.id || p.productSin || p.asin;
      if (!id) continue;

      if (!productMap.has(id)) {
        productMap.set(id, {
          id,
          name: p.name || p.productName || '',
          brand: p.brand || p.designerName || '',
          category: p.category || 'unknown',
          price: p.price ?? p.retailPrice ?? null,
          imageUrl: p.imageUrl || p.image || null,
          pickCount: 0,
        });
      }
      productMap.get(id).pickCount += 1;

      const cat = p.category || 'unknown';
      categoryPickCount[cat] = (categoryPickCount[cat] || 0) + 1;
    }
  }

  // Sort all products by pickCount descending, return top N
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.pickCount - a.pickCount)
    .slice(0, topN);

  // Top products per category (top 5 each)
  const byCategory = {};
  for (const product of productMap.values()) {
    const cat = product.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(product);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat] = byCategory[cat]
      .sort((a, b) => b.pickCount - a.pickCount)
      .slice(0, 5);
  }

  return {
    totalProductsPicked: Array.from(productMap.values()).reduce((s, p) => s + p.pickCount, 0),
    uniqueProductsUsed: productMap.size,
    topProducts,
    categoryPickCount,
    topProductsByCategory: byCategory,
  };
}

module.exports = router;
