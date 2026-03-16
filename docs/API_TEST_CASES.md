# API Test Cases (Templates + Starter Coverage)

This doc is the template for ShopBop Showdown’s API, plus a starter set of filled-out cases for the first endpoints we’re automating in `backend/tests/`.

## Standard API test case template

Copy/paste this section for each endpoint and scenario.

### Template

- **Test ID**:
- **Endpoint**:
- **Method**:
- **Type**: (positive | negative | edge | contract | security | performance)

- **Scenario**:
- **Preconditions**:

- **Request**:
  - **Path**:
  - **Query**:
  - **Headers**:
  - **Body**:

- **Expected Response**:
  - **Status**:
  - **Body shape**: (required keys + types)
  - **Contract notes**: (anything the frontend relies on)

- **Side effects / persistence**:
- **Error handling expectations**:

- **Notes / variants**:

---

## Starter test cases we are automating

These correspond to automated tests in `backend/tests/`.

## `POST /api/games` (create game)

- **Test ID**: API-GAMES-POST-001
- **Endpoint**: `/api/games`
- **Method**: POST
- **Type**: positive
- **Scenario**: Host creates a new game with valid inputs.
- **Preconditions**:
  - Backend is running OR endpoint is called via automated tests importing `backend/server.js`.
  - Dynamo writes succeed (in automated tests, DB is mocked).
- **Request**:
  - **Body**:

```json
{
  "hostUsername": "alice",
  "theme": "runway",
  "budget": 2500,
  "maxPlayers": 4,
  "timeLimit": 300,
  "singlePlayer": false
}
```

- **Expected Response**:
  - **Status**: 201
  - **Body shape**:
    - `game.gameId`: string (length 6)
    - `game.status`: `"LOBBY"`
    - `game.hostPlayerId`: string UUID
    - `player.playerId`: string UUID
    - `player.isHost`: true
    - `player.isReady`: true
- **Side effects / persistence**:
  - Game is written to DB.
  - Player is written to DB.
- **Notes / variants**:
  - Missing `hostUsername` or `theme` → 400 with `{ error }`.

---

- **Test ID**: API-GAMES-POST-002
- **Endpoint**: `/api/games`
- **Method**: POST
- **Type**: negative (validation)
- **Scenario**: Missing required fields.
- **Request**:

```json
{ "theme": "runway" }
```

- **Expected Response**:
  - **Status**: 400
  - **Body shape**: `{ "error": string }`

---

## `GET /api/products/search` (Shopbop proxy + normalization)

- **Test ID**: API-PRODUCTS-SEARCH-GET-001
- **Endpoint**: `/api/products/search`
- **Method**: GET
- **Type**: contract / proxy / positive
- **Scenario**: Search with `query` returns normalized products.
- **Preconditions**:
  - External Shopbop HTTP call succeeds (in automated tests, it’s mocked).
- **Request**:
  - **Query**:
    - `query=jeans`
    - `page=1`
    - `limit=20`
- **Expected Response**:
  - **Status**: 200
  - **Body shape**:
    - `products`: array of normalized products:
      - `productSin`: string
      - `name`: string
      - `brand`: string
      - `category`: string
      - `price`: number
      - `imageUrl`: string (absolute URL)
    - `page`: number
    - `totalPages`: number

---

- **Test ID**: API-PRODUCTS-SEARCH-GET-002
- **Endpoint**: `/api/products/search`
- **Method**: GET
- **Type**: edge (pagination)
- **Scenario**: `page` and `limit` affect `page` and `totalPages` consistently.
- **Expected Response**:
  - `page` echoes the requested page.
  - `totalPages` is computed from `total` and `limit` (capped by backend at max 50).

