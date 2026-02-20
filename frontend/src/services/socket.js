import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

class SocketService {
  constructor() {
    this.socket = null;
    this.gameId = null;
  }

  // Connect to WebSocket server
  connect(token, gameId) {
    if (this.socket?.connected) {
      this.disconnect();
    }

    this.gameId = gameId;
    this.socket = io(WS_URL, {
      auth: { token },
      query: { gameId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.socket.emit('join-room', { gameId });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return this.socket;
  }

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.gameId = null;
    }
  }

  // Subscribe to events
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Unsubscribe from events
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Emit events
  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // Lobby events
  setReady(playerId, isReady) {
    this.emit('player-ready', { playerId, isReady });
  }

  startGame(gameId) {
    this.emit('start-game', { gameId });
  }

  // Game events
  notifyOutfitSubmitted(outfitId) {
    this.emit('submit-outfit', { outfitId });
  }

  // Voting events
  notifyVoteSubmitted(playerId) {
    this.emit('submit-vote', { playerId });
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;
