const request = require('supertest');

jest.mock('../db', () => ({
  createGame: jest.fn().mockResolvedValue(undefined),
  createPlayer: jest.fn().mockResolvedValue(undefined),
}));

const db = require('../db');
const { app } = require('../server');

describe('POST /api/games', () => {
  it('creates a game with valid input', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({
        hostUsername: 'alice',
        theme: 'runway',
        budget: 2500,
        maxPlayers: 4,
        timeLimit: 300,
        singlePlayer: false,
      });

    expect(res.status).toBe(201);

    expect(res.body).toHaveProperty('game');
    expect(res.body).toHaveProperty('player');

    expect(res.body.game).toHaveProperty('gameId');
    expect(typeof res.body.game.gameId).toBe('string');
    expect(res.body.game.gameId).toHaveLength(6);

    expect(res.body.game.status).toBe('LOBBY');
    expect(res.body.player.isHost).toBe(true);
    expect(res.body.player.isReady).toBe(true);
    expect(res.body.player.gameId).toBe(res.body.game.gameId);

    expect(db.createGame).toHaveBeenCalledTimes(1);
    expect(db.createPlayer).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ theme: 'runway' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });
});

