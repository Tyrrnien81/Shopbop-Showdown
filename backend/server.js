require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const crypto = require('crypto');
const { Server } = require('socket.io');
const db = require('./db');
const analyticsRouter = require('./routes/analytics');

// Lambda SDK — loaded only when Lambda mode is active
const TRYON_LAMBDA_NAME = process.env.TRYON_LAMBDA_NAME;
let LambdaClient, InvokeCommand, lambdaClient;
if (TRYON_LAMBDA_NAME) {
  ({ LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda'));
  lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Admin routes (auth-gated, outside game state machine)
app.use('/api/admin', analyticsRouter);

// ============================================================
// CONFIGURATION
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

const SHOPBOP_API_BASE = 'https://api.shopbop.com';
// Client-ID provided by Shopbop for UW Capstone - can be overridden via env
const SHOPBOP_CLIENT_ID = process.env.SHOPBOP_CLIENT_ID || 'Shopbop-UW-Team1-2024';

let io;

// In-memory cache for tryOnImages (too large for DynamoDB's 400KB item limit)
const tryOnImageCache = new Map();

// In-memory cache for theme voting (ephemeral, no need for DB)
const themeVoteCache = new Map(); // gameId -> { options: [...], votes: { playerId: themeId }, timer }

const ALL_THEMES = [
  { id: 'runway', name: 'Runway Ready', description: 'High-fashion editorial looks.', icon: '✨' },
  { id: 'trend', name: '2026 Trend Watch', description: 'The latest silhouettes and textures.', icon: '⚡' },
  { id: 'ski', name: 'Apres Ski Chic', description: 'Luxury winter style for the lodge.', icon: '❄️' },
  { id: 'street', name: 'Streetwear Icon', description: 'Urban staples and bold statements.', icon: '🏙️' },
  { id: 'gala', name: 'Met Gala: Camp', description: 'Everything is extra. No limits.', icon: '💎' },
  { id: 'beach', name: 'Beach Vacation', description: 'Resort wear and summer essentials.', icon: '🏖️' },
];

function pickRandomThemes(count = 3) {
  const shuffled = [...ALL_THEMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function tallyThemeVotes(gameId) {
  const cache = themeVoteCache.get(gameId);
  if (!cache) return null;
  const counts = {};
  cache.options.forEach(t => { counts[t.id] = 0; });
  Object.values(cache.votes).forEach(themeId => {
    counts[themeId] = (counts[themeId] || 0) + 1;
  });
  // Find winner (most votes, tie-break random)
  let maxVotes = -1;
  let winners = [];
  for (const [themeId, count] of Object.entries(counts)) {
    if (count > maxVotes) { maxVotes = count; winners = [themeId]; }
    else if (count === maxVotes) { winners.push(themeId); }
  }
  return winners[Math.floor(Math.random() * winners.length)];
}

async function finalizeThemeVoting(gameId) {
  const cache = themeVoteCache.get(gameId);
  if (!cache || cache.finalized) return;
  cache.finalized = true;
  if (cache.timer) clearTimeout(cache.timer);

  const winningThemeId = tallyThemeVotes(gameId);
  const winningTheme = ALL_THEMES.find(t => t.id === winningThemeId);

  // Update game: set theme, transition to PLAYING
  const now = new Date();
  const game = await db.getGame(gameId);
  if (!game) return;

  const updatedGame = await db.updateGameStatus(gameId, 'PLAYING', {
    theme: winningThemeId,
    themeName: winningTheme?.name || winningThemeId,
    startedAt: now.toISOString(),
    endsAt: new Date(now.getTime() + game.timeLimit * 1000).toISOString(),
  });

  console.log(`Theme voting complete for ${gameId}: winner = ${winningThemeId}`);

  if (io) {
    io.to(gameId).emit('theme-vote-result', {
      winningTheme: winningThemeId,
      winningThemeName: winningTheme?.name,
      votes: cache.votes,
    });
    // After a short delay, emit game-started so clients navigate
    setTimeout(() => {
      io.to(gameId).emit('game-started', {
        gameId,
        startedAt: updatedGame.startedAt,
        endsAt: updatedGame.endsAt,
        timeLimit: game.timeLimit,
      });
    }, 3000); // 3s to show the winning theme
  }

  themeVoteCache.delete(gameId);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function generateGameId() {
  // 6-char alphanumeric code, avoiding confusing chars
  // Collision is extremely unlikely with 30^6 = 729M possibilities
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateId() {
  return crypto.randomUUID();
}

const THEME_NAMES = {
  runway: 'Runway Ready',
  trend: '2026 Trend Watch',
  ski: 'Apres Ski Chic',
  street: 'Streetwear Icon',
  gala: 'Met Gala: Camp',
  beach: 'Beach Vacation',
};

const THEME_QUERIES = {
  runway: 'evening gown dress formal',
  trend: 'trendy fashion new',
  ski: 'ski jacket winter',
  street: 'streetwear casual urban',
  gala: 'formal gown sequin glam',
  beach: 'swimwear resort beach dress',
};

// Category ID → display name mapping (per gender)
const CATEGORIES_WOMENS = [
  { id: 'dresses', name: 'Dresses', queries: ['dresses'] },
  { id: 'tops', name: 'Tops', queries: ['tops', 'blouses', 'shirts'] },
  { id: 'bottoms', name: 'Bottoms', queries: ['pants', 'jeans', 'skirts'] },
  { id: 'shoes', name: 'Shoes', queries: ['shoes', 'heels', 'boots'] },
  { id: 'jewelry', name: 'Jewelry', queries: ['jewelry', 'necklaces', 'earrings'] },
  { id: 'outerwear', name: 'Outerwear', queries: ['jackets', 'coats', 'blazers'] },
  { id: 'accessories', name: 'Accessories', queries: ['bags', 'scarves', 'hats'] },
];

const CATEGORIES_MENS = [
  { id: 'tops', name: 'Tops', queries: ['shirts', 'tees', 'polos'] },
  { id: 'bottoms', name: 'Bottoms', queries: ['pants', 'jeans', 'shorts', 'trousers'] },
  { id: 'shoes', name: 'Shoes', queries: ['sneakers', 'boots', 'loafers'] },
  { id: 'outerwear', name: 'Outerwear', queries: ['jackets', 'coats', 'blazers', 'hoodies'] },
  { id: 'suits', name: 'Suits', queries: ['suits', 'blazers', 'dress shirts'] },
  { id: 'accessories', name: 'Accessories', queries: ['watches', 'bags', 'belts', 'hats'] },
];

function getCategories(dept) {
  return dept === 'MENS' ? CATEGORIES_MENS : CATEGORIES_WOMENS;
}

// ============================================================
// SHOPBOP API PROXY HELPERS
// ============================================================

async function shopbopFetch(path, params = {}) {
  const url = new URL(`${SHOPBOP_API_BASE}${path}`);
  // Always include required params per Shopbop API docs
  const defaults = { lang: 'en-US', dept: 'WOMENS' };
  Object.entries({ ...defaults, ...params }).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  });
  console.log('Shopbop URL:', url.toString());

  const headers = {
    'accept': 'application/json',
    'Client-Id': SHOPBOP_CLIENT_ID,
    'Client-Version': '1.0.0',
  };
  if (process.env.SHOPBOP_API_KEY) {
    headers['x-api-key'] = process.env.SHOPBOP_API_KEY;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopbop API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Normalize image URL — Shopbop may return relative paths
function normalizeImageUrl(src) {
  if (!src || typeof src !== 'string') return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  // Relative path — prepend Shopbop CDN (base ends with /p/)
  return `https://m.media-amazon.com/images/G/01/Shopbop/p/${src.replace(/^\//, '')}`;
}

// Guess normalized category from raw strings
// Order matters: check more specific categories first to avoid misclassification
// (e.g. "Top Handle Bag" should be Accessories, not Tops)
function guessCategory(rawCategory = '', productName = '') {
  const text = `${rawCategory} ${productName}`.toLowerCase();
  // Check Accessories/Bags BEFORE Tops (to avoid "Top Handle Bag" -> Tops)
  if (text.includes('bag') || text.includes('tote') || text.includes('purse') ||
      text.includes('clutch') || text.includes('crossbody') || text.includes('wallet') ||
      text.includes('belt') || text.includes('scarf') || text.includes('hat') ||
      text.includes('sunglasses') || text.includes('accessory') || text.includes('accessories')) return 'Accessories';
  // Check Shoes before Tops (to avoid "Shoe Top" issues)
  if (text.includes('shoe') || text.includes('heel') || text.includes('boot') ||
      text.includes('sandal') || text.includes('sneaker') || text.includes('flat') ||
      text.includes('pump') || text.includes('loafer') || text.includes('mule') ||
      text.includes('wedge') || text.includes('oxford') || text.includes('slingback')) return 'Shoes';
  if (text.includes('jewel') || text.includes('necklace') || text.includes('earring') ||
      text.includes('ring') || text.includes('bracelet') || text.includes('pendant') ||
      text.includes('choker') || text.includes('cuff') || text.includes('stud')) return 'Jewelry';
  if (text.includes('dress') && !text.includes('underdress')) return 'Dresses';
  if (text.includes('coat') || text.includes('jacket') || text.includes('blazer') ||
      text.includes('parka') || text.includes('vest') || text.includes('outerwear') ||
      text.includes('trench') || text.includes('puffer') || text.includes('windbreaker')) return 'Outerwear';
  if (text.includes('pant') || text.includes('jean') || text.includes('skirt') ||
      text.includes('short') || text.includes('trouser') || text.includes('legging') ||
      text.includes('denim') || text.includes('culotte')) return 'Bottoms';
  if (text.includes('top') || text.includes('shirt') || text.includes('blouse') ||
      text.includes('sweater') || text.includes('tank') || text.includes('tee') ||
      text.includes('bodysuit') || text.includes('pullover') || text.includes('cardigan')) return 'Tops';
  return rawCategory || 'Other';
}

// Normalize a Shopbop product to our format
function normalizeProduct(item) {
  // Shopbop API returns different shapes — handle both nested and flat
  const p = item.product || item;
  const priceInfo = item.priceInfo || p.priceInfo || {};
  const colors = item.colors || p.colors || [];
  const imageInfo = item.imageInfo || p.imageInfo;

  // Price — Shopbop: product.retailPrice.usdPrice
  const rawPrice = p.retailPrice?.usdPrice ?? p.retailPrice?.price
    ?? priceInfo.retailPrice ?? priceInfo.salePrice ?? priceInfo.price ?? p.price ?? 0;
  const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) : (rawPrice || 0);

  // Images — Shopbop: colors[0].images[0].src is a relative path like /prod/products/...
  const firstColor = colors[0] || {};
  const images = firstColor.images || imageInfo?.images || p.images || [];
  const rawSrc = images[0]?.src || images[0]?.url || '';
  const imageUrl = normalizeImageUrl(rawSrc);

  // Identity
  const productSin = p.productSin || p.asin || p.sin || p.id || '';
  const name = p.shortDescription || p.productName || p.name || '';
  const brand = p.designerName || p.brandName || p.brand || '';
  const rawCategory = p.categoryName || p.category || p.department || p.productType || '';
  const category = guessCategory(rawCategory, name);

  return {
    productSin,
    name,
    brand,
    category,
    price,
    imageUrl,
    productUrl: p.productDetailUrl
      ? `https://www.shopbop.com${p.productDetailUrl}`
      : `https://www.shopbop.com/dp/${productSin}`,
  };
}

// Search Shopbop and return normalized products
async function searchShopbop(query, limit = 20, offset = 0, { sort, minPrice, maxPrice, dept } = {}) {
  const params = { q: query, limit, offset };
  if (sort) params.sort = sort;
  if (minPrice) params.minPrice = minPrice;
  if (maxPrice) params.maxPrice = maxPrice;
  if (dept) params.dept = dept;
  const data = await shopbopFetch('/public/search', params);
  const rawProducts = data.products || data.results || data.items || [];
  if (rawProducts.length > 0) {
    const normalized = normalizeProduct(rawProducts[0]);
    console.log('Normalized imageUrl:', normalized.imageUrl);
    console.log('Normalized price:', normalized.price);
  }
  return {
    products: rawProducts.map(normalizeProduct).filter(p => p.productSin && p.name),
    total: data.metadata?.totalCount || data.total || rawProducts.length,
  };
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/', (req, res) => {
  res.json({ service: 'ShopBop Showdown API', status: 'running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// ============================================================
// SHOPBOP PRODUCT ENDPOINTS
// ============================================================

// GET /api/categories — static category list
app.get('/api/categories', (req, res) => {
  const dept = req.query.dept === 'MENS' ? 'MENS' : 'WOMENS';
  const cats = getCategories(dept);
  res.json({
    categories: cats.map(({ id, name }) => ({ id, name })),
  });
});

// GET /api/products/search
app.get('/api/products/search', async (req, res) => {
  try {
    const { query, category, minPrice, maxPrice, page = 1, limit = 20, theme, sort, color, dept } = req.query;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const offset = (pageNum - 1) * limitNum;
    const activeDept = dept === 'MENS' ? 'MENS' : 'WOMENS';
    const CATEGORIES = getCategories(activeDept);

    // Build options to forward to the Shopbop API
    const opts = { dept: activeDept };
    if (sort) opts.sort = sort;
    if (minPrice) opts.minPrice = minPrice;
    if (maxPrice) opts.maxPrice = maxPrice;

    // Color is prepended to the search query text (no native colors param)
    const colorPrefix = color && color !== 'All' ? `${color} ` : '';
    // Gender prefix to steer text search toward men's or women's products
    const genderPrefix = activeDept === 'MENS' ? 'mens ' : '';

    let products = [];
    let total = 0;

    if (query) {
      // Direct text search
      const result = await searchShopbop(`${genderPrefix}${colorPrefix}${query}`, limitNum, offset, opts);
      products = result.products;
      total = result.total;

    } else if (category) {
      // Category-specific search — fire one search per keyword for reliability
      const cat = CATEGORIES.find(c => c.id === category.toLowerCase() || c.name.toLowerCase() === category.toLowerCase());
      const categoryName = cat ? cat.name : category;
      const queries = cat ? cat.queries : [category];
      const perQueryLimit = Math.max(Math.ceil(limitNum / queries.length), 8);

      const fetches = queries.map(q =>
        searchShopbop(`${genderPrefix}${colorPrefix}${q}`, perQueryLimit, offset, opts)
          .then(r => r.products)
          .catch(() => [])
      );
      const results = await Promise.all(fetches);
      products = results.flat();
      // Override category to match what was requested (guessCategory can misclassify)
      products = products.map(p => ({ ...p, category: categoryName }));
      // Deduplicate by productSin
      const seen = new Set();
      products = products.filter(p => {
        if (seen.has(p.productSin)) return false;
        seen.add(p.productSin);
        return true;
      });
      total = products.length;

    } else if (theme) {
      // Theme-based search: fetch from a few categories in parallel for variety
      const themeQuery = THEME_QUERIES[theme] || 'fashion';
      const perCategoryLimit = Math.ceil(limitNum / CATEGORIES.length);

      const fetches = CATEGORIES.map(cat =>
        searchShopbop(`${genderPrefix}${colorPrefix}${themeQuery} ${cat.queries[0]}`, perCategoryLimit, 0, opts)
          .then(r => r.products)
          .catch(() => [])
      );
      const results = await Promise.all(fetches);
      products = results.flat();
      total = products.length;

    } else {
      // General fashion search fallback
      const result = await searchShopbop(`${genderPrefix}${colorPrefix}fashion`, limitNum, offset, opts);
      products = result.products;
      total = result.total;
    }

    res.json({
      products,
      total: total || products.length,
      page: pageNum,
      totalPages: Math.ceil((total || products.length) / limitNum),
    });

  } catch (err) {
    console.error('Product search error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to search products' });
  }
});

// GET /api/products/:productSin — product detail
app.get('/api/products/:productSin', async (req, res) => {
  try {
    const data = await shopbopFetch(`/public/products/${req.params.productSin}`);
    res.json(normalizeProduct(data));
  } catch (err) {
    console.error('Product detail error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to get product' });
  }
});

// ============================================================
// GAME MANAGEMENT ENDPOINTS
// ============================================================

// POST /api/games — create a new game
app.post('/api/games', async (req, res) => {
  try {
    const { hostUsername, theme, budget, maxPlayers, timeLimit, singlePlayer, themeMode, votingMode, roomName, isPublic } = req.body;

    if (!hostUsername) {
      return res.status(400).json({ error: 'hostUsername is required' });
    }

    const gameId = generateGameId();
    const playerId = generateId();
    const now = new Date().toISOString();

    const player = {
      playerId,
      username: hostUsername,
      isHost: true,
      isReady: true,
      hasSubmitted: false,
      hasVoted: false,
      gameId,
      outfitId: null,
    };

    const game = {
      gameId,
      theme,
      themeName: THEME_NAMES[theme] || theme,
      budget: budget || 5000,
      maxPlayers: maxPlayers || 4,
      timeLimit: timeLimit || 300,
      status: 'LOBBY',
      hostPlayerId: playerId,
      playerIds: [playerId],
      createdAt: now,
      startedAt: null,
      endsAt: null,
      endedAt: null,
      singlePlayer: Boolean(singlePlayer),
      themeMode: themeMode || 'vote', // 'vote' or 'pick'
      votingMode: votingMode || 'star', // 'star' or 'ranking'
      roomName: roomName || `${hostUsername}'s Room`,
      isPublic: Boolean(isPublic),
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 2, // 2 hours from now, Unix timestamp
    };

    await Promise.all([
      db.createGame(game),
      db.createPlayer(player),
    ]);

    console.log(`Game created: ${gameId} by ${hostUsername}`);
    res.status(201).json({ game, player });
  } catch (err) {
    console.error('Create game error:', err.message);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// GET /api/games/history — public, last 20 completed games with winner summary
app.get('/api/games/history', async (req, res) => {
  try {
    const [allGames, allOutfits, allVotes] = await Promise.all([
      db.scanAllGames(),
      db.scanAllOutfits(),
      db.scanAllVotes(),
    ]);

    const completedGames = allGames
      .filter(g => g.status === 'COMPLETED' && !g.singlePlayer && (g.playerIds?.length || 0) > 1)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 20);

    // Group outfits by gameId
    const outfitsByGame = {};
    for (const o of allOutfits) {
      if (!outfitsByGame[o.gameId]) outfitsByGame[o.gameId] = [];
      outfitsByGame[o.gameId].push(o);
    }

    // Accumulate votes per outfitId
    const voteAccum = {};
    for (const v of allVotes) {
      if (!voteAccum[v.outfitId]) voteAccum[v.outfitId] = { total: 0, count: 0 };
      voteAccum[v.outfitId].total += v.rating;
      voteAccum[v.outfitId].count += 1;
    }

    const history = completedGames.map(game => {
      const outfits = outfitsByGame[game.gameId] || [];
      const scored = outfits.map(o => {
        const { total = 0, count = 0 } = voteAccum[o.outfitId] || {};
        return {
          username: o.username || 'Unknown',
          score: count > 0 ? total / count : 0,
          totalVotes: count,
          products: o.products || [],
        };
      });
      scored.sort((a, b) => b.score - a.score);
      const winner = scored[0] || null;

      return {
        gameId: game.gameId,
        themeName: game.themeName || game.theme || 'Unknown Theme',
        createdAt: game.createdAt,
        playerCount: game.playerIds?.length || 0,
        winner: winner ? {
          username: winner.username,
          score: parseFloat(winner.score.toFixed(1)),
          totalVotes: winner.totalVotes,
          previewImage: winner.products[0]?.imageUrl || null,
        } : null,
      };
    });

    res.json({ history });
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// GET /api/games/public — list all public active games
app.get('/api/games/public', async (req, res) => {
  try {
    const games = await db.getPublicActiveGames();

    // Only return games in LOBBY status (joinable), sorted newest first
    const joinable = games
      .filter(g => g.status === 'LOBBY' && !g.singlePlayer)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Return only the fields the frontend needs — don't expose playerIds etc.
    const summary = joinable.map(g => ({
      gameId: g.gameId,
      roomName: g.roomName,
      hostPlayerId: g.hostPlayerId,
      budget: g.budget,
      timeLimit: g.timeLimit,
      maxPlayers: g.maxPlayers,
      playerCount: (g.playerIds || []).length,
      themeName: g.themeName || g.theme,
      themeMode: g.themeMode,
      votingMode: g.votingMode,
      createdAt: g.createdAt,
    }));

    res.json({ games: summary });
  } catch (err) {
    console.error('Public games error:', err.message);
    res.status(500).json({ error: 'Failed to fetch public games' });
  }
});

// GET /api/popular-products — public, most picked products across all completed games
app.get('/api/popular-products', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 30);
    const allOutfits = await db.scanAllOutfits();

    const productMap = new Map();
    for (const outfit of allOutfits) {
      if (!Array.isArray(outfit.products)) continue;
      for (const p of outfit.products) {
        const id = p.id || p.productSin || p.asin;
        if (!id || !p.imageUrl) continue;
        if (!productMap.has(id)) {
          productMap.set(id, {
            id,
            name: p.name || p.productName || '',
            brand: p.brand || p.designerName || '',
            category: p.category || 'unknown',
            price: p.price ?? p.retailPrice ?? null,
            imageUrl: p.imageUrl || p.image || null,
            productUrl: p.productUrl || null,
            pickCount: 0,
          });
        }
        productMap.get(id).pickCount += 1;
      }
    }

    const products = Array.from(productMap.values())
      .sort((a, b) => b.pickCount - a.pickCount)
      .slice(0, limit);

    res.json({ products });
  } catch (err) {
    console.error('Popular products error:', err.message);
    res.status(500).json({ error: 'Failed to load popular products' });
  }
});

// GET /api/games/:gameId — get game details
app.get('/api/games/:gameId', async (req, res) => {
  try {
    const game = await db.getGame(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const gamePlayers = await db.getPlayersByGameId(game.gameId);
    res.json({ ...game, players: gamePlayers });
  } catch (err) {
    console.error('Get game error:', err.message);
    res.status(500).json({ error: 'Failed to get game' });
  }
});

// POST /api/games/:gameId/join — join existing game
app.post('/api/games/:gameId/join', async (req, res) => {
  try {
    const game = await db.getGame(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'LOBBY') return res.status(400).json({ error: 'Game has already started' });

    const { username, isAudience } = req.body;

    // Audience doesn't count toward maxPlayers; contestants do
    if (!isAudience && game.playerIds.length >= game.maxPlayers) {
      return res.status(400).json({ error: 'Game is full' });
    }
    if (!username) return res.status(400).json({ error: 'username is required' });

    const playerId = generateId();
    const audience = Boolean(isAudience);
    const player = {
      playerId,
      username,
      isHost: false,
      isReady: audience, // audience auto-ready
      hasSubmitted: audience, // audience don't need to submit outfits
      hasVoted: false,
      isAudience: audience,
      gameId: game.gameId,
      outfitId: null,
    };

    await Promise.all([
      db.createPlayer(player),
      db.appendPlayerId(game.gameId, playerId),
    ]);

    const gamePlayers = await db.getPlayersByGameId(game.gameId);
    const updatedGame = await db.getGame(game.gameId);
    console.log(`${username} joined game ${game.gameId}`);

    // Notify all clients in the room
    if (io) io.to(game.gameId).emit('player-joined', { players: gamePlayers });

    res.json({ player, game: { ...updatedGame, players: gamePlayers } });
  } catch (err) {
    console.error('Join game error:', err.message);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// POST /api/games/:gameId/ready — toggle ready status
app.post('/api/games/:gameId/ready', async (req, res) => {
  try {
    const game = await db.getGame(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const { playerId, isReady } = req.body;
    const player = await db.getPlayer(playerId);
    if (!player || player.gameId !== game.gameId) return res.status(404).json({ error: 'Player not found in this game' });

    const updated = await db.updatePlayer(playerId, { isReady: Boolean(isReady) });

    // Notify all clients in the room
    const gamePlayers = await db.getPlayersByGameId(game.gameId);
    if (io) io.to(game.gameId).emit('player-ready-changed', { playerId, isReady: updated.isReady, players: gamePlayers });

    res.json({ success: true, player: updated });
  } catch (err) {
    console.error('Ready toggle error:', err.message);
    res.status(500).json({ error: 'Failed to update ready status' });
  }
});

// POST /api/games/:gameId/start — start the game (host only)
app.post('/api/games/:gameId/start', async (req, res) => {
  try {
    const game = await db.getGame(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'LOBBY') return res.status(400).json({ error: 'Game already started' });

    // Solo mode or host-pick mode: skip theme voting, go straight to PLAYING
    if (game.singlePlayer || game.themeMode === 'pick') {
      const now = new Date();
      const updatedGame = await db.updateGameStatus(game.gameId, 'PLAYING', {
        startedAt: now.toISOString(),
        endsAt: new Date(now.getTime() + game.timeLimit * 1000).toISOString(),
      });
      console.log(`Game ${game.gameId} started (${game.singlePlayer ? 'solo' : 'host-pick'} mode)`);
      if (io) io.to(game.gameId).emit('game-started', { gameId: game.gameId, startedAt: updatedGame.startedAt, endsAt: updatedGame.endsAt, timeLimit: game.timeLimit });
      return res.json({ success: true, game: updatedGame });
    }

    // Vote mode: enter THEME_VOTING phase
    const themeOptions = pickRandomThemes(3);
    const THEME_VOTE_DURATION = 15; // seconds

    const updatedGame = await db.updateGameStatus(game.gameId, 'THEME_VOTING', {
      themeVoteEndsAt: new Date(Date.now() + THEME_VOTE_DURATION * 1000).toISOString(),
    });

    // Set up in-memory vote tracking
    themeVoteCache.set(game.gameId, {
      options: themeOptions,
      votes: {},
      totalPlayers: game.playerIds.length,
      finalized: false,
      timer: setTimeout(() => finalizeThemeVoting(game.gameId), THEME_VOTE_DURATION * 1000),
    });

    console.log(`Game ${game.gameId} entered THEME_VOTING phase`);

    if (io) {
      io.to(game.gameId).emit('theme-vote-start', {
        options: themeOptions,
        endsAt: updatedGame.themeVoteEndsAt,
        duration: THEME_VOTE_DURATION,
      });
    }

    res.json({ success: true, game: updatedGame, themeOptions });
  } catch (err) {
    console.error('Start game error:', err.message);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// POST /api/games/:gameId/theme-vote — vote on a theme
app.post('/api/games/:gameId/theme-vote', async (req, res) => {
  try {
    const { playerId, themeId } = req.body;
    const gameId = req.params.gameId;

    if (!playerId || !themeId) return res.status(400).json({ error: 'playerId and themeId are required' });

    const cache = themeVoteCache.get(gameId);
    if (!cache) return res.status(400).json({ error: 'No active theme vote for this game' });
    if (cache.finalized) return res.status(400).json({ error: 'Theme voting has ended' });

    // Validate theme is one of the options
    if (!cache.options.find(t => t.id === themeId)) {
      return res.status(400).json({ error: 'Invalid theme option' });
    }

    cache.votes[playerId] = themeId;

    const voteCount = Object.keys(cache.votes).length;
    console.log(`Theme vote: ${playerId} voted for ${themeId} (${voteCount}/${cache.totalPlayers})`);

    // Broadcast vote update
    if (io) {
      io.to(gameId).emit('theme-vote-update', {
        voteCount,
        totalPlayers: cache.totalPlayers,
      });
    }

    // If all players voted, finalize early
    if (voteCount >= cache.totalPlayers) {
      await finalizeThemeVoting(gameId);
    }

    res.json({ success: true, voteCount, totalPlayers: cache.totalPlayers });
  } catch (err) {
    console.error('Theme vote error:', err.message);
    res.status(500).json({ error: 'Failed to submit theme vote' });
  }
});

// GET /api/games/:gameId/theme-vote — get current theme vote state
app.get('/api/games/:gameId/theme-vote', (req, res) => {
  const cache = themeVoteCache.get(req.params.gameId);
  if (!cache) return res.status(404).json({ error: 'No active theme vote' });
  res.json({
    options: cache.options,
    voteCount: Object.keys(cache.votes).length,
    totalPlayers: cache.totalPlayers,
  });
});

// GET /api/games/:gameId/players — list players
app.get('/api/games/:gameId/players', async (req, res) => {
  try {
    const game = await db.getGame(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const gamePlayers = await db.getPlayersByGameId(game.gameId);
    res.json({ players: gamePlayers });
  } catch (err) {
    console.error('Get players error:', err.message);
    res.status(500).json({ error: 'Failed to get players' });
  }
});

// ============================================================
// OUTFIT ENDPOINTS
// ============================================================

// POST /api/outfits — submit outfit
app.post('/api/outfits', async (req, res) => {
  try {
    const { gameId, playerId, products: outfitProducts, totalPrice, tryOnImage } = req.body;

    const game = await db.getGame(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const player = await db.getPlayer(playerId);
    if (!player || player.gameId !== gameId) return res.status(404).json({ error: 'Player not found in this game' });

    // Allow re-submission: update existing outfit if player already submitted
    if (player.hasSubmitted && player.outfitId) {
      const submittedAt = new Date().toISOString();
      await db.updateOutfit(player.outfitId, {
        products: outfitProducts || [],
        totalPrice: totalPrice || 0,
        submittedAt,
      });
      // Cache tryOnImage in memory (too large for DynamoDB)
      if (tryOnImage) tryOnImageCache.set(player.outfitId, tryOnImage);
      console.log(`Outfit ${player.outfitId} re-submitted by player ${playerId}`);
      return res.status(200).json({ outfitId: player.outfitId, submittedAt });
    }

    const outfitId = generateId();
    const outfit = {
      outfitId,
      gameId,
      playerId,
      products: outfitProducts || [],
      totalPrice: totalPrice || 0,
      submittedAt: new Date().toISOString(),
    };

    // Cache tryOnImage in memory (too large for DynamoDB)
    if (tryOnImage) tryOnImageCache.set(outfitId, tryOnImage);

    await Promise.all([
      db.createOutfit(outfit),
      db.updatePlayer(playerId, { hasSubmitted: true, outfitId }),
    ]);

    console.log(`Outfit ${outfitId} submitted by player ${playerId}`);

    // Count submissions reliably: re-fetch all players with a small delay
    // to handle DynamoDB GSI eventual consistency
    await new Promise(r => setTimeout(r, 500));
    const gamePlayers = await db.getPlayersByGameId(gameId);
    // Only count non-audience players for submission tracking
    const contestants = gamePlayers.filter(p => !p.isAudience);
    const submittedCount = contestants.filter(p => p.hasSubmitted).length;
    const totalPlayers = contestants.length;

    console.log(`Submissions: ${submittedCount}/${totalPlayers}`);

    // Auto-advance when all players have submitted
    let newStatus = game.status;
    if (submittedCount >= totalPlayers) {
      if (game.singlePlayer) {
        await db.updateGameStatus(gameId, 'COMPLETED', { endedAt: new Date().toISOString() });
        newStatus = 'COMPLETED';
        console.log(`Solo game ${gameId} completed (skipping voting)`);
      } else {
        await db.updateGameStatus(gameId, 'VOTING');
        newStatus = 'VOTING';
        console.log(`Game ${gameId} moved to VOTING phase`);
      }
    }

    // Notify all clients in the room
    if (io) io.to(gameId).emit('outfit-submitted', { submittedCount, totalPlayers, gameStatus: newStatus });

    res.status(201).json({ outfitId, submittedAt: outfit.submittedAt });
  } catch (err) {
    console.error('Submit outfit error:', err.message);
    res.status(500).json({ error: 'Failed to submit outfit' });
  }
});

// GET /api/games/:gameId/outfits — get outfits (anonymized during voting)
app.get('/api/games/:gameId/outfits', async (req, res) => {
  try {
    const game = await db.getGame(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const rawOutfits = await db.getOutfitsByGameId(req.params.gameId);

    const gameOutfits = [];
    for (const outfit of rawOutfits) {
      if (game.status === 'VOTING') {
        // Include playerId so frontend can filter own outfit, but no player name
        gameOutfits.push({
          outfitId: outfit.outfitId,
          playerId: outfit.playerId,
          products: outfit.products,
          totalPrice: outfit.totalPrice,
          tryOnImage: tryOnImageCache.get(outfit.outfitId) || outfit.tryOnImage || null,
        });
      } else {
        // Include player info for completed games
        const player = await db.getPlayer(outfit.playerId);
        gameOutfits.push({
          outfitId: outfit.outfitId,
          playerId: outfit.playerId,
          playerName: player?.username,
          products: outfit.products,
          totalPrice: outfit.totalPrice,
          tryOnImage: tryOnImageCache.get(outfit.outfitId) || outfit.tryOnImage || null,
        });
      }
    }

    res.json({ outfits: gameOutfits });
  } catch (err) {
    console.error('Get outfits error:', err.message);
    res.status(500).json({ error: 'Failed to get outfits' });
  }
});

// ============================================================
// VOTING ENDPOINTS
// ============================================================

// POST /api/votes — submit votes
app.post('/api/votes', async (req, res) => {
  try {
    const { gameId, playerId, ratings, rankings } = req.body;

    const game = await db.getGame(gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const player = await db.getPlayer(playerId);
    if (!player || player.gameId !== gameId) return res.status(404).json({ error: 'Player not found in this game' });
    if (player.hasVoted) return res.status(400).json({ error: 'Already voted' });

    // Prevent voting on own outfit
    const playerOutfits = await db.getOutfitsByGameId(gameId);
    const ownOutfitIds = new Set(playerOutfits.filter(o => o.playerId === playerId).map(o => o.outfitId));

    let voteWrites;

    if (game.votingMode === 'ranking') {
      // Ranking mode: rankings is an ordered array of outfitIds (best first)
      if (!Array.isArray(rankings) || rankings.length === 0) {
        return res.status(400).json({ error: 'rankings array is required for ranking mode' });
      }
      const selfVote = rankings.find(id => ownOutfitIds.has(id));
      if (selfVote) return res.status(400).json({ error: 'Cannot include your own outfit in rankings' });

      // Store each rank position: rank 1 = best, rank N = worst
      voteWrites = rankings.map((outfitId, index) =>
        db.createVote({ voteId: generateId(), gameId, voterId: playerId, outfitId, rating: index + 1 })
      );
    } else {
      // Star mode: ratings is [{ outfitId, rating }]
      if (!Array.isArray(ratings) || ratings.length === 0) {
        return res.status(400).json({ error: 'ratings array is required' });
      }
      const selfVote = ratings.find(r => ownOutfitIds.has(r.outfitId));
      if (selfVote) return res.status(400).json({ error: 'Cannot vote on your own outfit' });

      voteWrites = ratings.map(({ outfitId, rating }) =>
        db.createVote({ voteId: generateId(), gameId, voterId: playerId, outfitId, rating: Number(rating) })
      );
    }

    await Promise.all([
      ...voteWrites,
      db.updatePlayer(playerId, { hasVoted: true }),
    ]);

    // Check if all players have voted
    const gamePlayers = await db.getPlayersByGameId(gameId);
    const votesRemaining = gamePlayers.filter(p => !p.hasVoted).length;

    if (votesRemaining === 0) {
      await db.updateGameStatus(gameId, 'COMPLETED', {
        endedAt: new Date().toISOString(),
      });
      console.log(`Game ${gameId} completed`);
    }

    // Notify all clients in the room
    if (io) io.to(gameId).emit('vote-submitted', { votesRemaining, isComplete: votesRemaining === 0 });

    res.json({ success: true, votesRemaining });
  } catch (err) {
    console.error('Submit votes error:', err.message);
    res.status(500).json({ error: 'Failed to submit votes' });
  }
});

// GET /api/games/:gameId/results — get final results
app.get('/api/games/:gameId/results', async (req, res) => {
  try {
    const game = await db.getGame(req.params.gameId);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const [gameOutfits, gameVotes, gamePlayers] = await Promise.all([
      db.getOutfitsByGameId(req.params.gameId),
      db.getVotesByGameId(req.params.gameId),
      db.getPlayersByGameId(req.params.gameId),
    ]);

    // Build a player lookup map from the already-fetched players
    const playerMap = new Map(gamePlayers.map(p => [p.playerId, p]));

    // Aggregate vote scores per outfit
    const scoreMap = new Map();

    if (game.votingMode === 'ranking') {
      // Ranking mode: use Borda count
      // Each vote.rating is the rank position (1=best, N=worst)
      // Borda points: N - rank + 1 (best gets N points, worst gets 1)
      const totalOutfits = gameOutfits.filter(o => {
        // Count outfits that were rankable (not the voter's own)
        return true; // all outfits count for N
      }).length;
      // N = number of outfits being ranked per voter (total outfits minus voter's own)
      // But since each voter ranks a different number, derive N from the vote itself
      for (const vote of gameVotes) {
        const entry = scoreMap.get(vote.outfitId) || { total: 0, count: 0 };
        // Count how many outfits this voter ranked (to compute N per voter)
        const voterVotes = gameVotes.filter(v => v.voterId === vote.voterId);
        const n = voterVotes.length;
        const bordaPoints = n - vote.rating + 1; // rank 1 → N points, rank N → 1 point
        entry.total += bordaPoints;
        entry.count += 1;
        scoreMap.set(vote.outfitId, entry);
      }
    } else {
      // Star mode: existing average rating logic
      for (const vote of gameVotes) {
        const entry = scoreMap.get(vote.outfitId) || { total: 0, count: 0 };
        entry.total += vote.rating;
        entry.count += 1;
        scoreMap.set(vote.outfitId, entry);
      }
    }

    // Build ranked results
    const results = gameOutfits.map(outfit => {
      const player = playerMap.get(outfit.playerId);
      const { total = 0, count = 0 } = scoreMap.get(outfit.outfitId) || {};

      let score;
      if (game.votingMode === 'ranking') {
        // Normalize Borda points to 0-5 scale
        // Max possible Borda points per vote = N (number of ranked outfits per voter)
        // Average Borda = total / count, then normalize: (avg / N) * 5
        const avgBorda = count > 0 ? total / count : 0;
        // Estimate N from the first voter's count
        const sampleVoter = gameVotes.find(v => v.voterId);
        const n = sampleVoter ? gameVotes.filter(v => v.voterId === sampleVoter.voterId).length : 1;
        score = count > 0 ? parseFloat(((avgBorda / n) * 5).toFixed(1)) : 0;
      } else {
        score = count > 0 ? parseFloat((total / count).toFixed(1)) : 0;
      }

      return {
        outfitId: outfit.outfitId,
        playerId: outfit.playerId,
        username: player?.username || 'Unknown',
        score,
        totalVotes: count,
        products: outfit.products,
        totalPrice: outfit.totalPrice,
        tryOnImage: tryOnImageCache.get(outfit.outfitId) || outfit.tryOnImage || null,
      };
    });

    // Single-player: generate a synthetic style score
    if (game.singlePlayer) {
      results.forEach(r => {
        const itemCount = r.products.length;
        const budgetEfficiency = Math.min(r.totalPrice / game.budget, 1);
        const categorySet = new Set(r.products.map(p => p.category));
        const variety = categorySet.size;
        // Score: reward variety (up to 5 categories) and budget usage
        r.score = parseFloat(Math.min((variety * 0.7 + budgetEfficiency * 1.5 + itemCount * 0.2), 5).toFixed(1));
        r.totalVotes = 1;
      });
    }

    results.sort((a, b) => b.score - a.score || b.totalVotes - a.totalVotes);
    results.forEach((r, i) => { r.rank = i + 1; });

    res.json({
      results,
      gameStats: {
        totalPlayers: gamePlayers.length,
        totalVotes: gameVotes.length,
        avgBudgetUsed: results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.totalPrice, 0) / results.length)
          : 0,
      },
    });
  } catch (err) {
    console.error('Get results error:', err.message);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// ============================================================
// GEMINI CHAT ASSISTANT
// ============================================================

const GEMINI_CHAT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function chatWithGemini(history, systemPrompt) {
  // history is an array of { role: 'user'|'model', text } messages
  const contents = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
  };

  const response = await fetch(`${GEMINI_CHAT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Gemini chat request failed');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text in Gemini response');
  return text;
}

// POST /api/chat/message — AI style assistant
app.post('/api/chat/message', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { message, outfitContext, theme, budget, history } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const outfitSummary = (outfitContext && outfitContext.length > 0)
      ? outfitContext.map(p => `${p.name} (${p.category}, $${p.price})`).join(', ')
      : 'empty board';

    const systemPrompt = `You are a fashion styling assistant for ShopBop Showdown, a competitive outfit-building game. The player is building an outfit on the theme "${theme || 'fashion'}" with a budget of $${budget || 5000}.

Their current board has: ${outfitSummary}.

Rules:
- Be concise, enthusiastic, and fashion-forward. Keep responses to 2-3 sentences max.
- When recommending products, be SPECIFIC — name exact product types with colors and styles (e.g. "emerald green sequin mini dress" not just "a dress").
- If the user's request is vague (e.g. "anything for a party?", "recommend me items", "what else?"), ask a short follow-up question to narrow it down. For example: "What vibe are you going for — glam, edgy, or playful?" or "Are you looking for a dress, separates, or accessories?"
- Always carry forward context from the full conversation. If the user previously mentioned a color, style, or occasion, keep those preferences in your suggestions.
- Do NOT just describe imaginary outfits. Your job is to help them find real products to add to their board.
- IMPORTANT: Product cards are shown to the user automatically alongside your message. You do NOT need to "send" or "show" products — they appear automatically. If the user asks "show me", "send it", "add it", or "can I see those", just confirm what you're searching for (e.g. "Here are some gold strappy heels for you!"). The products will appear.`;

    // Build Gemini conversation history from prior messages
    const geminiHistory = [];
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user') {
          geminiHistory.push({ role: 'user', text: msg.text });
        } else if (msg.role === 'bot') {
          geminiHistory.push({ role: 'model', text: msg.text });
        }
      }
    }
    // Append the current user message
    geminiHistory.push({ role: 'user', text: message });

    // Build conversation transcript for the keyword extractor
    const transcript = (Array.isArray(history) ? history : [])
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const searchPrompt = `You are a search query generator for Shopbop.com. Read the conversation below and output a SHORT, SIMPLE product search query.

CRITICAL RULES:
- Output ONLY the search query on line 1. No explanation, no quotes.
- Keep queries to 2-3 words MAX. Shopbop search works best with simple terms.
- GOOD queries: "black dress", "gold heels", "red mini skirt", "white blazer", "leather boots"
- BAD queries: "structured architectural midi dress", "elegant evening cocktail gown", "high end luxurious outfit"
- Format: [color] [product type]. Example: "black dress", "blue jeans", "green top"
- ALWAYS include the color if the user mentioned one ANYWHERE in the conversation.
- ALWAYS include the basic product type (dress, heels, boots, bag, jacket, etc.)
- Do NOT use fancy adjectives like "architectural", "structured", "luxurious", "elegant", "sophisticated". Shopbop won't find them.
- If a price limit is mentioned, output JUST the number on line 2.
- If the user says "show me", "send it", "add it", "yes please" — search for the product the assistant just recommended, keeping it simple (e.g. "gold strappy heels" not "gold metallic strappy high heel sandals").
- Only output "SKIP" if the conversation is purely small talk with zero product context.

Conversation:
${transcript}
User: ${message}`;

    // Two parallel calls: conversational reply + search keywords
    const [rawReply, searchKeywords] = await Promise.all([
      chatWithGemini(geminiHistory, systemPrompt),
      chatWithGemini([{ role: 'user', text: searchPrompt }], 'You extract product search keywords from conversations. Output ONLY the search query, nothing else.'),
    ]);

    // Strip any [SEARCH: ...] block from the conversational reply
    let reply = rawReply.replace(/\[SEARCH:\s*\{[^}]*\}\s*\]/g, '').trim();

    // Parse search keywords and fetch products
    let products = [];
    const firstLine = searchKeywords.trim().split('\n')[0].trim().replace(/['"]/g, '');

    if (firstLine && firstLine.toUpperCase() !== 'SKIP') {
      try {
        const lines = searchKeywords.trim().split('\n').map(l => l.trim()).filter(Boolean);
        const query = firstLine;
        const opts = {};
        if (lines[1] && /^\d+$/.test(lines[1])) {
          opts.maxPrice = parseInt(lines[1]);
        }
        const priceMatch = message.match(/(?:under|below|max|budget|less than)\s*\$?\s*(\d+)/i);
        if (priceMatch && !opts.maxPrice) opts.maxPrice = parseInt(priceMatch[1]);

        console.log('Chat search query:', query, opts);
        let result = await searchShopbop(query, 6, 0, opts);
        products = result.products;

        // Fallback: if no results, simplify query while preserving color + product type
        if (products.length === 0) {
          const words = query.split(/\s+/);
          const colors = ['black','white','red','blue','green','pink','purple','gold','silver','brown','beige','navy','cream','orange','yellow','grey','gray','nude','tan','ivory','coral','burgundy','teal','maroon','olive'];
          const color = words.find(w => colors.includes(w.toLowerCase()));
          const lastWord = words[words.length - 1]; // likely the product type

          // Try color + product type (e.g. "black dress")
          if (color && lastWord.toLowerCase() !== color.toLowerCase()) {
            const fallback1 = `${color} ${lastWord}`;
            console.log('Chat fallback search:', fallback1, opts);
            result = await searchShopbop(fallback1, 6, 0, opts);
            products = result.products;
          }
          // Try just the product type (e.g. "dress")
          if (products.length === 0) {
            console.log('Chat fallback search (product type):', lastWord);
            result = await searchShopbop(lastWord, 6, 0, opts);
            products = result.products;
          }
          // Last resort: product type without price filter
          if (products.length === 0) {
            console.log('Chat fallback search (no filter):', lastWord);
            result = await searchShopbop(lastWord, 6, 0, {});
            products = result.products;
          }
          if (products.length > 0) {
            reply += `\n\nI couldn't find an exact match, but here are some similar options:`;
          }
        }
      } catch (searchErr) {
        console.error('Chat product search failed:', searchErr.message);
      }
    }

    res.json({ reply, products });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message || 'Chat request failed' });
  }
});

// ============================================================
// GEMINI VIRTUAL TRY-ON ENDPOINTS
// ============================================================

// Helper function to generate a single image
// NOTE: This function is duplicated in lambda/tryon-generate/index.js for Lambda deployment.
// If you modify this function, update the Lambda version too.
async function generateSingleImage(products, productImages, variation = 0, userPhoto = null) {
  const variationPrompts = [
    'standing in a confident pose',
    'in a relaxed, natural pose',
    'walking forward with dynamic movement',
  ];

  const hasUserPhoto = userPhoto && userPhoto.base64;

  const parts = [];

  // Put reference photo FIRST so Gemini sees it before any instructions
  if (hasUserPhoto) {
    parts.push({ text: 'REFERENCE PERSON (the generated model MUST look exactly like this person):' });
    parts.push({
      inlineData: {
        mimeType: userPhoto.mimeType || 'image/jpeg',
        data: userPhoto.base64
      }
    });
  }

  const prompt = hasUserPhoto
    ? `Now look at the product images below and generate a high-quality fashion photograph of THIS EXACT PERSON wearing ALL of these items together as an outfit.

The items are:
${products.map((p, i) => `${i + 1}. ${p.name} (${p.category}) by ${p.brand}`).join('\n')}

CRITICAL REQUIREMENTS:
- You MUST generate the SAME person shown in the reference photo above — identical face, skin tone, hair color, hair style, and body type. Do not substitute a different person.
- The model MUST wear items that match the EXACT colors, patterns, and styles shown in the product images
- Combine all items into one cohesive outfit on the model
- The model should be ${variationPrompts[variation % variationPrompts.length]}
- Full-body shot, professional fashion photography style
- Clean white or neutral studio background
- All items must be clearly visible
- Photorealistic, high resolution`
    : `Look at these product images I'm providing. Generate a high-quality fashion photograph of a model wearing ALL of these EXACT items together as an outfit.

The items are:
${products.map((p, i) => `${i + 1}. ${p.name} (${p.category}) by ${p.brand}`).join('\n')}

CRITICAL REQUIREMENTS:
- The model MUST wear items that match the EXACT colors, patterns, and styles shown in the reference images
- Combine all items into one cohesive outfit on a single model
- The model should be ${variationPrompts[variation % variationPrompts.length]}
- Full-body shot, professional fashion photography style
- Clean white or neutral studio background
- All items must be clearly visible
- Photorealistic, high resolution`;

  parts.push({ text: prompt });

  if (productImages && productImages.length > 0) {
    for (let i = 0; i < productImages.length; i++) {
      const img = productImages[i];
      if (img.base64) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: img.base64,
          },
        });
        parts.push({ text: `(Above: ${products[i]?.name || 'Item'} - ${products[i]?.category || 'Fashion'})` });
      }
    }
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to generate image');
  }

  const data = await response.json();
  if (data.candidates?.[0]?.content?.parts) {
    for (const part of data.candidates[0].content.parts) {
      if (part.inlineData) {
        return { imageData: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
      }
    }
  }
  throw new Error('No image in response');
}

// Invoke the Lambda function for a single try-on image
async function invokeTryonLambda(products, productImages, variation, userPhoto) {
  const payload = { products, productImages, variation, userPhoto };
  const payloadStr = JSON.stringify(payload);

  // Lambda sync invoke limit: 6MB request
  if (Buffer.byteLength(payloadStr) > 5.5 * 1024 * 1024) {
    throw new Error('Payload too large for Lambda');
  }

  const command = new InvokeCommand({
    FunctionName: TRYON_LAMBDA_NAME,
    InvocationType: 'RequestResponse',
    Payload: payloadStr,
  });

  const response = await lambdaClient.send(command);

  // Lambda-level error (timeout, out of memory, crash)
  if (response.FunctionError) {
    const errorPayload = Buffer.from(response.Payload).toString();
    throw new Error(`Lambda ${response.FunctionError}: ${errorPayload.slice(0, 200)}`);
  }

  const result = JSON.parse(Buffer.from(response.Payload).toString());
  if (result.statusCode !== 200) throw new Error(result.error || 'Lambda execution failed');
  return { imageData: result.imageData, mimeType: result.mimeType };
}

// POST /api/tryon/generate — generate 3 try-on images
app.post('/api/tryon/generate', async (req, res) => {
  // Block only if neither local key nor Lambda is available
  if (!GEMINI_API_KEY && !TRYON_LAMBDA_NAME) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { products, productImages, count = 3, userPhoto } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    const imageCount = Math.min(count, 3); // Max 3 images

    // Parse user photo from data URL if provided
    let parsedUserPhoto = null;
    if (userPhoto) {
      const match = userPhoto.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parsedUserPhoto = { mimeType: match[1], base64: match[2] };
      }
    }

    // Dispatch: Lambda if configured, otherwise local
    const useLambda = !!TRYON_LAMBDA_NAME;
    const generateFn = useLambda
      ? (variation) => invokeTryonLambda(products, productImages, variation, parsedUserPhoto)
      : (variation) => generateSingleImage(products, productImages, variation, parsedUserPhoto);

    console.log(`Generating ${imageCount} images in parallel (${useLambda ? 'Lambda' : 'local'})...`);

    const results = await Promise.all(
      Array.from({ length: imageCount }, (_, i) =>
        generateFn(i)
          .then(result => ({ success: true, result, index: i }))
          .catch(err => {
            console.error(`Error generating image ${i + 1}:`, err.message);
            return { success: false, error: err.message, index: i };
          })
      )
    );

    let images = results.filter(r => r.success).map(r => r.result);
    const errors = results.filter(r => !r.success).map(r => r.error);

    // Retry failed Lambda calls locally (only if Express has GEMINI_API_KEY)
    if (useLambda && errors.length > 0 && images.length < imageCount && GEMINI_API_KEY) {
      const failedIndices = results.filter(r => !r.success).map(r => r.index);
      console.log(`${failedIndices.length} Lambda failure(s) — retrying locally...`);
      const retryResults = await Promise.all(
        failedIndices.map(i =>
          generateSingleImage(products, productImages, i, parsedUserPhoto)
            .then(result => ({ success: true, result }))
            .catch(err => ({ success: false, error: err.message }))
        )
      );
      images.push(...retryResults.filter(r => r.success).map(r => r.result));
    }

    if (images.length === 0) return res.status(500).json({ error: errors[0] || 'Failed to generate any images' });
    console.log(`Generated ${images.length}/${imageCount} images`);
    return res.json({ images });

  } catch (error) {
    console.error('Error in /api/tryon/generate:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tryon/generate-single — regenerate one image
app.post('/api/tryon/generate-single', async (req, res) => {
  if (!GEMINI_API_KEY && !TRYON_LAMBDA_NAME) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { products, productImages, variation = 0, userPhoto } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    // Parse user photo from data URL if provided
    let parsedUserPhoto = null;
    if (userPhoto) {
      const match = userPhoto.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parsedUserPhoto = { mimeType: match[1], base64: match[2] };
      }
    }

    console.log(`Generating single image with variation ${variation}...`);
    const result = await generateSingleImage(products, productImages, variation, parsedUserPhoto);
    console.log('Single image generated successfully');

    return res.json(result);

  } catch (error) {
    console.error('Error in /api/tryon/generate-single:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================================
// AVATAR GENERATION ENDPOINT
// ============================================================

// POST /api/avatar/generate — generate a personalized model avatar from physical descriptors
app.post('/api/avatar/generate', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { ethnicity, height, waistSize, topSize, gender } = req.body;

  const descriptors = [];
  if (ethnicity) descriptors.push(ethnicity);
  if (gender) descriptors.push(gender);
  if (height) descriptors.push(`${height} tall`);
  if (waistSize) descriptors.push(`waist size ${waistSize}`);
  if (topSize) descriptors.push(`wears a size ${topSize} top`);

  const description = descriptors.length > 0
    ? descriptors.join(', ')
    : 'average build';

  const prompt = `Generate a high-quality, photorealistic full-body fashion photography portrait of a ${description} person. The person should be standing in a neutral, confident pose against a clean white studio background. Professional fashion model photography style, full-body shot from head to toe. The image should look like a real person, natural lighting, no clothing — just a plain white t-shirt and jeans so the body type and proportions are visible. This will be used as a reference photo for virtual fashion try-on.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to generate avatar');
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('No candidates returned');

    const imagePart = candidate.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart) throw new Error('No image in response');

    return res.json({
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    });
  } catch (error) {
    console.error('Error in /api/avatar/generate:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================================
// START SERVER
// ============================================================

const server = http.createServer(app);
io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-room', ({ gameId, playerId }) => {
    if (gameId) {
      socket.join(gameId);
      socket.data.gameId = gameId;
      socket.data.playerId = playerId;
      console.log(`Socket ${socket.id} joined room ${gameId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    if (!GEMINI_API_KEY) console.warn('WARNING: GEMINI_API_KEY not set');
    if (TRYON_LAMBDA_NAME) console.log(`Lambda try-on enabled: ${TRYON_LAMBDA_NAME}`);
    if (!process.env.SHOPBOP_API_KEY) console.warn('WARNING: SHOPBOP_API_KEY not set — using client-id only');
    console.log(`ShopBop client-id: ${SHOPBOP_CLIENT_ID}`);
  });
}

module.exports = { app, server };
