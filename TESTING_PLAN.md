# ShopBop Showdown — Testing Plan

**CS 620 Capstone | Team: ShopBop Showdown | Spring 2026**

## 1. Goals

Our testing goals are to ensure:
- **Correctness**: the core game loop works end-to-end (Create → Join → Lobby → Game → Voting → Results).
- **Reliability**: the system handles real-world failures (network issues, rate limits, missing data).
- **Fairness & rules enforcement**: budgets, time limits, anonymity in voting, and “no voting for yourself”.
- **Performance**: acceptable latency with polling (Phase 1) and smooth real-time behavior with WebSockets (Phase 2).
- **Regression safety**: changes do not break the main flow.

This plan aligns with the frontend architecture and flows described in the Frontend Development Plan and Integration Plan.  
Refs: core flow + pages :contentReference[oaicite:2]{index=2}, REST + WS contract :contentReference[oaicite:3]{index=3}

---

## 2. Scope

### In Scope
- Frontend unit tests for core components and store logic (Zustand state).
- Frontend integration tests for page flows (routing + API layer).
- Backend endpoint tests for REST APIs (games, products proxy, outfits, votes, results).
- WebSocket event tests (Phase 2).
- End-to-end tests for the complete multiplayer flow.
- Non-functional testing: error handling, performance, and basic security checks.

### Out of Scope (for capstone MVP)
- Formal penetration testing
- Full accessibility certification (we will do a lightweight a11y audit)
- Load testing at enterprise scale (we will do small-scale concurrent user tests)

---

## 3. Test Environments

### Local Development (Primary)
- Frontend runs with Vite.
- Backend runs locally with dev configuration.
- Shopbop API calls proxied through backend endpoints.

### Staging / Demo Environment
- Deployed backend (API gateway / server) with demo configuration.
- Frontend hosted for demo.
- Use realistic but non-sensitive environment variables.

### Test Data / Fixtures
- Seeded games/players/outfits/votes for repeatable tests.
- Mock Shopbop responses for consistent product search tests.

---

## 4. Test Types & Tooling

### 4.1 Frontend Unit Tests
**What:** Zustand store updates, utility functions, and component behavior.  
**Where:** `src/store`, `src/utils`, `src/components/*`  
**Examples:**
- Budget tracker correctly sums prices.
- Timer component renders correct remaining time.
- Outfit panel add/remove updates total price.

**Recommended Tools:**
- Vitest + React Testing Library
- MSW (Mock Service Worker) for API mocking (optional but helpful)

### 4.2 Frontend Integration Tests (Page-level)
**What:** Pages call the right APIs and update state/UI.  
**Where:** `src/pages/*`  
**Examples:**
- Create Game page sends `POST /api/games` and routes to Lobby.
- Lobby polling updates players and ready status.
- Game page search triggers `/api/products/search` and renders results.

### 4.3 Backend API Tests
**What:** REST endpoints validate inputs, enforce rules, and return expected shapes.  
**Endpoints to test (per integration plan):**
- `POST /api/games`
- `GET /api/games/:gameId`
- `POST /api/games/:gameId/join`
- `POST /api/games/:gameId/ready`
- `POST /api/games/:gameId/start`
- `GET /api/products/search`
- `GET /api/products/:productSin`
- `GET /api/categories`
- `POST /api/outfits`
- `GET /api/games/:gameId/outfits`
- `POST /api/votes`
- `GET /api/games/:gameId/results`
Refs: endpoint list and payload shapes :contentReference[oaicite:4]{index=4}

**Recommended Tools:**
- Jest (or Vitest) + supertest (if Node/Express)
- Contract checks to match response schemas in `INTEGRATION_PLAN.md`

### 4.4 WebSocket Tests (Phase 2)
**What:** Client/server events are emitted and received correctly.  
**Events to test (per integration plan):**
- Client → Server: `join-room`, `player-ready`, `start-game`, `submit-outfit`, `submit-vote`
- Server → Client: `player-joined`, `player-left`, `player-ready-changed`, `game-started`, `time-sync`, `player-submitted`, `all-submitted`, `vote-received`, `voting-complete`, `error`
Refs: WS event list :contentReference[oaicite:5]{index=5}

**Recommended Tools:**
- socket.io-client in tests (if Socket.io)
- Deterministic test harness with a short game duration

### 4.5 End-to-End (E2E) Tests
**What:** Full user flows in a real browser session.  
**Recommended Tools:**
- Playwright (preferred) or Cypress

**Core E2E scenarios:**
1. Host creates game → receives gameId/token → lands in Lobby
2. Player joins by gameId → sees lobby updates
3. Players ready up → host starts game
4. Players search products → build outfits → submit
5. Voting begins → players vote (cannot vote for own outfit)
6. Results show winner + ranked list

---

## 5. Acceptance Criteria (What “Done” means)

### Core Game Flow
- Create game works and returns a valid `gameId` and session token.
- Join game adds player and updates lobby player list.
- Game starts only when host triggers start (and optional all-ready gating if implemented).
- Product search returns products and UI renders them.
- Outfit submission is stored and retrievable for voting.
- Voting is anonymized and disallows voting for own outfit.
- Results calculate ranking and show winner reliably.

Refs: game flow and page specs :contentReference[oaicite:6]{index=6}, endpoints for each phase :contentReference[oaicite:7]{index=7}

---

## 6. Test Matrix (Key Scenarios)

### 6.1 Games / Lobby
- ✅ Create game with valid inputs (theme/budget/maxPlayers/timeLimit)
- ❌ Create game with invalid budget/timeLimit (out of range)
- ✅ Join game until maxPlayers reached
- ❌ Join game after maxPlayers reached (returns error)
- ✅ Ready toggle updates correctly
- ✅ Start game transitions status to PLAYING
- ❌ Non-host attempts to start game (error)
- ✅ Polling updates players every 2–3 seconds (Phase 1)
Ref: Lobby polling expectation :contentReference[oaicite:8]{index=8}

### 6.2 Products Proxy
- ✅ Search with query + category filter
- ✅ Pagination behavior (page/limit/totalPages)
- ❌ Shopbop API failure → backend returns friendly error; frontend shows error message
- ✅ Product details endpoint returns description/images/sizes (if available)
Ref: product endpoint formats :contentReference[oaicite:9]{index=9}

### 6.3 Outfit Submission
- ✅ Submit outfit within budget
- ❌ Submit outfit over budget (should reject or warn depending on rules)
- ✅ Auto-submit on time expiry (frontend)
- ✅ Voting endpoint receives anonymized outfits (no player identity)
Ref: anonymized outfits requirement :contentReference[oaicite:10]{index=10}

### 6.4 Voting / Results
- ✅ Submit votes with ratings array
- ❌ Vote includes own outfit (reject)
- ✅ Results endpoint returns ranked list + stats
Ref: votes and results response shapes :contentReference[oaicite:11]{index=11} :contentReference[oaicite:12]{index=12}

### 6.5 WebSocket (Phase 2)
- ✅ player-joined updates lobby immediately
- ✅ time-sync keeps timers aligned
- ✅ reconnection handling: client re-joins room and receives current state
- ✅ server emits error event for invalid actions
Ref: time-sync event :contentReference[oaicite:13]{index=13}

---

## 7. Non-Functional Testing

### 7.1 Performance
- Phase 1: With polling, UI remains responsive with 4–8 players.
- Product search results render within acceptable time (target < 1–2 seconds locally).
- WebSocket (Phase 2): state updates feel “real-time” (< 300ms typical on local network).

### 7.2 Reliability / Resilience
- Network drop mid-game: user sees “reconnecting” and can resume.
- Backend error responses are handled (toast/message, not app crash).
- Duplicate submits (double-click) should be idempotent or safely rejected.

### 7.3 Basic Security
- Session tokens not logged in client console.
- Backend rejects malformed JWT / missing auth (if required).
- CORS configured correctly for the deployed frontend origin.

---

## 8. Regression Checklist (Run before demo)

- [ ] Create game works from fresh browser session
- [ ] Join game works from second device/incognito
- [ ] Lobby updates (polling or WS) show correct player list
- [ ] Start game transitions correctly
- [ ] Product search returns real or mock data reliably
- [ ] Outfit build + submit works
- [ ] Voting loads outfits and prevents self-vote
- [ ] Results page loads and displays winner
- [ ] Error handling works (simulate backend down)

---

## 9. Ownership

### Frontend
- Component/unit tests
- Page-level integration tests
- E2E tests (shared responsibility)

### Backend
- REST endpoint tests
- WS event tests (Phase 2)
- Data validation and rule enforcement tests

### Shared
- Contract validation: request/response shapes must match `INTEGRATION_PLAN.md`
- Integration testing in staging before final demo
Refs: shared responsibilities :contentReference[oaicite:14]{index=14}

---

## 10. Open Questions / TBD

- Final rule on “over budget” outfits: hard reject vs warn + allow (decide and document).
- Where session tokens are stored (memory vs localStorage) and how logout/expiry is handled.
- WebSocket reconnection strategy details (Phase 2).