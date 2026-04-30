import { beforeEach, describe, expect, it, vi } from 'vitest';

function installSessionStorage(initial = {}) {
  const store = { ...initial };
  const sessionStorage = {
    getItem: vi.fn((key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
    setItem: vi.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
  };

  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorage,
    configurable: true,
  });

  return { sessionStorage, store };
}

async function loadStore(initialSession = {}) {
  vi.resetModules();
  installSessionStorage(initialSession);
  const { default: useGameStore } = await import('../src/store/gameStore.js');
  return useGameStore;
}

describe('game store state management', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('loads current player and outfit from session storage', async () => {
    const currentPlayer = { playerId: 'P1', username: 'alice' };
    const currentOutfit = { products: [{ productSin: 'A1', price: 100 }], totalPrice: 100 };

    const useGameStore = await loadStore({
      ss_currentPlayer: JSON.stringify(currentPlayer),
      ss_currentOutfit: JSON.stringify(currentOutfit),
    });

    expect(useGameStore.getState().currentPlayer).toEqual(currentPlayer);
    expect(useGameStore.getState().currentOutfit).toEqual(currentOutfit);
  });

  it('sets game, players, loading, errors, voting, tour, and user photo state', async () => {
    const useGameStore = await loadStore();

    useGameStore.getState().setGame({ gameId: 'GAME01', status: 'LOBBY', singlePlayer: true, budget: 300 });
    useGameStore.getState().setPlayers([{ playerId: 'P1' }]);
    useGameStore.getState().setOutfits([{ outfitId: 'O1' }]);
    useGameStore.getState().setResults([{ rank: 1 }]);
    useGameStore.getState().setHasVoted(true);
    useGameStore.getState().setLoading(true);
    useGameStore.getState().setError('Something went wrong');
    useGameStore.getState().startTour();
    useGameStore.getState().setUserPhoto('data:image/png;base64,photo');

    expect(useGameStore.getState()).toMatchObject({
      gameStatus: 'LOBBY',
      isSinglePlayer: true,
      players: [{ playerId: 'P1' }],
      outfits: [{ outfitId: 'O1' }],
      results: [{ rank: 1 }],
      hasVoted: true,
      isLoading: true,
      error: 'Something went wrong',
      tourActive: true,
      userPhoto: 'data:image/png;base64,photo',
    });

    useGameStore.getState().clearError();
    useGameStore.getState().endTour();
    useGameStore.getState().updateGameStatus('PLAYING');

    expect(useGameStore.getState().error).toBeNull();
    expect(useGameStore.getState().tourActive).toBe(false);
    expect(useGameStore.getState().gameStatus).toBe('PLAYING');
  });

  it('adds, removes, clears, and persists outfit products', async () => {
    const useGameStore = await loadStore();
    const product = { productSin: 'A1', name: 'Dress', price: 120 };

    const added = useGameStore.getState().addProductToOutfit(product);

    expect(added).toBe(true);
    expect(useGameStore.getState().currentOutfit).toEqual({
      products: [product],
      totalPrice: 120,
    });
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'ss_currentOutfit',
      JSON.stringify({ products: [product], totalPrice: 120 })
    );

    useGameStore.getState().removeProductFromOutfit('A1');
    expect(useGameStore.getState().currentOutfit).toEqual({ products: [], totalPrice: 0 });

    useGameStore.getState().addProductToOutfit(product);
    useGameStore.getState().clearOutfit();
    expect(useGameStore.getState().currentOutfit).toEqual({ products: [], totalPrice: 0 });
  });

  it('rejects outfit additions over item limit or budget', async () => {
    const useGameStore = await loadStore();

    useGameStore.setState({
      currentOutfit: {
        products: Array.from({ length: 5 }, (_, index) => ({ productSin: `P${index}`, price: 10 })),
        totalPrice: 50,
      },
    });

    expect(useGameStore.getState().addProductToOutfit({ productSin: 'P6', price: 10 })).toBe(false);
    expect(useGameStore.getState().error).toBe('You can only add up to 5 items!');

    useGameStore.setState({
      game: { budget: 100 },
      currentOutfit: { products: [], totalPrice: 90 },
      error: null,
    });

    expect(useGameStore.getState().addProductToOutfit({ productSin: 'EXP', price: 20 })).toBe(false);
    expect(useGameStore.getState().error).toBe('Adding this item would exceed your budget!');
  });

  it('persists current player and fully resets game state', async () => {
    const useGameStore = await loadStore();
    const player = { playerId: 'P1', username: 'alice' };

    useGameStore.getState().setCurrentPlayer(player);
    expect(useGameStore.getState().currentPlayer).toEqual(player);
    expect(sessionStorage.setItem).toHaveBeenCalledWith('ss_currentPlayer', JSON.stringify(player));

    useGameStore.setState({
      game: { gameId: 'GAME01' },
      players: [{ playerId: 'P1' }],
      gameStatus: 'COMPLETED',
      currentOutfit: { products: [{ productSin: 'A1', price: 1 }], totalPrice: 1 },
      userPhoto: 'photo',
      outfits: [{ outfitId: 'O1' }],
      results: [{ rank: 1 }],
      hasVoted: true,
      isLoading: true,
      error: 'error',
    });

    useGameStore.getState().resetGame();

    expect(sessionStorage.removeItem).toHaveBeenCalledWith('ss_currentPlayer');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('ss_currentOutfit');
    expect(useGameStore.getState()).toMatchObject({
      game: null,
      players: [],
      currentPlayer: null,
      gameStatus: null,
      isSinglePlayer: false,
      currentOutfit: { products: [], totalPrice: 0 },
      userPhoto: null,
      outfits: [],
      results: [],
      hasVoted: false,
      isLoading: false,
      error: null,
    });
  });
});
