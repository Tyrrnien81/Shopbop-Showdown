import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // Game State
  game: null,
  players: [],
  currentPlayer: null,
  gameStatus: null, // LOBBY | IN_PROGRESS | VOTING | COMPLETED
  isSinglePlayer: false,

  // Outfit State
  currentOutfit: {
    products: [],
    totalPrice: 0,
  },

  // Voting State
  outfits: [],
  results: [],
  hasVoted: false,

  // User Photo (base64 data URL for personalized try-on)
  userPhoto: null,

  // Tour State
  tourActive: false,

  // Loading/Error States
  isLoading: false,
  error: null,

  // Game Actions
  setGame: (game) => set({ game, gameStatus: game?.status, isSinglePlayer: Boolean(game?.singlePlayer) }),

  setPlayers: (players) => set({ players }),

  setCurrentPlayer: (player) => set({ currentPlayer: player }),

  updateGameStatus: (status) => set({ gameStatus: status }),

  // Outfit Actions
  addProductToOutfit: (product) => {
    const { currentOutfit, game } = get();

    // Check item limit
    if (currentOutfit.products.length >= 5) {
      set({ error: 'You can only add up to 5 items!' });
      return false;
    }

    const newTotal = currentOutfit.totalPrice + product.price;

    // Check budget constraint
    if (game && newTotal > game.budget) {
      set({ error: 'Adding this item would exceed your budget!' });
      return false;
    }

    set({
      currentOutfit: {
        products: [...currentOutfit.products, product],
        totalPrice: newTotal,
      },
      error: null,
    });
    return true;
  },

  removeProductFromOutfit: (productId) => {
    const { currentOutfit } = get();
    const product = currentOutfit.products.find((p) => p.productSin === productId);

    if (product) {
      set({
        currentOutfit: {
          products: currentOutfit.products.filter((p) => p.productSin !== productId),
          totalPrice: currentOutfit.totalPrice - product.price,
        },
      });
    }
  },

  clearOutfit: () => set({
    currentOutfit: { products: [], totalPrice: 0 },
  }),

  // Voting Actions
  setOutfits: (outfits) => set({ outfits }),

  setResults: (results) => set({ results }),

  setHasVoted: (hasVoted) => set({ hasVoted }),

  // Utility Actions
  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  // Tour Actions
  startTour: () => set({ tourActive: true }),
  endTour: () => set({ tourActive: false }),

  // User Photo Actions
  setUserPhoto: (userPhoto) => set({ userPhoto }),

  // Reset store
  resetGame: () => set({
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
  }),
}));

export default useGameStore;
