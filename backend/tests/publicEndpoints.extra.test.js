const request = require('supertest');

jest.mock('../db', () => ({
  getPublicActiveGames: jest.fn(),
  scanAllOutfits: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Public utility endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET / returns service status', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      service: 'ShopBop Showdown API',
      status: 'running',
    });
  });

  test('GET /api/games/public returns only joinable public multiplayer games', async () => {
    db.getPublicActiveGames.mockResolvedValue([
      {
        gameId: 'NEW123',
        roomName: 'New Room',
        hostPlayerId: 'HOST1',
        budget: 500,
        timeLimit: 300,
        maxPlayers: 4,
        playerIds: ['HOST1', 'P2'],
        themeName: 'Runway Ready',
        themeMode: 'pick',
        votingMode: 'star',
        status: 'LOBBY',
        singlePlayer: false,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        gameId: 'OLD123',
        roomName: 'Old Room',
        status: 'PLAYING',
        singlePlayer: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        gameId: 'SOLO12',
        roomName: 'Solo Room',
        status: 'LOBBY',
        singlePlayer: true,
        createdAt: '2026-01-03T00:00:00.000Z',
      },
    ]);

    const res = await request(app).get('/api/games/public');

    expect(res.status).toBe(200);
    expect(res.body.games).toEqual([
      expect.objectContaining({
        gameId: 'NEW123',
        roomName: 'New Room',
        playerCount: 2,
        contestantCount: 2,
      }),
    ]);
  });

  test('GET /api/popular-products returns most picked products with images', async () => {
    db.scanAllOutfits.mockResolvedValue([
      {
        products: [
          { productSin: 'A1', name: 'Black Dress', brand: 'Brand A', category: 'Dresses', price: 100, imageUrl: 'https://img/a.jpg' },
          { productSin: 'B2', name: 'No Image', brand: 'Brand B' },
        ],
      },
      {
        products: [
          { productSin: 'A1', name: 'Black Dress', brand: 'Brand A', category: 'Dresses', price: 100, imageUrl: 'https://img/a.jpg' },
          { productSin: 'C3', name: 'Boots', brand: 'Brand C', category: 'Shoes', price: 200, imageUrl: 'https://img/c.jpg' },
        ],
      },
    ]);

    const res = await request(app).get('/api/popular-products?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([
      expect.objectContaining({ id: 'A1', pickCount: 2 }),
      expect.objectContaining({ id: 'C3', pickCount: 1 }),
    ]);
  });
});
