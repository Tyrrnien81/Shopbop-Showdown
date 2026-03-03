# ShopBop Showdown — Frontend

Real-time fashion game frontend built with React + Vite.

## Stack

| Tool | Version |
|------|---------|
| React | 19 |
| Vite | 7 |
| React Router DOM | 7 |
| Zustand | 5 |
| Axios | 1 |
| Socket.IO Client | 4 |

## Getting Started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
npm run preview
```

Set `VITE_API_BASE_URL` and `VITE_BACKEND_URL` in `.env` (default: `http://localhost:3000`).

## File Structure

```
frontend/
├── public/
├── src/
│   ├── pages/
│   │   ├── Home.jsx        # Landing page
│   │   ├── CreateGame.jsx  # Create a new game room
│   │   ├── Lobby.jsx       # Pre-game waiting room (polls every 2.5s)
│   │   ├── Game.jsx        # Outfit building (ShopBop products by category)
│   │   ├── Voting.jsx      # Rate other players' outfits
│   │   ├── Results.jsx     # Final scores and winner
│   │   └── index.js        # Page exports
│   ├── services/
│   │   └── socket.js       # Socket.IO client setup
│   ├── App.jsx             # Router + routes
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── eslint.config.js
├── vite.config.js
└── package.json
```

## Game Flow

`Home → CreateGame / Join → Lobby → Game → Voting → Results`
