const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getOutfitsByGameId: jest.fn(),
  getPlayer: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('GET /api/games/:gameId/outfits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when game does not exist', async () => {
    db.getGame.mockResolvedValue(null);

    const res = await request(app).get('/api/games/NOPE01/outfits');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/game not found/i);
  });

  it('anonymizes outfits during VOTING (no playerName)', async () => {
    db.getGame.mockResolvedValue({ gameId: 'G1', status: 'VOTING' });
    db.getOutfitsByGameId.mockResolvedValue([
      { outfitId: 'o1', playerId: 'p1', products: [{ name: 'Jacket' }], totalPrice: 300 },
    ]);

    const res = await request(app).get('/api/games/G1/outfits');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('outfits');
    expect(res.body.outfits).toHaveLength(1);

    const outfit = res.body.outfits[0];
    expect(outfit).toHaveProperty('outfitId', 'o1');
    expect(outfit).toHaveProperty('playerId', 'p1');
    expect(outfit).toHaveProperty('products');
    expect(outfit).toHaveProperty('totalPrice', 300);
    // During VOTING, playerName should NOT be included
    expect(outfit).not.toHaveProperty('playerName');
  });

  it('includes playerName for COMPLETED games', async () => {
    db.getGame.mockResolvedValue({ gameId: 'G1', status: 'COMPLETED' });
    db.getOutfitsByGameId.mockResolvedValue([
      { outfitId: 'o1', playerId: 'p1', products: [], totalPrice: 500 },
    ]);
    db.getPlayer.mockResolvedValue({ playerId: 'p1', username: 'alice' });

    const res = await request(app).get('/api/games/G1/outfits');

    expect(res.status).toBe(200);
    const outfit = res.body.outfits[0];
    expect(outfit).toHaveProperty('playerName', 'alice');
  });
});
