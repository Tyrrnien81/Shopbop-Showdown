const request = require('supertest');
const { app } = require('../server');

describe('GET /api/categories dept query', () => {
  it('returns womens categories by default', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories.some((c) => c.id === 'dresses')).toBe(true);
  });

  it('returns mens categories when dept=MENS', async () => {
    const res = await request(app).get('/api/categories').query({ dept: 'MENS' });
    expect(res.status).toBe(200);
    expect(res.body.categories.some((c) => c.id === 'suits')).toBe(true);
    expect(res.body.categories.some((c) => c.id === 'dresses')).toBe(false);
  });
});
