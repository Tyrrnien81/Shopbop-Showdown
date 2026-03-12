require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================
// CONFIGURATION
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

const SHOPBOP_API_BASE = 'https://api.shopbop.com';
// Client-ID provided by Shopbop for UW Capstone - can be overridden via env
const SHOPBOP_CLIENT_ID = process.env.SHOPBOP_CLIENT_ID || 'Shopbop-UW-Team1-2024';

// ============================================================
// IN-MEMORY DATA STORES
// ============================================================

const games = new Map();
const players = new Map();
const outfits = new Map();
const votes = new Map();

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function generateGameId() {
  // 6-char alphanumeric code, avoiding confusing chars
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (games.has(id));
  return id;
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
    productUrl: `https://www.shopbop.com/dp/${productSin}`,
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
      const queries = cat ? cat.queries : [category];
      const perQueryLimit = Math.max(Math.ceil(limitNum / queries.length), 8);

      const fetches = queries.map(q =>
        searchShopbop(`${genderPrefix}${colorPrefix}${q}`, perQueryLimit, offset, opts)
          .then(r => r.products)
          .catch(() => [])
      );
      const results = await Promise.all(fetches);
      products = results.flat();
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
app.post('/api/games', (req, res) => {
  const { hostUsername, theme, budget, maxPlayers, timeLimit, singlePlayer } = req.body;

  if (!hostUsername || !theme) {
    return res.status(400).json({ error: 'hostUsername and theme are required' });
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
  };

  games.set(gameId, game);
  players.set(playerId, player);

  console.log(`Game created: ${gameId} by ${hostUsername}`);
  res.status(201).json({ game, player });
});

// GET /api/games/:gameId — get game details
app.get('/api/games/:gameId', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const gamePlayers = game.playerIds.map(id => players.get(id)).filter(Boolean);
  res.json({ ...game, players: gamePlayers });
});

// POST /api/games/:gameId/join — join existing game
app.post('/api/games/:gameId/join', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'LOBBY') return res.status(400).json({ error: 'Game has already started' });
  if (game.playerIds.length >= game.maxPlayers) return res.status(400).json({ error: 'Game is full' });

  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });

  const playerId = generateId();
  const player = {
    playerId,
    username,
    isHost: false,
    isReady: false,
    hasSubmitted: false,
    hasVoted: false,
    gameId: game.gameId,
    outfitId: null,
  };

  game.playerIds.push(playerId);
  players.set(playerId, player);

  const gamePlayers = game.playerIds.map(id => players.get(id)).filter(Boolean);
  console.log(`${username} joined game ${game.gameId}`);
  res.json({ player, game: { ...game, players: gamePlayers } });
});

// POST /api/games/:gameId/ready — toggle ready status
app.post('/api/games/:gameId/ready', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { playerId, isReady } = req.body;
  const player = players.get(playerId);
  if (!player || player.gameId !== game.gameId) return res.status(404).json({ error: 'Player not found in this game' });

  player.isReady = Boolean(isReady);
  res.json({ success: true, player });
});

// POST /api/games/:gameId/start — start the game (host only)
app.post('/api/games/:gameId/start', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'LOBBY') return res.status(400).json({ error: 'Game already started' });

  const now = new Date();
  game.status = 'PLAYING';
  game.startedAt = now.toISOString();
  game.endsAt = new Date(now.getTime() + game.timeLimit * 1000).toISOString();

  console.log(`Game ${game.gameId} started`);
  res.json({ success: true, game });
});

// GET /api/games/:gameId/players — list players
app.get('/api/games/:gameId/players', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const gamePlayers = game.playerIds.map(id => players.get(id)).filter(Boolean);
  res.json({ players: gamePlayers });
});

// ============================================================
// OUTFIT ENDPOINTS
// ============================================================

// POST /api/outfits — submit outfit
app.post('/api/outfits', (req, res) => {
  const { gameId, playerId, products: outfitProducts, totalPrice, tryOnImage } = req.body;

  const game = games.get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const player = players.get(playerId);
  if (!player || player.gameId !== gameId) return res.status(404).json({ error: 'Player not found in this game' });
  if (player.hasSubmitted) return res.status(400).json({ error: 'Outfit already submitted' });

  const outfitId = generateId();
  const outfit = {
    outfitId,
    gameId,
    playerId,
    products: outfitProducts || [],
    totalPrice: totalPrice || 0,
    tryOnImage: tryOnImage || null,
    submittedAt: new Date().toISOString(),
  };

  outfits.set(outfitId, outfit);
  player.hasSubmitted = true;
  player.outfitId = outfitId;

  // Auto-advance when all players have submitted
  const gamePlayers = game.playerIds.map(id => players.get(id)).filter(Boolean);
  if (gamePlayers.every(p => p.hasSubmitted)) {
    if (game.singlePlayer) {
      game.status = 'COMPLETED';
      game.endedAt = new Date().toISOString();
      console.log(`Solo game ${gameId} completed (skipping voting)`);
    } else {
      game.status = 'VOTING';
      console.log(`Game ${gameId} moved to VOTING phase`);
    }
  }

  console.log(`Outfit ${outfitId} submitted by player ${playerId}`);
  res.status(201).json({ outfitId, submittedAt: outfit.submittedAt });
});

// GET /api/games/:gameId/outfits — get outfits (anonymized during voting)
app.get('/api/games/:gameId/outfits', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const gameOutfits = [];
  for (const outfit of outfits.values()) {
    if (outfit.gameId !== req.params.gameId) continue;

    if (game.status === 'VOTING') {
      // Anonymized — no player info
      gameOutfits.push({
        outfitId: outfit.outfitId,
        products: outfit.products,
        totalPrice: outfit.totalPrice,
      });
    } else {
      // Include player info for completed games
      const player = players.get(outfit.playerId);
      gameOutfits.push({
        outfitId: outfit.outfitId,
        playerId: outfit.playerId,
        playerName: player?.username,
        products: outfit.products,
        totalPrice: outfit.totalPrice,
      });
    }
  }

  res.json({ outfits: gameOutfits });
});

// ============================================================
// VOTING ENDPOINTS
// ============================================================

// POST /api/votes — submit votes
app.post('/api/votes', (req, res) => {
  const { gameId, playerId, ratings } = req.body;

  const game = games.get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const player = players.get(playerId);
  if (!player || player.gameId !== gameId) return res.status(404).json({ error: 'Player not found in this game' });
  if (player.hasVoted) return res.status(400).json({ error: 'Already voted' });
  if (!Array.isArray(ratings) || ratings.length === 0) return res.status(400).json({ error: 'ratings array is required' });

  for (const { outfitId, rating } of ratings) {
    const voteId = generateId();
    votes.set(voteId, { voteId, gameId, voterId: playerId, outfitId, rating: Number(rating) });
  }

  player.hasVoted = true;

  const gamePlayers = game.playerIds.map(id => players.get(id)).filter(Boolean);
  const votesRemaining = gamePlayers.filter(p => !p.hasVoted).length;

  if (votesRemaining === 0) {
    game.status = 'COMPLETED';
    game.endedAt = new Date().toISOString();
    console.log(`Game ${gameId} completed`);
  }

  res.json({ success: true, votesRemaining });
});

// GET /api/games/:gameId/results — get final results
app.get('/api/games/:gameId/results', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  // Collect outfits for this game
  const gameOutfits = [];
  for (const outfit of outfits.values()) {
    if (outfit.gameId === req.params.gameId) gameOutfits.push(outfit);
  }

  // Aggregate vote scores per outfit
  const scoreMap = new Map(); // outfitId → { total, count }
  for (const vote of votes.values()) {
    if (vote.gameId !== req.params.gameId) continue;
    const entry = scoreMap.get(vote.outfitId) || { total: 0, count: 0 };
    entry.total += vote.rating;
    entry.count += 1;
    scoreMap.set(vote.outfitId, entry);
  }

  // Build ranked results
  const results = gameOutfits.map(outfit => {
    const player = players.get(outfit.playerId);
    const { total = 0, count = 0 } = scoreMap.get(outfit.outfitId) || {};
    const score = count > 0 ? total / count : 0;
    return {
      outfitId: outfit.outfitId,
      playerId: outfit.playerId,
      username: player?.username || 'Unknown',
      score: parseFloat(score.toFixed(1)),
      totalVotes: count,
      products: outfit.products,
      totalPrice: outfit.totalPrice,
      tryOnImage: outfit.tryOnImage || null,
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

  const gamePlayers = game.playerIds.map(id => players.get(id)).filter(Boolean);
  const gameVotes = [...votes.values()].filter(v => v.gameId === req.params.gameId);

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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// POST /api/tryon/generate — generate 3 try-on images
app.post('/api/tryon/generate', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key not configured' });

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

    // Generate images sequentially with delay to avoid rate limiting
    const images = [];
    const errors = [];

    for (let i = 0; i < imageCount; i++) {
      try {
        console.log(`Generating image ${i + 1} of ${imageCount}...`);
        const result = await generateSingleImage(products, productImages, i, parsedUserPhoto);
        images.push(result);
        if (i < imageCount - 1) {
          console.log('Waiting 2s before next request...');
          await delay(2000);
        }
      } catch (err) {
        console.error(`Error generating image ${i + 1}:`, err.message);
        errors.push(err.message);
      }
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
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key not configured' });

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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) console.warn('WARNING: GEMINI_API_KEY not set');
  if (!process.env.SHOPBOP_API_KEY) console.warn('WARNING: SHOPBOP_API_KEY not set — using client-id only');
  console.log(`ShopBop client-id: ${SHOPBOP_CLIENT_ID}`);
});
