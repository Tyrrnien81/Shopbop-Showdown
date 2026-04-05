const request = require('supertest');

jest.mock('../db', () => ({
  getGame: jest.fn(),
  getPlayer: jest.fn(),
  getOutfitsByGameId: jest.fn(),
  createVote: jest.fn().mockResolvedValue(undefined),
  updatePlayer: jest.fn().mockResolvedValue(undefined),
  getPlayersByGameId: jest.fn(),
}));

const db = require('../db');
const { app } = require('../server');

describe('POST /api/votes (star mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when ratings include the voter own outfit', async () => {
    db.getGame.mockResolvedValue({ gameId: 'G1', status: 'VOTING' });
    db.getPlayer.mockResolvedValue({
      playerId: 'p1',
      gameId: 'G1',
      hasVoted: false,
    });
    db.getOutfitsByGameId.mockResolvedValue([
      { outfitId: 'outfit-mine', playerId: 'p1' },
      { outfitId: 'outfit-other', playerId: 'p2' },
    ]);

    const res = await request(app)
      .post('/api/votes')
      .send({
        gameId: 'G1',
        playerId: 'p1',
        ratings: [
          { outfitId: 'outfit-other', rating: 5 },
          { outfitId: 'outfit-mine', rating: 3 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot vote on your own outfit/i);
    expect(db.createVote).not.toHaveBeenCalled();
    expect(db.updatePlayer).not.toHaveBeenCalled();
  });

  it('accepts votes when none target the voter outfits', async () => {
    db.getGame.mockResolvedValue({ gameId: 'G1', status: 'VOTING', votingMode: undefined });
    db.getPlayer.mockResolvedValue({
      playerId: 'p1',
      gameId: 'G1',
      hasVoted: false,
    });
    db.getOutfitsByGameId.mockResolvedValue([
      { outfitId: 'outfit-mine', playerId: 'p1' },
      { outfitId: 'outfit-other', playerId: 'p2' },
    ]);
    db.getPlayersByGameId.mockResolvedValue([
      { playerId: 'p1', hasVoted: true },
      { playerId: 'p2', hasVoted: false },
    ]);

    const res = await request(app)
      .post('/api/votes')
      .send({
        gameId: 'G1',
        playerId: 'p1',
        ratings: [{ outfitId: 'outfit-other', rating: 5 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(db.createVote).toHaveBeenCalledTimes(1);
    expect(db.updatePlayer).toHaveBeenCalledWith('p1', { hasVoted: true });
  });
});
