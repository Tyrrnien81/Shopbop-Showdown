# ShopBop Showdown - Frontend Development Plan

**CS 620 Capstone | Team: ShopBop Showdown | Spring 2026**

## 1. Project Overview

ShopBop Showdown is a real-time gamified fashion competition where 4-8 players compete to create the best themed outfit within budget and time constraints. This document outlines the frontend architecture and development plan designed to integrate with the backend team's AWS serverless architecture.

### Core User Flow
1. **Home** - Create or join a game
2. **Create Game** - Host sets theme, budget, time limit, and max players
3. **Lobby** - Players wait and ready up
4. **Game** - Players browse products and build outfits within time/budget
5. **Voting** - Players vote on anonymized outfits
6. **Results** - Winner revealed with full outfit details

---

## 2. Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React 18+ with Vite | Fast development, modern tooling |
| State Management | Zustand | Simpler than Redux, perfect for game state |
| Routing | React Router v6 | Standard routing solution |
| HTTP Client | Axios | Promise-based, interceptors for error handling |
| Styling | CSS (with CSS Variables) | No external dependencies, easy theming |
| Real-time (Phase 2) | WebSocket | Live game updates |

---

## 3. Project Structure

```
frontend/
├── public/
├── src/
│   ├── assets/
│   │   ├── images/
│   │   └── styles/
│   ├── components/
│   │   ├── common/        # Shared components (Button, Input, Card)
│   │   ├── game/          # Game phase components
│   │   ├── lobby/         # Lobby components
│   │   ├── outfit/        # Outfit builder components
│   │   ├── voting/        # Voting components
│   │   └── results/       # Results display components
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components (routes)
│   │   ├── Home.jsx
│   │   ├── CreateGame.jsx
│   │   ├── Lobby.jsx
│   │   ├── Game.jsx
│   │   ├── Voting.jsx
│   │   └── Results.jsx
│   ├── services/          # API service layer
│   │   └── api.js
│   ├── store/             # Zustand state management
│   │   └── gameStore.js
│   ├── utils/             # Utility functions
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── .env.example
├── package.json
└── vite.config.js
```

---

## 4. API Integration

### 4.1 Backend Endpoints (from Backend Plan)

#### Game Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/games` | Create new game |
| GET | `/games/{gameId}` | Get game details |
| POST | `/games/{gameId}/join` | Join existing game |
| POST | `/games/{gameId}/start` | Start game (host only) |
| GET | `/games/{gameId}/players` | List all players |

#### Outfit Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/outfits` | Submit outfit |
| GET | `/games/{gameId}/outfits` | Get all outfits for voting |

#### Voting
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/votes` | Cast vote |
| GET | `/games/{gameId}/results` | Get final results |

#### Shopbop Product API (Proxied)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products/search` | Search products |
| GET | `/products/{productSin}` | Get product details |
| GET | `/categories` | Get product categories |

### 4.2 API Service Layer

The `services/api.js` file provides a centralized API client with:
- Base URL configuration via environment variables
- Request/response interceptors for error handling
- Organized API methods by domain (game, outfit, vote, product)

---

## 5. State Management

### Zustand Store Structure

```javascript
{
  // Game State
  game: null,              // Current game object
  players: [],             // List of players in game
  currentPlayer: null,     // Current user's player object
  gameStatus: null,        // LOBBY | IN_PROGRESS | VOTING | COMPLETED

  // Outfit State
  currentOutfit: {
    products: [],          // Products in current outfit
    totalPrice: 0,         // Running total
  },

  // Voting State
  outfits: [],             // All outfits for voting (anonymized)
  results: [],             // Final ranked results
  hasVoted: false,         // Whether current user has voted

  // UI State
  isLoading: false,
  error: null,
}
```

---

## 6. Page Specifications

### 6.1 Home Page (`/`)
- **Purpose**: Entry point for creating or joining games
- **Components**: Logo, Create Game button, Join Game form
- **State**: Local state for form inputs

### 6.2 Create Game Page (`/create`)
- **Purpose**: Host configures game settings
- **Fields**:
  - Host username (text)
  - Theme (dropdown with preset options)
  - Budget ($50-$2000 range slider)
  - Max players (2-8 range slider)
  - Time limit (1-10 minutes range slider)
- **Validation**: All fields required, within specified ranges

### 6.3 Lobby Page (`/lobby/:gameId`)
- **Purpose**: Waiting room before game starts
- **Features**:
  - Display shareable game code
  - Show game settings (theme, budget, time)
  - Player list with ready status
  - Ready toggle button
  - Start game button (host only, requires all ready)
- **Polling**: Refresh player list every 2-3 seconds (Phase 1)

### 6.4 Game Page (`/game/:gameId`)
- **Purpose**: Main outfit building interface
- **Layout**: Two-column (outfit panel + product browser)
- **Features**:
  - Countdown timer (visual warning at 30s)
  - Budget tracker with progress bar
  - Product search with category filter
  - Add/remove products from outfit
  - Submit outfit button
  - Auto-submit on time expiry

### 6.5 Voting Page (`/voting/:gameId`)
- **Purpose**: Vote on submitted outfits
- **Features**:
  - Display all outfits anonymously
  - Click to select outfit
  - Submit vote button
  - Waiting screen after voting
- **Rules**: Cannot vote for own outfit

### 6.6 Results Page (`/results/:gameId`)
- **Purpose**: Display winner and all results
- **Features**:
  - Winner banner with trophy
  - Winner's full outfit with product details
  - Ranked list of all submissions
  - Share results button
  - Play again button

---

## 7. Implementation Phases

### Phase 1: MVP Foundation (Aligns with Backend Phase 1)

**Goal**: Working frontend with polling-based state updates

- [x] Project setup with Vite + React
- [x] Folder structure and routing
- [x] Zustand store setup
- [x] API service layer
- [x] All page components (basic)
- [x] CSS styling
- [ ] Connect to backend APIs
- [ ] Polling for game state updates
- [ ] Product search and display
- [ ] End-to-end testing

**Deliverable**: Playable game with 2-3 second latency for state updates

### Phase 2: Real-Time Features (Aligns with Backend Phase 2)

**Goal**: WebSocket integration for live updates

- [ ] WebSocket client setup
- [ ] Real-time game state sync
- [ ] Live timer synchronization
- [ ] Live vote count updates
- [ ] Connection status indicator
- [ ] Reconnection handling

**Deliverable**: Seamless real-time experience

### Phase 3: Polish (Aligns with Backend Phase 3)

**Goal**: Production-ready UX

- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Toast notifications
- [ ] Mobile responsive improvements
- [ ] Animations and transitions
- [ ] Accessibility (a11y) audit
- [ ] Performance optimization

### Phase 4: Demo Preparation

- [ ] Demo flow testing
- [ ] Edge case handling
- [ ] Offline fallback message
- [ ] Browser compatibility testing

---

## 8. Component Library (To Build)

### Common Components
- `Button` - Primary, secondary, small variants
- `Input` - Text, range slider
- `Card` - Container with shadow
- `Modal` - Overlay dialogs
- `Timer` - Countdown display
- `LoadingSpinner` - Loading indicator
- `ErrorMessage` - Error display

### Feature Components
- `ProductCard` - Product display with add button
- `OutfitItem` - Item in outfit panel
- `PlayerItem` - Player in lobby list
- `OutfitCard` - Outfit for voting display
- `ResultItem` - Ranked result display

---

## 9. Environment Configuration

```env
# .env.example
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_MOCK_DATA=true
```

For production:
```env
VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com/prod
VITE_USE_MOCK_DATA=false
```

---

## 10. Development Commands

```bash
# Install dependencies
cd frontend && npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 11. Integration Checklist

Before integrating with backend:

- [ ] Confirm API base URL
- [ ] Test CORS configuration
- [ ] Verify request/response formats match
- [ ] Test error response handling
- [ ] Confirm product image URLs work
- [ ] Test with 2+ concurrent players

---

## 12. Design References

- **Figma Prototype**: https://www.figma.com/make/RWUGQhyVSKv42Y8ibQWZB4/
- **Color Scheme**:
  - Primary: `#1a1a2e` (Dark blue)
  - Secondary: `#16213e` (Darker blue)
  - Accent: `#e94560` (Pink/Red)
  - Text: `#eaeaea` (Light gray)
  - Success: `#4ade80` (Green)
  - Warning: `#fbbf24` (Yellow)
  - Error: `#ef4444` (Red)

---

## 13. Known Limitations (Phase 1)

- No persistent user authentication
- Polling creates 2-3 second latency
- Single browser tab per player
- No offline support

---

## 14. Team Coordination

### Frontend Responsibilities
- UI/UX implementation
- State management
- API integration
- Client-side validation
- Error handling and display

### Backend Responsibilities
- API endpoints
- Data validation
- Game logic
- Product data proxying
- WebSocket server (Phase 2)

### Shared Responsibilities
- API contract definition
- Integration testing
- Bug fixes across stack

---

## 15. Resources

- **Backend Plan**: See `ShopBop_Backend_Plan.docx.pdf`
- **React Docs**: https://react.dev
- **Zustand Docs**: https://docs.pmnd.rs/zustand
- **Vite Docs**: https://vitejs.dev
- **Shopbop API Base**: https://api.shopbop.com
- **Client-Id**: Shopbop-UW-Team1-2024
