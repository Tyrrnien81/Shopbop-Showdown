const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getOutfitsByGameId: jest.fn(),
  getVotesByGameId: jest.fn(),
  getPlayersByGameId: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Results endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/games/:gameId/results returns ranked results with vote averages', async () => {
    db.getGame.mockResolvedValue({
      gameId: 'ABC123',
      singlePlayer: false,
      budget: 500,
    });
    db.getOutfitsByGameId.mockResolvedValue([
      {
        outfitId: 'OUT1',
        playerId: 'P1',
        products: [{ name: 'Blazer', category: 'jackets' }],
        totalPrice: 200,
        tryOnImage: null,
      },
      {
        outfitId: 'OUT2',
        playerId: 'P2',
        products: [{ name: 'Heels', category: 'shoes' }],
        totalPrice: 300,
        tryOnImage: null,
      },
    ]);
    db.getVotesByGameId.mockResolvedValue([
      { outfitId: 'OUT1', rating: 4 },
      { outfitId: 'OUT1', rating: 5 },
      { outfitId: 'OUT2', rating: 3 },
    ]);
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'P1', username: 'alice' },
      { playerId: 'P2', username: 'bob' },
    ]);

    const res = await request(app).get('/api/games/ABC123/results');

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toMatchObject({
      outfitId: 'OUT1',
      username: 'alice',
      score: 4.5,
      totalVotes: 2,
      rank: 1,
    });
    expect(res.body.results[1]).toMatchObject({
      outfitId: 'OUT2',
      username: 'bob',
      score: 3,
      totalVotes: 1,
      rank: 2,
    });
    expect(res.body.gameStats).toEqual({
      totalPlayers: 2,
      totalVotes: 3,
      avgBudgetUsed: 250,
    });
  });
});
