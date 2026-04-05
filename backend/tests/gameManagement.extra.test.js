const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getPlayersByGameId: jest.fn(),
  createPlayer: jest.fn(),
  appendPlayerId: jest.fn(),
  getPlayer: jest.fn(),
  updatePlayer: jest.fn(),
  updateGameStatus: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Game management API extra coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/games/:gameId returns 404 when game does not exist', async () => {
    db.getGame.mockResolvedValue(null);

    const res = await request(app).get('/api/games/NOPE01');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/game not found/i);
  });

  test('POST /api/games/:gameId/join returns 400 when username is missing', async () => {
    db.getGame.mockResolvedValue({
      gameId: 'ABC123',
      status: 'LOBBY',
      playerIds: ['HOST1'],
      maxPlayers: 4,
    });

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

    const res = await request(app)
      .post('/api/games/ABC123/join')
      .send({ username: 'latePlayer' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/game is full/i);
    expect(db.createPlayer).not.toHaveBeenCalled();
    expect(db.appendPlayerId).not.toHaveBeenCalled();
  });

  test('POST /api/games/:gameId/ready returns 404 when player is not in game', async () => {
    db.getGame.mockResolvedValue({ gameId: 'ABC123' });
    db.getPlayer.mockResolvedValue({ playerId: 'P2', gameId: 'DIFFERENT' });

    const res = await request(app)
      .post('/api/games/ABC123/ready')
      .send({ playerId: 'P2', isReady: true });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/player not found in this game/i);
    expect(db.updatePlayer).not.toHaveBeenCalled();
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
