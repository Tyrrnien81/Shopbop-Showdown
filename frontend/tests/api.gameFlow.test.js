import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * These tests live in frontend/tests to show how you can
 * keep adding more API-layer tests without touching src/.
 *
 * Pattern:
 *  - Mock axios.create to return a fake instance.
 *  - Import the service module (which builds gameApi, productApi, etc.).
 *  - Call the wrapper and assert the axios instance was called correctly.
 */

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

describe('Game-related API wrappers (integration-style)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('readyToggle calls POST /games/:gameId/ready with body', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { gameApi } = await import('../src/services/api.js');

    const body = { playerId: 'player-1', isReady: true };
    gameApi.readyToggle('GAME123', body);

    expect(axiosInstance.post).toHaveBeenCalledWith('/games/GAME123/ready', body);
  });

  it('outfitApi.submitOutfit calls POST /outfits with full payload', async () => {
    const axiosInstance = createAxiosMock();

    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    const { outfitApi } = await import('../src/services/api.js');

    const payload = {
      gameId: 'GAME123',
      playerId: 'player-1',
      products: [],
      totalPrice: 0,
    };

    outfitApi.submitOutfit(payload);

    expect(axiosInstance.post).toHaveBeenCalledWith('/outfits', payload);
  });
});

