const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getPlayersByGameId: jest.fn(),
  createPlayer: jest.fn(),
  appendPlayerId: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Game join endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/games/:gameId/join returns 400 when username is missing', async () => {
    db.getGame.mockResolvedValue({
      gameId: 'ABC123',
      status: 'LOBBY',
      playerIds: ['HOST1'],
      maxPlayers: 4,
    });
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'HOST1', isAudience: false },
    ]);

    const res = await request(app)
      .post('/api/games/ABC123/join')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username is required/i);
    expect(db.createPlayer).not.toHaveBeenCalled();
    expect(db.appendPlayerId).not.toHaveBeenCalled();
  });

  test('POST /api/games/:gameId/join returns 400 when game is full', async () => {
    db.getGame.mockResolvedValue({
      gameId: 'ABC123',
      status: 'LOBBY',
      playerIds: ['HOST1', 'P2'],
      maxPlayers: 2,
    });
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'HOST1', isAudience: false },
      { playerId: 'P2', isAudience: false },
    ]);

    const res = await request(app)
      .post('/api/games/ABC123/join')
      .send({ username: 'latePlayer' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/game is full/i);
    expect(db.createPlayer).not.toHaveBeenCalled();
    expect(db.appendPlayerId).not.toHaveBeenCalled();
  });
});
