const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getPlayer: jest.fn(),
  getOutfitsByGameId: jest.fn(),
  createVote: jest.fn(),
  updatePlayer: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('Vote endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/votes returns 400 when ratings array is missing', async () => {
    db.getGame.mockResolvedValue({ gameId: 'ABC123' });
    db.getPlayer.mockResolvedValue({
      playerId: 'P1',
      gameId: 'ABC123',
      hasVoted: false,
    });
    db.getOutfitsByGameId.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/votes')
      .send({ gameId: 'ABC123', playerId: 'P1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ratings array is required/i);
    expect(db.createVote).not.toHaveBeenCalled();
    expect(db.updatePlayer).not.toHaveBeenCalled();
  });
});
