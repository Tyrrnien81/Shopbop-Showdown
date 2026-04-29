import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAxiosMock = () => ({
  get: vi.fn(),
  post: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
});

async function loadApiWithAxios(axiosInstance = createAxiosMock()) {
  vi.resetModules();
  vi.doMock('axios', () => ({
    default: {
      create: vi.fn(() => axiosInstance),
    },
  }));

  const apiModule = await import('../src/services/api.js');
  return { ...apiModule, axiosInstance };
}

describe('frontend API endpoint wrappers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('configures the shared axios client and interceptors', async () => {
    const axiosInstance = createAxiosMock();
    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => axiosInstance),
      },
    }));

    await import('../src/services/api.js');
    const axios = await import('axios');

    expect(axios.default.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3000/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(axiosInstance.interceptors.request.use).toHaveBeenCalledTimes(1);
    expect(axiosInstance.interceptors.response.use).toHaveBeenCalledTimes(1);
  });

  it('maps all game API wrappers to backend routes', async () => {
    const { gameApi, axiosInstance } = await loadApiWithAxios();

    const body = { playerId: 'P1', isReady: true };
    gameApi.createGame({ hostUsername: 'alice' });
    gameApi.getGame('GAME01');
    gameApi.joinGame('GAME01', { username: 'bob' });
    gameApi.readyToggle('GAME01', body);
    gameApi.startGame('GAME01');
    gameApi.getPlayers('GAME01');
    gameApi.voteTheme('GAME01', { playerId: 'P1', themeId: 'runway' });
    gameApi.getThemeVote('GAME01');
    gameApi.getPublicGames();

    expect(axiosInstance.post).toHaveBeenCalledWith('/games', { hostUsername: 'alice' });
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/GAME01');
    expect(axiosInstance.post).toHaveBeenCalledWith('/games/GAME01/join', { username: 'bob' });
    expect(axiosInstance.post).toHaveBeenCalledWith('/games/GAME01/ready', body);
    expect(axiosInstance.post).toHaveBeenCalledWith('/games/GAME01/start');
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/GAME01/players');
    expect(axiosInstance.post).toHaveBeenCalledWith('/games/GAME01/theme-vote', { playerId: 'P1', themeId: 'runway' });
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/GAME01/theme-vote');
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/public');
  });

  it('maps outfit and vote API wrappers to backend routes', async () => {
    const { outfitApi, voteApi, axiosInstance } = await loadApiWithAxios();

    const outfit = { gameId: 'GAME01', playerId: 'P1', products: [], totalPrice: 0 };
    const vote = { gameId: 'GAME01', playerId: 'P1', ratings: [{ outfitId: 'O2', rating: 5 }] };

    outfitApi.submitOutfit(outfit);
    outfitApi.getOutfits('GAME01');
    voteApi.castVote(vote);
    voteApi.getResults('GAME01');

    expect(axiosInstance.post).toHaveBeenCalledWith('/outfits', outfit);
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/GAME01/outfits');
    expect(axiosInstance.post).toHaveBeenCalledWith('/votes', vote);
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/GAME01/results');
  });

  it('maps product and public history API wrappers to backend routes', async () => {
    const { productApi, historyApi, axiosInstance } = await loadApiWithAxios();

    const params = { query: 'dress', page: 2, limit: 12 };
    productApi.searchProducts(params);
    productApi.getProduct('SIN123');
    productApi.getCategories();
    historyApi.getHistory();
    historyApi.getPopularProducts();
    historyApi.getPopularProducts(24);

    expect(axiosInstance.get).toHaveBeenCalledWith('/products/search', { params });
    expect(axiosInstance.get).toHaveBeenCalledWith('/products/SIN123');
    expect(axiosInstance.get).toHaveBeenCalledWith('/categories');
    expect(axiosInstance.get).toHaveBeenCalledWith('/games/history');
    expect(axiosInstance.get).toHaveBeenCalledWith('/popular-products', { params: { limit: 12 } });
    expect(axiosInstance.get).toHaveBeenCalledWith('/popular-products', { params: { limit: 24 } });
  });

  it('maps chat and avatar API wrappers to backend routes', async () => {
    const { chatApi, avatarApi, axiosInstance } = await loadApiWithAxios();

    const message = { message: 'show black boots', history: [] };
    const descriptors = { height: '5 feet 7 inches', topSize: 'M' };
    chatApi.sendMessage(message);
    avatarApi.generate(descriptors);

    expect(axiosInstance.post).toHaveBeenCalledWith('/chat/message', message);
    expect(axiosInstance.post).toHaveBeenCalledWith('/avatar/generate', descriptors, { timeout: 60000 });
  });
});
