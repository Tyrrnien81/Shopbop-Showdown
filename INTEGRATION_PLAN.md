# Frontend-Backend Integration Plan

## Overview

This document outlines the unified interface between the React frontend and the backend API for ShopBop Showdown.

## Frontend Pages & Required APIs

| Page | URL | APIs Needed |
|------|-----|-------------|
| Home | `/` | None (static) |
| Create Game | `/create` | `POST /api/games` |
| Lobby | `/lobby/:gameId` | `GET /api/games/:id`, `POST /api/games/:id/join`, `WS: player-joined`, `WS: game-started` |
| Game | `/game/:gameId` | `GET /api/products/search`, `POST /api/outfits`, `WS: time-sync` |
| Voting | `/voting/:gameId` | `GET /api/games/:id/outfits`, `POST /api/votes`, `WS: voting-complete` |
| Results | `/results/:gameId` | `GET /api/games/:id/results` |

---

## REST API Endpoints

### Games

#### `POST /api/games` - Create Game
```json
// Request
{
  "hostUsername": "string",
  "theme": "runway" | "trend" | "ski" | "street" | "gala" | "beach",
  "budget": 5000,
  "maxPlayers": 4,
  "timeLimit": 300
}

// Response
{
  "game": {
    "gameId": "ABC123",
    "theme": "runway",
    "themeName": "Runway Ready",
    "budget": 5000,
    "maxPlayers": 4,
    "timeLimit": 300,
    "status": "LOBBY",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "player": {
    "playerId": "uuid",
    "username": "HostName",
    "isHost": true,
    "isReady": true
  },
  "token": "jwt-token-for-session"
}
```

#### `GET /api/games/:gameId` - Get Game Details
```json
// Response
{
  "gameId": "ABC123",
  "theme": "runway",
  "themeName": "Runway Ready",
  "budget": 5000,
  "maxPlayers": 4,
  "timeLimit": 300,
  "status": "LOBBY" | "PLAYING" | "VOTING" | "COMPLETED",
  "players": [...],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### `POST /api/games/:gameId/join` - Join Game
```json
// Request
{
  "username": "string"
}

// Response
{
  "player": {
    "playerId": "uuid",
    "username": "PlayerName",
    "isHost": false,
    "isReady": false
  },
  "game": { ... },
  "token": "jwt-token-for-session"
}
```

#### `POST /api/games/:gameId/ready` - Toggle Ready Status
```json
// Request
{
  "playerId": "uuid",
  "isReady": true
}

// Response
{
  "success": true,
  "player": { ... }
}
```

#### `POST /api/games/:gameId/start` - Start Game (Host Only)
```json
// Response
{
  "success": true,
  "game": {
    "status": "PLAYING",
    "startedAt": "2024-01-01T00:00:00Z",
    "endsAt": "2024-01-01T00:05:00Z"
  }
}
```

---

### Products (Shopbop Proxy)

#### `GET /api/products/search` - Search Products
```json
// Query Params
?query=dress&category=dresses&minPrice=100&maxPrice=500&page=1&limit=20

// Response
{
  "products": [
    {
      "productSin": "SHOP123456",
      "name": "Silk Evening Gown",
      "brand": "Marchesa",
      "category": "Dresses",
      "price": 1250.00,
      "imageUrl": "https://...",
      "productUrl": "https://shopbop.com/..."
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

#### `GET /api/products/:productSin` - Get Product Details
```json
// Response
{
  "productSin": "SHOP123456",
  "name": "Silk Evening Gown",
  "brand": "Marchesa",
  "category": "Dresses",
  "description": "...",
  "price": 1250.00,
  "images": ["url1", "url2"],
  "sizes": ["XS", "S", "M", "L"],
  "productUrl": "https://shopbop.com/..."
}
```

#### `GET /api/categories` - Get Categories
```json
// Response
{
  "categories": [
    { "id": "dresses", "name": "Dresses" },
    { "id": "tops", "name": "Tops" },
    { "id": "bottoms", "name": "Bottoms" },
    { "id": "shoes", "name": "Shoes" },
    { "id": "accessories", "name": "Accessories" },
    { "id": "bags", "name": "Bags" }
  ]
}
```

---

### Outfits

#### `POST /api/outfits` - Submit Outfit
```json
// Request
{
  "gameId": "ABC123",
  "playerId": "uuid",
  "products": [
    { "productSin": "SHOP123", "price": 500 },
    { "productSin": "SHOP456", "price": 300 }
  ],
  "totalPrice": 800
}

// Response
{
  "outfitId": "uuid",
  "submittedAt": "2024-01-01T00:04:30Z"
}
```

#### `GET /api/games/:gameId/outfits` - Get All Outfits (Anonymized for Voting)
```json
// Response
{
  "outfits": [
    {
      "outfitId": "uuid",
      "products": [
        {
          "productSin": "SHOP123",
          "name": "Silk Gown",
          "category": "Dresses",
          "price": 500,
          "imageUrl": "..."
        }
      ],
      "totalPrice": 800
      // Note: No player info during voting phase
    }
  ]
}
```

---

### Voting

#### `POST /api/votes` - Submit Votes
```json
// Request
{
  "gameId": "ABC123",
  "playerId": "uuid",
  "ratings": [
    { "outfitId": "uuid1", "rating": 5 },
    { "outfitId": "uuid2", "rating": 3 },
    { "outfitId": "uuid3", "rating": 4 }
  ]
}

// Response
{
  "success": true,
  "votesRemaining": 2  // Other players who haven't voted
}
```

#### `GET /api/games/:gameId/results` - Get Final Results
```json
// Response
{
  "results": [
    {
      "rank": 1,
      "outfitId": "uuid",
      "playerId": "uuid",
      "username": "FashionQueen",
      "score": 4.8,
      "totalVotes": 5,
      "products": [...],
      "totalPrice": 2425
    },
    ...
  ],
  "gameStats": {
    "totalPlayers": 4,
    "totalVotes": 12,
    "avgBudgetUsed": 3500
  }
}
```

---

## WebSocket Events

### Connection
```javascript
// Connect with auth token
const socket = io(WS_URL, {
  auth: { token: "jwt-token" },
  query: { gameId: "ABC123" }
});
```

### Events: Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ gameId }` | Join game room |
| `player-ready` | `{ playerId, isReady }` | Toggle ready status |
| `start-game` | `{ gameId }` | Host starts game |
| `submit-outfit` | `{ outfitId }` | Notify outfit submitted |
| `submit-vote` | `{ playerId }` | Notify vote submitted |

### Events: Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `player-joined` | `{ player }` | New player joined lobby |
| `player-left` | `{ playerId }` | Player disconnected |
| `player-ready-changed` | `{ playerId, isReady }` | Player ready status changed |
| `game-started` | `{ game, endsAt }` | Game has started |
| `time-sync` | `{ remainingSeconds }` | Timer synchronization |
| `player-submitted` | `{ playerId }` | Player submitted outfit |
| `all-submitted` | `{}` | All players submitted, start voting |
| `vote-received` | `{ votesRemaining }` | Vote count update |
| `voting-complete` | `{}` | All votes in, show results |
| `error` | `{ message }` | Error occurred |

---

## Data Models

### Game Status Flow
```
LOBBY → PLAYING → VOTING → COMPLETED
```

### TypeScript Interfaces (for reference)

```typescript
interface Game {
  gameId: string;
  theme: ThemeId;
  themeName: string;
  budget: number;
  maxPlayers: number;
  timeLimit: number;
  status: 'LOBBY' | 'PLAYING' | 'VOTING' | 'COMPLETED';
  players: Player[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

interface Player {
  playerId: string;
  username: string;
  isHost: boolean;
  isReady: boolean;
  hasSubmitted?: boolean;
  hasVoted?: boolean;
}

interface Product {
  productSin: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  imageUrl: string;
  productUrl?: string;
}

interface Outfit {
  outfitId: string;
  gameId: string;
  playerId: string;
  products: Product[];
  totalPrice: number;
  submittedAt: string;
}

interface Vote {
  voteId: string;
  gameId: string;
  voterId: string;
  outfitId: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

interface Result {
  rank: number;
  outfitId: string;
  playerId: string;
  username: string;
  score: number;
  totalVotes: number;
  products: Product[];
  totalPrice: number;
}

type ThemeId = 'runway' | 'trend' | 'ski' | 'street' | 'gala' | 'beach';
```

---

## Integration Steps

### Phase 1: Basic Game Flow
1. [ ] Backend: Implement `POST /api/games` (create game)
2. [ ] Backend: Implement `GET /api/games/:id` (get game)
3. [ ] Backend: Implement `POST /api/games/:id/join` (join game)
4. [ ] Frontend: Connect CreateGame to API
5. [ ] Frontend: Connect Lobby to API

### Phase 2: Real-time Updates
1. [ ] Backend: Set up WebSocket server (Socket.io)
2. [ ] Backend: Implement lobby events (join, ready, start)
3. [ ] Frontend: Add WebSocket service
4. [ ] Frontend: Update Lobby with real-time player list

### Phase 3: Shopbop Integration
1. [ ] Backend: Implement Shopbop API proxy
2. [ ] Backend: Implement product search/caching
3. [ ] Frontend: Connect Game page to product API
4. [ ] Frontend: Replace mock products with real data

### Phase 4: Game & Voting
1. [ ] Backend: Implement outfit submission
2. [ ] Backend: Implement voting system
3. [ ] Backend: Implement results calculation
4. [ ] Frontend: Connect Game → Voting → Results flow

### Phase 5: Polish
1. [ ] Add error handling throughout
2. [ ] Add loading states
3. [ ] Add reconnection logic for WebSocket
4. [ ] Add session persistence (localStorage)

---

## Environment Variables

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
```

### Backend (.env)
```
PORT=3000
DATABASE_URL=...
SHOPBOP_API_KEY=...
JWT_SECRET=...
```
