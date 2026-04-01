const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getPlayer: jest.fn(),
  updatePlayer: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Game ready endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
