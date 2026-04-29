const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getOutfitsByGameId: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Outfit endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/games/:gameId/outfits hides player identity during voting', async () => {
    db.getGame.mockResolvedValue({
      gameId: 'ABC123',
      status: 'VOTING',
    });
    db.getOutfitsByGameId.mockResolvedValue([
      {
        outfitId: 'OUT1',
        playerId: 'P1',
        products: [{ name: 'Dress' }],
        totalPrice: 120,
        tryOnImage: 'look.png',
      },
    ]);

    const res = await request(app).get('/api/games/ABC123/outfits');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      outfits: [
        {
          outfitId: 'OUT1',
          products: [{ name: 'Dress' }],
          totalPrice: 120,
          tryOnImage: 'look.png',
        },
      ],
    });
    expect(res.body.outfits[0].playerId).toBeUndefined();
    expect(res.body.outfits[0].playerName).toBeUndefined();
  });
});
