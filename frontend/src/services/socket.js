import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.gameId = null;
    this.playerId = null;
  }

  connect(gameId, playerId) {
    // Already connected to the same room — skip
    if (this.socket?.connected && this.gameId === gameId) {
      return this.socket;
    }

    // Disconnect existing connection if switching rooms
    if (this.socket) {
      this.disconnect();
    }

    this.gameId = gameId;
    this.playerId = playerId;

    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.socket.emit('join-room', { gameId: this.gameId, playerId: this.playerId });
    });

    this.socket.on('reconnect', () => {
      console.log('Socket reconnected — re-joining room');
      this.socket.emit('join-room', { gameId: this.gameId, playerId: this.playerId });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.gameId = null;
      this.playerId = null;
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;
