const request = require('supertest');

const mockGetGame = jest.fn();
const mockGetPlayersByGameId = jest.fn();

jest.mock('../db', () => ({
  getGame: (...args) => mockGetGame(...args),
  createPlayer: jest.fn().mockResolvedValue(undefined),
  appendPlayerId: jest.fn().mockResolvedValue(undefined),
  getPlayersByGameId: (...args) => mockGetPlayersByGameId(...args),
}));

const db = require('../db');
const { app } = require('../server');

describe('GET /api/health', () => {
  it('returns ok status and port', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(res.body).toHaveProperty('port');
    expect(typeof res.body.port).toBe('number');
  });
});

describe('POST /api/games/:gameId/join', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when game does not exist', async () => {
    mockGetGame.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/games/NOPE12/join')
      .send({ username: 'bob' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Game not found' });
    expect(db.createPlayer).not.toHaveBeenCalled();
  });

  it('creates a player and returns game payload when lobby has space', async () => {
    const gameId = 'ABC123';

    mockGetGame
      .mockResolvedValueOnce({
        gameId,
        status: 'LOBBY',
        maxPlayers: 4,
        playerIds: ['host-player-id'],
        timeLimit: 300,
      })
      .mockResolvedValueOnce({
        gameId,
        status: 'LOBBY',
        maxPlayers: 4,
        playerIds: ['host-player-id'],
      });

    mockGetPlayersByGameId.mockImplementation(async () => {
      const created = db.createPlayer.mock.calls[0]?.[0];
      return [
        { playerId: 'host-player-id', username: 'alice', isHost: true },
        ...(created ? [created] : []),
      ];
    });

    const res = await request(app)
      .post(`/api/games/${gameId}/join`)
      .send({ username: 'bob' });

    expect(res.status).toBe(200);
    expect(res.body.player).toMatchObject({
      username: 'bob',
      isHost: false,
      isReady: false,
      gameId,
    });
    expect(res.body.player).toHaveProperty('playerId');
    expect(db.createPlayer).toHaveBeenCalledTimes(1);
    expect(db.appendPlayerId).toHaveBeenCalledWith(gameId, res.body.player.playerId);
  });
});
