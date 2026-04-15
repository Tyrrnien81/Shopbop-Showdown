import { describe, it, expect, vi, beforeEach } from 'vitest';

const createAxiosMock = () => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return instance;
};

describe('API layer wrappers (src/services/api.js)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('gameApi.createGame calls POST /games with body', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { gameApi } = await import('./api.js');

    const payload = { hostUsername: 'alice', theme: 'runway' };
    gameApi.createGame(payload);

    expect(axiosInstance.post).toHaveBeenCalledWith('/games', payload);
  });

  it('gameApi.joinGame calls POST /games/:gameId/join', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { gameApi } = await import('./api.js');

    gameApi.joinGame('ABC123', { username: 'bob' });
    expect(axiosInstance.post).toHaveBeenCalledWith('/games/ABC123/join', { username: 'bob' });
  });

  it('productApi.searchProducts calls GET /products/search with params wrapper', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { productApi } = await import('./api.js');

    const params = { query: 'jeans', page: 1, limit: 20 };
    productApi.searchProducts(params);

    expect(axiosInstance.get).toHaveBeenCalledWith('/products/search', { params });
  });

  it('voteApi.getResults calls GET /games/:gameId/results', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { voteApi } = await import('./api.js');

    voteApi.getResults('GAME01');
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/GAME01/results');
  });

  it('historyApi.getHistory calls GET /games/history', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { historyApi } = await import('./api.js');

    historyApi.getHistory();
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/history');
  });

  it('historyApi.getPopularProducts calls GET /popular-products with default limit', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { historyApi } = await import('./api.js');

    historyApi.getPopularProducts();
    expect(axiosInstance.get).toHaveBeenCalledWith('/popular-products', { params: { limit: 12 } });
  });

  it('historyApi.getPopularProducts calls GET /popular-products with custom limit', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { historyApi } = await import('./api.js');

    historyApi.getPopularProducts(24);
    expect(axiosInstance.get).toHaveBeenCalledWith('/popular-products', { params: { limit: 24 } });
  });
});

