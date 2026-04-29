const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  updateGameStatus: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Theme vote endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST and GET /api/games/:gameId/theme-vote handle an active theme vote', async () => {
    jest.useFakeTimers();

    db.getGame.mockResolvedValue({
      gameId: 'ABC123',
      status: 'LOBBY',
      timeLimit: 300,
      playerIds: ['P1', 'P2'],
      singlePlayer: false,
      themeMode: 'vote',
    });
    db.updateGameStatus.mockImplementation(async (gameId, status, attrs = {}) => ({
      gameId,
      status,
      ...attrs,
    }));

    const startRes = await request(app)
      .post('/api/games/ABC123/start')
      .send({});

    expect(startRes.status).toBe(200);
    expect(startRes.body.game.status).toBe('THEME_VOTING');
    expect(startRes.body.themeOptions).toHaveLength(3);

    const getRes = await request(app).get('/api/games/ABC123/theme-vote');

    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({
      voteCount: 0,
      totalPlayers: 2,
    });
    expect(getRes.body.options).toHaveLength(3);

    const themeId = getRes.body.options[0].id;
    const voteRes = await request(app)
      .post('/api/games/ABC123/theme-vote')
      .send({ playerId: 'P1', themeId });

    expect(voteRes.status).toBe(200);
    expect(voteRes.body).toEqual({
      success: true,
      voteCount: 1,
      totalPlayers: 2,
    });

    const finalizeRes = await request(app)
      .post('/api/games/ABC123/theme-vote')
      .send({ playerId: 'P2', themeId });

    expect(finalizeRes.status).toBe(200);
    expect(db.updateGameStatus).toHaveBeenCalledWith(
      'ABC123',
      'PLAYING',
      expect.objectContaining({
        theme: themeId,
        startedAt: expect.any(String),
        endsAt: expect.any(String),
      })
    );

    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('GET /api/games/:gameId/theme-vote returns 404 when no vote is active', async () => {
    const res = await request(app).get('/api/games/NOPE12/theme-vote');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no active theme vote/i);
  });
});
