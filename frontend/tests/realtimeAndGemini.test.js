import { beforeEach, describe, expect, it, vi } from 'vitest';

function createSocket() {
  const handlers = {};
  return {
    id: 'socket-1',
    connected: false,
    on: vi.fn((event, callback) => {
      handlers[event] = callback;
    }),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    handlers,
  };
}

describe('socket service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('connects, joins a room on connect, and reuses the same room connection', async () => {
    const socket = createSocket();
    const io = vi.fn(() => socket);
    vi.doMock('socket.io-client', () => ({ io }));

    const { default: socketService } = await import('../src/services/socket.js');

    const first = socketService.connect('GAME01', 'P1');
    expect(first).toBe(socket);
    expect(io).toHaveBeenCalledWith('http://localhost:3000', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.connected = true;
    socket.handlers.connect();
    expect(socket.emit).toHaveBeenCalledWith('join-room', { gameId: 'GAME01', playerId: 'P1' });

    const second = socketService.connect('GAME01', 'P1');
    expect(second).toBe(socket);
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('disconnects an existing socket when switching rooms and proxies on/off handlers', async () => {
    const socketOne = createSocket();
    const socketTwo = createSocket();
    const io = vi.fn()
      .mockReturnValueOnce(socketOne)
      .mockReturnValueOnce(socketTwo);
    vi.doMock('socket.io-client', () => ({ io }));

    const { default: socketService } = await import('../src/services/socket.js');
    const callback = vi.fn();

    socketService.connect('GAME01', 'P1');
    socketService.on('player-joined', callback);
    socketService.off('player-joined', callback);
    socketService.connect('GAME02', 'P2');

    expect(socketOne.on).toHaveBeenCalledWith('player-joined', callback);
    expect(socketOne.off).toHaveBeenCalledWith('player-joined', callback);
    expect(socketOne.disconnect).toHaveBeenCalledTimes(1);
    expect(socketService.isConnected()).toBe(false);

    socketTwo.connected = true;
    expect(socketService.isConnected()).toBe(true);

    socketService.disconnect();
    expect(socketTwo.disconnect).toHaveBeenCalledTimes(1);
    expect(socketService.isConnected()).toBe(false);
  });
});

describe('Gemini try-on service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    globalThis.FileReader = class {
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,product-image';
        this.onloadend();
      }
    };
  });

  it('rejects try-on generation when no products are provided', async () => {
    const { generateTryOnImage, generateSingleTryOnImage } = await import('../src/services/geminiApi.js');

    await expect(generateTryOnImage([])).rejects.toThrow('No products provided for try-on');
    await expect(generateSingleTryOnImage(null)).rejects.toThrow('No products provided for try-on');
  });

  it('converts product images and posts batch try-on requests to the backend', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ blob: async () => new Blob(['image']) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: [{ imageData: 'generated', mimeType: 'image/png' }] }),
      });

    const { generateTryOnImage } = await import('../src/services/geminiApi.js');
    const images = await generateTryOnImage(
      [{ name: 'Dress', category: 'Dresses', brand: 'Brand A', imageUrl: 'https://img/dress.jpg' }],
      'data:image/png;base64,user'
    );

    expect(images).toEqual([{ imageData: 'generated', mimeType: 'image/png' }]);
    expect(fetch).toHaveBeenNthCalledWith(1, 'https://img/dress.jpg');
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/tryon/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const backendBody = JSON.parse(fetch.mock.calls[1][1].body);
    expect(backendBody).toEqual({
      products: [{ name: 'Dress', category: 'Dresses', brand: 'Brand A' }],
      productImages: [{ base64: 'product-image', mimeType: 'image/jpeg' }],
      count: 3,
      userPhoto: 'data:image/png;base64,user',
    });
  });

  it('posts single try-on requests with variation and surfaces backend errors', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ blob: async () => new Blob(['image']) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imageData: 'single', mimeType: 'image/png' }),
      })
      .mockResolvedValueOnce({ blob: async () => new Blob(['image']) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'try-on failed' }),
      });

    const { generateSingleTryOnImage } = await import('../src/services/geminiApi.js');
    const result = await generateSingleTryOnImage(
      [{ name: 'Boots', category: 'Shoes', brand: 'Brand B', imageUrl: 'https://img/boots.jpg' }],
      2
    );

    expect(result).toEqual({ imageData: 'single', mimeType: 'image/png' });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      products: [{ name: 'Boots', category: 'Shoes', brand: 'Brand B' }],
      productImages: [{ base64: 'product-image', mimeType: 'image/jpeg' }],
      variation: 2,
    });

    await expect(generateSingleTryOnImage([
      { name: 'Bag', category: 'Accessories', brand: 'Brand C', imageUrl: 'https://img/bag.jpg' },
    ])).rejects.toThrow('try-on failed');
  });
});
