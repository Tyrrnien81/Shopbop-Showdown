const request = require('supertest');

process.env.GEMINI_API_KEY = 'test-key';

const { app } = require('../server');

describe('AI assistant and generation endpoints', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  test('POST /api/chat/message returns a reply and searched products', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Try a sharp black blazer with silver heels.' }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'black blazer' }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            {
              productSin: 'BLAZER1',
              shortDescription: 'Black Blazer',
              designerName: 'Test Brand',
              retailPrice: { usdPrice: 295 },
              colors: [{ images: [{ src: '/prod/products/blazer.jpg' }] }],
              categoryName: 'Jackets',
            },
          ],
          metadata: { totalCount: 1 },
        }),
      });

    const res = await request(app)
      .post('/api/chat/message')
      .send({ message: 'What should I add?', theme: 'gala', budget: 500 });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Try a sharp black blazer with silver heels.');
    expect(res.body.products).toEqual([
      expect.objectContaining({
        productSin: 'BLAZER1',
        name: 'Black Blazer',
      }),
    ]);
  });

  test('POST /api/tryon/generate returns generated images', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { data: 'image-data', mimeType: 'image/png' } }] } }],
      }),
    });

    const res = await request(app)
      .post('/api/tryon/generate')
      .send({
        count: 2,
        products: [{ name: 'Dress', category: 'Dresses', brand: 'Brand A' }],
        productImages: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.images).toEqual([
      { imageData: 'image-data', mimeType: 'image/png' },
      { imageData: 'image-data', mimeType: 'image/png' },
    ]);
  });

  test('POST /api/tryon/generate-single returns one generated image', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { data: 'single-image', mimeType: 'image/png' } }] } }],
      }),
    });

    const res = await request(app)
      .post('/api/tryon/generate-single')
      .send({
        products: [{ name: 'Boots', category: 'Shoes', brand: 'Brand B' }],
        productImages: [],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imageData: 'single-image', mimeType: 'image/png' });
  });

  test('POST /api/avatar/generate returns generated avatar image data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { data: 'avatar-image', mimeType: 'image/png' } }] } }],
      }),
    });

    const res = await request(app)
      .post('/api/avatar/generate')
      .send({ ethnicity: 'Latina', height: '5 feet 6 inches', topSize: 'M', gender: 'woman' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ base64: 'avatar-image', mimeType: 'image/png' });
  });
});
