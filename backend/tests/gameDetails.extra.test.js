const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getPlayersByGameId: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Game detail endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/games/:gameId returns 404 when game does not exist', async () => {
    db.getGame.mockResolvedValue(null);

    const res = await request(app).get('/api/games/NOPE01');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/game not found/i);
  });

  test('GET /api/games/:gameId/players returns players for an existing game', async () => {
    const players = [
      { playerId: 'HOST1', username: 'host', isHost: true },
      { playerId: 'P2', username: 'guest', isHost: false },
    ];

    db.getGame.mockResolvedValue({
      gameId: 'ABC123',
      status: 'LOBBY',
    });
    db.getPlayersByGameId.mockResolvedValue(players);

    const res = await request(app).get('/api/games/ABC123/players');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ players });
    expect(db.getGame).toHaveBeenCalledWith('ABC123');
    expect(db.getPlayersByGameId).toHaveBeenCalledWith('ABC123');
  });
});
