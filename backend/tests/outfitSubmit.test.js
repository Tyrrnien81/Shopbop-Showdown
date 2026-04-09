const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getPlayer: jest.fn(),
  createOutfit: jest.fn().mockResolvedValue(undefined),
  updatePlayer: jest.fn().mockResolvedValue(undefined),
  updateOutfit: jest.fn().mockResolvedValue(undefined),
  getPlayersByGameId: jest.fn(),
  updateGameStatus: jest.fn().mockResolvedValue(undefined),
}));

const db = require('../db');
const { app } = require('../server');

describe('POST /api/outfits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when game does not exist', async () => {
    db.getGame.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/outfits')
      .send({ gameId: 'NOPE01', playerId: 'p1', products: [], totalPrice: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/game not found/i);
  });

  it('returns 404 when player is not in the game', async () => {
    db.getGame.mockResolvedValue({ gameId: 'G1', status: 'PLAYING' });
    db.getPlayer.mockResolvedValue({ playerId: 'p1', gameId: 'OTHER' });

    const res = await request(app)
      .post('/api/outfits')
      .send({ gameId: 'G1', playerId: 'p1', products: [], totalPrice: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/player not found in this game/i);
  });

  it('creates outfit and returns 201 with outfitId', async () => {
    db.getGame.mockResolvedValue({ gameId: 'G1', status: 'PLAYING', budget: 2000 });
    db.getPlayer.mockResolvedValue({ playerId: 'p1', gameId: 'G1', hasSubmitted: false });
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'p1', hasSubmitted: true },
      { playerId: 'p2', hasSubmitted: false },
    ]);

    const products = [
      { productSin: '111', name: 'Jacket', price: 300, category: 'Outerwear' },
    ];

    const res = await request(app)
      .post('/api/outfits')
      .send({ gameId: 'G1', playerId: 'p1', products, totalPrice: 300 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('outfitId');
    expect(typeof res.body.outfitId).toBe('string');
    expect(res.body).toHaveProperty('submittedAt');

    expect(db.createOutfit).toHaveBeenCalledTimes(1);
    expect(db.updatePlayer).toHaveBeenCalledWith('p1', {
      hasSubmitted: true,
      outfitId: res.body.outfitId,
    });
  });

  it('auto-advances solo game to COMPLETED when all players submit', async () => {
    db.getGame.mockResolvedValue({ gameId: 'G1', status: 'PLAYING', budget: 2000, singlePlayer: true });
    db.getPlayer.mockResolvedValue({ playerId: 'p1', gameId: 'G1', hasSubmitted: false });
    // All players have submitted after this submission
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'p1', hasSubmitted: true },
    ]);

    const res = await request(app)
      .post('/api/outfits')
      .send({ gameId: 'G1', playerId: 'p1', products: [], totalPrice: 0 });

    expect(res.status).toBe(201);
    expect(db.updateGameStatus).toHaveBeenCalledWith(
      'G1',
      'COMPLETED',
      expect.objectContaining({ endedAt: expect.any(String) }),
    );
  });
});
