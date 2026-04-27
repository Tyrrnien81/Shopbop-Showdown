# ShopBop Showdown

University of Wisconsin–Madison — Computer Science Capstone – Spring 2026  
Amazon / ShopBop Partnership

**Repository:** https://github.com/Buman-Erdem/ShopBop-Showdown  
**Figma Prototype:** https://www.figma.com/make/RWUGQhyVSKv42Y8ibQWZB4/Webapp-prototype-for-gamified-fashion--Copy-?p=f  
**Final Presentation Deck:** `CS620 ShopBop_Showdown_Final.pptx` (root of repository)

ShopBop Showdown is a multiplayer fashion styling game that turns outfit creation into a competitive and social experience. Players build outfits using curated fashion products and compete to create the best look based on a theme, budget, and time limit.

The project explores how fashion discovery can be transformed from a solo browsing experience into a fast-paced multiplayer game with real-time voting and AI-generated outfit previews.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Setup](#setup)
3. [How the Code Works](#how-the-code-works)
4. [What Works & What Doesn't](#what-works--what-doesnt)
5. [What We'd Work On Next](#what-wed-work-on-next)
6. [Features](#features)
7. [Tech Stack](#tech-stack)
8. [System Architecture](#system-architecture)
9. [Team](#team)

---

## Project Overview

Online fashion platforms contain thousands of products, making it difficult for users to quickly assemble outfits or stay on top of trends.

ShopBop Showdown addresses this by introducing a competitive styling game where players:

1. Join a multiplayer lobby
2. Vote on a theme together
3. Build outfits using live ShopBop products within budget and time constraints
4. View AI-generated outfit previews before submitting
5. Vote on the best outfit (anonymously, so judging is merit-based)
6. Reveal results and rankings

The platform combines fashion discovery, social competition, and real-time interaction.

---

## Setup

### Prerequisites

- Node.js 18+
- An AWS account with DynamoDB tables provisioned (see `scripts/createTables.mjs`)
- A Google Gemini API key (for AI virtual try-on)

### 1 — Clone the repository

```bash
git clone https://github.com/Buman-Erdem/ShopBop-Showdown.git
cd ShopBop-Showdown
```

### 2 — Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend (separate terminal)
cd frontend && npm install
```

### 3 — Configure environment variables

Create `backend/.env`:

```env
PORT=3000

# Google Gemini (required for AI try-on)
GEMINI_API_KEY=your_gemini_api_key_here

# AWS credentials (required — all game state lives in DynamoDB)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret_key

# ShopBop API (default value works for capstone; override if needed)
SHOPBOP_CLIENT_ID=Shopbop-UW-Team1-2024

# Admin analytics dashboard
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password_here

# Optional: offload try-on to AWS Lambda instead of inline
# TRYON_LAMBDA_NAME=shopbop-tryon-fn
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000
```

### 4 — Provision DynamoDB tables (first time only)

```bash
cd backend
node scripts/createTables.mjs
```

This creates four tables: `Games`, `Players`, `Outfits`, `Votes`.

### 5 — Run the development servers

**Option A — single script (from repo root):**

```bash
bash dev.sh
```

**Option B — separate terminals:**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Frontend is available at `http://localhost:5173`.  
Backend API is available at `http://localhost:3000`.

### 6 — Run tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## How the Code Works

### Directory Structure

```
ShopBop-Showdown/
├── backend/
│   ├── server.js          # Express app, Socket.IO setup, all route handlers
│   ├── db/                # DynamoDB table modules (games, players, outfits, votes)
│   ├── routes/
│   │   └── analytics.js   # Admin analytics router
│   ├── middleware/
│   │   └── adminAuth.js   # HTTP Basic Auth for /api/admin
│   └── scripts/           # Table provisioning, Lambda deploy utilities
├── frontend/
│   └── src/
│       ├── pages/         # One file per route (Home, CreateGame, Lobby, Game, Voting, Results, …)
│       ├── components/    # Shared UI (GuidedTour)
│       ├── services/      # Axios API client (api.js)
│       └── store/         # Zustand global game state
├── docs/                  # Planning documents and API reference
├── screenshots/           # UI screenshots
└── dev.sh                 # Convenience script to start both servers
```

### Backend (`backend/server.js`)

The entire backend runs as a single Express + Socket.IO server on port 3000. There is no separate microservice layer.

**Game state machine:** every game moves through four phases — `LOBBY → PLAYING → VOTING → COMPLETED`. Phase transitions are enforced server-side; clients are notified via Socket.IO events and then re-fetch game state.

**Data layer:** all persistent state (games, players, outfits, votes) lives in DynamoDB via the AWS SDK v3. The `db/` modules each wrap one DynamoDB table and export named async functions (`getGame`, `createGame`, `updateGameStatus`, etc.). An in-memory `Map` is used only for large binary data that exceeds DynamoDB's 400 KB item limit (AI try-on images and ephemeral theme-vote tallies).

**ShopBop proxy:** the `/api/products/search` endpoint proxies requests to `https://api.shopbop.com`, injects the `client-id` header, and runs the response through `normalizeProduct()` which handles several different shapes the upstream API can return and rewrites relative image URLs to full CDN URLs.

**AI try-on:** `POST /api/tryon/generate` base64-encodes up to three product images and sends them to the Gemini `gemini-2.5-flash-image` model with a styled prompt. Results are cached in memory (keyed by outfit ID) so repeated requests don't re-run the model. An optional Lambda path (`TRYON_LAMBDA_NAME` env var) offloads generation to an AWS Lambda function.

**Theme voting:** before the game starts the host triggers a theme-vote round. Three random themes are broadcast to all clients; players vote via Socket.IO; the server tallies votes, resolves ties randomly, and emits the winner.

### Frontend (`frontend/src/`)

The frontend is a React 19 SPA built with Vite. Routing is handled by React Router v7; global game state (player ID, game ID, current phase) is stored in a Zustand store so any page can read it without prop drilling.

Each page maps directly to a game phase:

| Page | Path | Responsibility |
|---|---|---|
| `Home.jsx` | `/` | Create or join a game |
| `CreateGame.jsx` | `/create` | POST to `/api/games`, redirect to lobby |
| `BrowseRooms.jsx` | `/browse` | List open lobbies |
| `Lobby.jsx` | `/lobby/:gameId` | Poll game state every 2.5 s; ready-up and theme vote |
| `Game.jsx` | `/game/:gameId` | Fetch products per category, budget tracker, countdown timer, submit outfit |
| `ThemeVote.jsx` | `/theme-vote/:gameId` | Theme selection UI before build phase |
| `Voting.jsx` | `/voting/:gameId` | Load anonymized outfits, submit star ratings |
| `Results.jsx` | `/results/:gameId` | Fetch final rankings |
| `HallOfFame.jsx` | `/hall-of-fame` | Completed games leaderboard |
| `Analytics.jsx` | `/admin` | Admin dashboard (login-gated) |

Real-time events (lobby sync, game start, voting transitions) travel over Socket.IO. The lobby also falls back to polling (`setInterval` at 2.5 s) for resilience in flaky network conditions.

### API Surface

All endpoints are prefixed `/api`. Key ones:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/products/search` | Proxied ShopBop product search |
| POST | `/api/games` | Create game |
| GET | `/api/games/:id` | Get game + player list |
| POST | `/api/games/:id/join` | Join game |
| POST | `/api/games/:id/start` | Transition to PLAYING |
| POST | `/api/outfits` | Submit outfit |
| GET | `/api/games/:id/outfits` | Get outfits (anonymized during VOTING) |
| POST | `/api/votes` | Submit ratings |
| GET | `/api/games/:id/results` | Final ranked results |
| POST | `/api/tryon/generate` | AI outfit preview (3 images) |
| GET | `/api/admin/analytics` | Admin dashboard data (Basic Auth) |

---

## What Works & What Doesn't

### What Works

- **Full game loop** — Create → Lobby → Theme Vote → Build → Vote → Results, end to end
- **Live ShopBop products** — real product data fetched per category from the ShopBop API, normalized and image-corrected
- **AI Virtual Try-On** — Gemini generates a composite outfit preview from selected product images; results are cached
- **Real-time sync** — Socket.IO keeps all players in sync for lobby events, game start, and phase transitions
- **Blind voting** — outfit creator names are hidden from the API response until the game reaches `COMPLETED`
- **Theme voting** — players vote on a theme before the build phase; ties are broken randomly
- **Budget + timer enforcement** — the UI prevents adding items past the budget cap; the timer is synced server-side
- **QR code room join** — lobby displays a QR code so players on mobile can join without typing the game code
- **Admin analytics dashboard** — shows live game stats and product popularity, protected by HTTP Basic Auth
- **Hall of Fame** — aggregated view of past completed games

### Known Limitations

- AWS credentials are required to run locally (DynamoDB is the data store; no offline fallback).
- Player sessions are stored in `localStorage` — refreshing or switching browsers mid-game loses your session.
- AI try-on takes 3–8 seconds and fails silently if `GEMINI_API_KEY` is not set.

---

## What We'd Work On Next

1. **Mobile-responsive design** — the outfit builder and voting grid need layout work for small screens; this is the highest-impact UX improvement for casual players.

2. **Session persistence** — replace UUID-in-localStorage with a signed JWT so players can reconnect after a page refresh without losing their game state.

3. **Local DB fallback** — add a `USE_LOCAL_DB` flag that swaps DynamoDB for an in-memory store, removing the AWS credential requirement for local development.

4. **Spectator mode** — let extra players join a game in progress as observers without affecting the player count or outcome.

5. **End-to-end test suite** — a Playwright suite driving a full two-player round would catch regressions in phase transitions and Socket.IO event ordering that unit tests miss.

---

## Features

### Multiplayer Lobby
Players can create or join a game room and synchronize with other players in real time.

### Theme Voting
Before the build phase, players vote on one of three randomly selected themes. The majority pick becomes the game's official theme.

### Outfit Builder
Players build outfits while balancing three constraints:
- Theme
- Budget
- Timer

### AI Virtual Try-On
The system generates visual outfit previews so players can see how selected items work together before submission.

Pipeline: Products → Backend → Gemini AI → Outfit Preview

### Real-Time Gameplay
Game state is synchronized using WebSockets so all players see the same lobby state, styling phase, voting phase, and results.

### Blind Voting
Players evaluate outfits before creator identities are revealed to ensure fair judging.

### Results & Rankings
Votes are aggregated and final rankings determine the winning outfit.

### Admin Analytics Dashboard
Password-protected dashboard at `/admin` showing game stats, product popularity, and outfit performance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite |
| State management | Zustand |
| Routing | React Router v7 |
| HTTP client | Axios |
| Real-time | Socket.IO |
| Backend | Node.js, Express |
| Database | Amazon DynamoDB (AWS SDK v3) |
| AI | Google Gemini (`gemini-2.5-flash-image`) |
| Product data | ShopBop API (proxied) |

---

## System Architecture

```
Players (Browser)
        ↕  REST + Socket.IO
React Frontend (Vite, port 5173)
        ↕
Node.js / Express Backend (port 3000)
     ↙         ↘
DynamoDB    ShopBop API + Gemini AI
```

The backend handles game state, voting logic, real-time synchronization, ShopBop product proxying, and AI image generation requests.

---

## Project Structure

```
ShopBop-Showdown/
├── frontend/src/
│   ├── components/     Shared UI components
│   ├── pages/          One component per route/game phase
│   ├── services/       Axios API layer
│   └── store/          Zustand global state
├── backend/
│   ├── db/             DynamoDB table modules
│   ├── routes/         Express routers (analytics)
│   ├── middleware/      Admin auth
│   └── server.js       Main server entry point
├── docs/               Planning documents
├── scripts/            DB provisioning utilities
└── dev.sh              Start both servers in one command
```

---

## Local Development

```bash
# Clone
git clone https://github.com/Buman-Erdem/ShopBop-Showdown.git
cd ShopBop-Showdown

# Install
cd frontend && npm install
cd ../backend && npm install

# Configure (see Setup section above for required env vars)
# Then run:
bash dev.sh
```

---

## Team

Leo Jeong — Scrum Master  
Siddhanth Pandey — Product Owner  
Anirudh Kompella — Scribe  
Ishita Kapoor — Demo Coordinator  
Kinhkha Tran — Testing Lead  
Buman-Erdem Enkhbold — UX Design

---

## License

Developed as part of the University of Wisconsin–Madison Computer Science Capstone (Spring 2026) in collaboration with Amazon / ShopBop.
