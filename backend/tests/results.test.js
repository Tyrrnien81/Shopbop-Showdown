const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getOutfitsByGameId: jest.fn(),
  getVotesByGameId: jest.fn(),
  getPlayersByGameId: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('GET /api/games/:gameId/results', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when game does not exist', async () => {
    db.getGame.mockResolvedValue(null);

    const res = await request(app).get('/api/games/NOPE01/results');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/game not found/i);
  });

  it('returns ranked results with star-mode scores', async () => {
    db.getGame.mockResolvedValue({
      gameId: 'G1',
      status: 'COMPLETED',
      budget: 2000,
    });
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'p1', username: 'alice' },
      { playerId: 'p2', username: 'bob' },
    ]);
    db.getOutfitsByGameId.mockResolvedValue([
      { outfitId: 'o1', playerId: 'p1', products: [{ category: 'Tops' }], totalPrice: 500 },
      { outfitId: 'o2', playerId: 'p2', products: [{ category: 'Jeans' }], totalPrice: 800 },
    ]);
    db.getVotesByGameId.mockResolvedValue([
      { outfitId: 'o1', voterId: 'p2', rating: 4 },
      { outfitId: 'o2', voterId: 'p1', rating: 2 },
    ]);

    const res = await request(app).get('/api/games/G1/results');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('gameStats');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results).toHaveLength(2);

    // Results should be sorted by score descending
    const [first, second] = res.body.results;
    expect(first.score).toBeGreaterThanOrEqual(second.score);

    // Check result shape
    expect(first).toHaveProperty('outfitId');
    expect(first).toHaveProperty('playerId');
    expect(first).toHaveProperty('username');
    expect(first).toHaveProperty('score');
    expect(first).toHaveProperty('totalVotes');
    expect(first).toHaveProperty('rank');
    expect(first).toHaveProperty('products');
    expect(first).toHaveProperty('totalPrice');

    // First place should be outfit o1 (rating 4 > rating 2)
    expect(first.outfitId).toBe('o1');
    expect(first.score).toBe(4);
    expect(first.rank).toBe(1);

    expect(second.outfitId).toBe('o2');
    expect(second.score).toBe(2);
    expect(second.rank).toBe(2);

    // gameStats shape
    expect(res.body.gameStats.totalPlayers).toBe(2);
    expect(res.body.gameStats.totalVotes).toBe(2);
    expect(typeof res.body.gameStats.avgBudgetUsed).toBe('number');
  });

  it('returns zero scores when no votes exist', async () => {
    db.getGame.mockResolvedValue({ gameId: 'G2', status: 'COMPLETED', budget: 1000 });
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'p1', username: 'alice' },
    ]);
    db.getOutfitsByGameId.mockResolvedValue([
      { outfitId: 'o1', playerId: 'p1', products: [], totalPrice: 0 },
    ]);
    db.getVotesByGameId.mockResolvedValue([]);

    const res = await request(app).get('/api/games/G2/results');

    expect(res.status).toBe(200);
    expect(res.body.results[0].score).toBe(0);
    expect(res.body.results[0].totalVotes).toBe(0);
    expect(res.body.gameStats.totalVotes).toBe(0);
  });

  it('computes synthetic scores for single-player games', async () => {
    db.getGame.mockResolvedValue({
      gameId: 'G3',
      status: 'COMPLETED',
      budget: 2000,
      singlePlayer: true,
    });
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'p1', username: 'solo' },
    ]);
    db.getOutfitsByGameId.mockResolvedValue([
      {
        outfitId: 'o1',
        playerId: 'p1',
        products: [
          { category: 'Tops' },
          { category: 'Jeans' },
          { category: 'Shoes' },
        ],
        totalPrice: 1500,
      },
    ]);
    db.getVotesByGameId.mockResolvedValue([]);

    const res = await request(app).get('/api/games/G3/results');

    expect(res.status).toBe(200);
    const result = res.body.results[0];
    // Single-player uses synthetic scoring, not vote averages
    expect(result.score).toBeGreaterThan(0);
    expect(result.totalVotes).toBe(1);
    expect(result.rank).toBe(1);
  });
});
