const request = require('supertest');

const { app, _resetShopbopCache } = require('../server');

describe('GET /api/products/search', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    _resetShopbopCache();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns normalized products for a query search', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            productSin: '1547795609',
            shortDescription: 'Test Jeans',
            designerName: 'Test Brand',
            retailPrice: { usdPrice: 199.0 },
            colors: [{ images: [{ src: '/prod/products/test.jpg' }] }],
            categoryName: 'Jeans',
          },
        ],
        metadata: { totalCount: 1 },
      }),
    });

    const res = await request(app)
      .get('/api/products/search')
      .query({ query: 'jeans', page: 1, limit: 20, dept: 'WOMENS' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);

    const p = res.body.products[0];
    expect(p).toMatchObject({
      productSin: '1547795609',
      name: 'Test Jeans',
      brand: 'Test Brand',
    });
    expect(typeof p.price).toBe('number');
    expect(typeof p.imageUrl).toBe('string');
    expect(p.imageUrl.startsWith('http')).toBe(true);

    expect(res.body.page).toBe(1);
    expect(typeof res.body.totalPages).toBe('number');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(String(calledUrl)).toContain('https://api.shopbop.com/public/search');
  });

  it('returns 500 if the upstream Shopbop call fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream error',
    });

    const res = await request(app)
      .get('/api/products/search')
      .query({ query: 'jeans' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

