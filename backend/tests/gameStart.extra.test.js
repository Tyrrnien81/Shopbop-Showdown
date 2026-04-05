const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  updateGameStatus: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Game start endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/games/:gameId/start moves game to PLAYING and sets timer fields', async () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const endsAt = new Date('2026-01-01T00:05:00.000Z').toISOString();

    db.getGame.mockResolvedValue({
      gameId: 'ABC123',
      status: 'LOBBY',
      timeLimit: 300,
      singlePlayer: true,
    });
    db.updateGameStatus.mockResolvedValue({
      gameId: 'ABC123',
      status: 'PLAYING',
      startedAt,
      endsAt,
    });

    const res = await request(app)
      .post('/api/games/ABC123/start')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.game.status).toBe('PLAYING');
    expect(db.updateGameStatus).toHaveBeenCalledWith(
      'ABC123',
      'PLAYING',
      expect.objectContaining({
        startedAt: expect.any(String),
        endsAt: expect.any(String),
      })
    );
  });
});
