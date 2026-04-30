const request = require('supertest');

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'secret';

jest.mock('../db', () => ({
  scanAllGames: jest.fn(),
  scanAllOutfits: jest.fn(),
  scanAllVotes: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

function basicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requires admin credentials', async () => {
    const res = await request(app).get('/api/admin/analytics');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing credentials/i);
  });

  test('returns aggregate analytics for authenticated admin', async () => {
    db.scanAllGames.mockResolvedValue([
      {
        gameId: 'G1',
        status: 'COMPLETED',
        themeName: 'Runway Ready',
        singlePlayer: false,
        playerIds: ['P1', 'P2'],
        createdAt: '2026-01-01T00:00:00.000Z',
        startedAt: '2026-01-01T00:00:00.000Z',
        endedAt: '2026-01-01T00:05:00.000Z',
      },
    ]);
    db.scanAllOutfits.mockResolvedValue([
      {
        outfitId: 'O1',
        totalPrice: 250,
        products: [
          { productSin: 'A1', name: 'Black Dress', brand: 'Brand A', category: 'Dresses', price: 100, imageUrl: 'https://img/a.jpg' },
        ],
      },
      {
        outfitId: 'O2',
        totalPrice: 300,
        products: [
          { productSin: 'A1', name: 'Black Dress', brand: 'Brand A', category: 'Dresses', price: 100, imageUrl: 'https://img/a.jpg' },
        ],
      },
    ]);
    db.scanAllVotes.mockResolvedValue([
      { outfitId: 'O1', rating: 5 },
      { outfitId: 'O2', rating: 3 },
    ]);

    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', basicAuth('admin', 'secret'));

    expect(res.status).toBe(200);
    expect(res.body.gameStats).toMatchObject({
      totalGames: 1,
      completionRate: 100,
      avgPlayersPerGame: 2,
      avgDurationSeconds: 300,
    });
    expect(res.body.productPopularity).toMatchObject({
      totalProductsPicked: 2,
      uniqueProductsUsed: 1,
    });
    expect(res.body.productPerformance.overallAvgRating).toBe(4);
  });
});
