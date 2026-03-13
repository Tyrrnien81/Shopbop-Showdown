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
    const [allGames, allOutfits, allVotes] = await Promise.all([
      db.scanAllGames(),
      db.scanAllOutfits(),
      db.scanAllVotes(),
    ]);

    const gameStats = computeGameStats(allGames);
    const productPopularity = computeProductPopularity(allOutfits);
    const productPerformance = computeProductPerformance(allOutfits, allVotes);

    res.json({ gameStats, productPopularity, productPerformance });
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

// ------------------------------------------------------------
// PRODUCT PERFORMANCE (score-correlated)
// ------------------------------------------------------------

function computeProductPerformance(outfits, votes, topN = 20) {
  // Build outfitId → { total, count } from votes
  const voteAccum = new Map();
  for (const v of votes) {
    const entry = voteAccum.get(v.outfitId) || { total: 0, count: 0 };
    entry.total += v.rating;
    entry.count += 1;
    voteAccum.set(v.outfitId, entry);
  }

  // Only use outfits that received at least one vote
  const scoredOutfits = outfits.filter(o => voteAccum.has(o.outfitId));

  // Budget vs score: one data point per scored outfit
  const budgetVsScore = scoredOutfits.map(o => {
    const { total, count } = voteAccum.get(o.outfitId);
    return {
      outfitId: o.outfitId,
      totalPrice: o.totalPrice || 0,
      avgScore: parseFloat((total / count).toFixed(2)),
      productCount: o.products?.length || 0,
    };
  });

  // productId → accumulated score across all outfits it appeared in
  const productScoreMap = new Map();
  for (const outfit of scoredOutfits) {
    if (!Array.isArray(outfit.products)) continue;
    const { total, count } = voteAccum.get(outfit.outfitId);
    const outfitAvgScore = total / count;
    for (const p of outfit.products) {
      const id = p.id || p.productSin || p.asin;
      if (!id) continue;
      if (!productScoreMap.has(id)) {
        productScoreMap.set(id, {
          id,
          name: p.name || p.productName || '',
          brand: p.brand || p.designerName || '',
          category: p.category || 'unknown',
          price: p.price ?? p.retailPrice ?? null,
          imageUrl: p.imageUrl || p.image || null,
          totalScore: 0,
          outfitCount: 0,
        });
      }
      const entry = productScoreMap.get(id);
      entry.totalScore += outfitAvgScore;
      entry.outfitCount += 1;
    }
  }

  // Compute avgScoreWhenPicked; require at least 2 outfit appearances to reduce noise
  const topProductsByScore = Array.from(productScoreMap.values())
    .map(p => ({ ...p, avgScoreWhenPicked: parseFloat((p.totalScore / p.outfitCount).toFixed(2)) }))
    .filter(p => p.outfitCount >= 2)
    .sort((a, b) => b.avgScoreWhenPicked - a.avgScoreWhenPicked)
    .slice(0, topN);

  // Overall avg rating across all votes
  const overallAvgRating = votes.length > 0
    ? parseFloat((votes.reduce((s, v) => s + v.rating, 0) / votes.length).toFixed(2))
    : null;

  // Rating distribution histogram (1–5)
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of votes) {
    const r = Math.round(v.rating);
    if (r >= 1 && r <= 5) ratingDistribution[r] += 1;
  }

  return {
    overallAvgRating,
    ratingDistribution,
    budgetVsScore,
    topProductsByScore,
  };
}

module.exports = router;
