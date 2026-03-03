import axios from 'axios';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth tokens (future use)
api.interceptors.request.use(
  (config) => {
    // Add any request modifications here
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Game Management APIs
export const gameApi = {
  createGame: (gameData) => api.post('/games', gameData),
  getGame: (gameId) => api.get(`/games/${gameId}`),
  joinGame: (gameId, playerData) => api.post(`/games/${gameId}/join`, playerData),
  readyToggle: (gameId, playerData) => api.post(`/games/${gameId}/ready`, playerData),
  startGame: (gameId) => api.post(`/games/${gameId}/start`),
  getPlayers: (gameId) => api.get(`/games/${gameId}/players`),
};

// Outfit Management APIs
export const outfitApi = {
  submitOutfit: (outfitData) => api.post('/outfits', outfitData),
  getOutfits: (gameId) => api.get(`/games/${gameId}/outfits`),
};

// Voting APIs
export const voteApi = {
  castVote: (voteData) => api.post('/votes', voteData),
  getResults: (gameId) => api.get(`/games/${gameId}/results`),
};

// Shopbop Product APIs (proxied through backend)
export const productApi = {
  searchProducts: (params) => api.get('/products/search', { params }),
  getProduct: (productSin) => api.get(`/products/${productSin}`),
  getCategories: () => api.get('/categories'),
};

// Chat Assistant API
export const chatApi = {
  sendMessage: (data) => api.post('/chat/message', data),
};

export default api;
