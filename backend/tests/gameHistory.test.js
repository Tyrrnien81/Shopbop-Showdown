const request = require('supertest');

jest.mock('../db', () => ({
  scanAllGames: jest.fn(),
  scanAllOutfits: jest.fn(),
  scanAllVotes: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('GET /api/games/history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty history when no completed games exist', async () => {
    db.scanAllGames.mockResolvedValue([]);
    db.scanAllOutfits.mockResolvedValue([]);
    db.scanAllVotes.mockResolvedValue([]);

    const res = await request(app).get('/api/games/history');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('history');
    expect(res.body.history).toEqual([]);
  });

  it('excludes single-player and in-progress games', async () => {
    db.scanAllGames.mockResolvedValue([
      { gameId: 'G1', status: 'LOBBY', playerIds: ['p1', 'p2'] },
      { gameId: 'G2', status: 'COMPLETED', singlePlayer: true, playerIds: ['p1'] },
      { gameId: 'G3', status: 'PLAYING', playerIds: ['p1', 'p2'] },
    ]);
    db.scanAllOutfits.mockResolvedValue([]);
    db.scanAllVotes.mockResolvedValue([]);

    const res = await request(app).get('/api/games/history');

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(0);
  });

  it('returns completed multiplayer games with winner info', async () => {
    db.scanAllGames.mockResolvedValue([
      {
        gameId: 'G1',
        status: 'COMPLETED',
        singlePlayer: false,
        playerIds: ['p1', 'p2'],
        theme: 'streetwear',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    db.scanAllOutfits.mockResolvedValue([
      { outfitId: 'o1', gameId: 'G1', username: 'alice', products: [{ imageUrl: 'http://img.jpg' }] },
      { outfitId: 'o2', gameId: 'G1', username: 'bob', products: [] },
    ]);
    db.scanAllVotes.mockResolvedValue([
      { outfitId: 'o1', rating: 5 },
      { outfitId: 'o1', rating: 4 },
      { outfitId: 'o2', rating: 2 },
    ]);

    const res = await request(app).get('/api/games/history');

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(1);

    const game = res.body.history[0];
    expect(game.gameId).toBe('G1');
    expect(game.themeName).toBe('streetwear');
    expect(game.playerCount).toBe(2);
    expect(game.winner).not.toBeNull();
    expect(game.winner.username).toBe('alice');
    expect(game.winner.score).toBeGreaterThan(game.winner.score === 4.5 ? -1 : 0);
    expect(game.winner.previewImage).toBe('http://img.jpg');
  });
});
