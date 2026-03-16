# Analytics Route — `analytics.js`

Endpoint: `GET /api/admin/analytics`

Requires HTTP Basic Auth (`ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars). Returns three panels of aggregated data computed on-demand by scanning the database.

---

## Panel 1: Game Stats

Sourced from the **Games** table.

- **totalGames** — total number of games ever created
- **completionRate** — percentage of games that reached `COMPLETED` status
- **byStatus** — count of games broken down by status (`LOBBY`, `PLAYING`, `VOTING`, `COMPLETED`)
- **byTheme** — count of games per theme (e.g. Runway Ready, Apres Ski Chic)
- **soloVsMultiplayer** — how many games were played solo vs. with multiple players
- **avgPlayersPerGame** — average number of players across all games
- **avgDurationSeconds** — average time (in seconds) from game start to end, for completed games only
- **gamesOverTime** — count of games created per calendar day (`YYYY-MM-DD`)

---

## Panel 2: Product Popularity

Sourced from the **Outfits** table.

Tracks how often each product has been picked by players across all outfits.

- **totalProductsPicked** — total number of product selections across all outfits
- **uniqueProductsUsed** — number of distinct products that have appeared in at least one outfit
- **topProducts** — top 20 most-picked products globally, each with: id, name, brand, category, price, image, and pick count
- **categoryPickCount** — total picks per category (e.g. Shoes: 42, Dresses: 31)
- **topProductsByCategory** — top 5 most-picked products within each category

---

## Panel 3: Product Performance

Sourced from the **Outfits** + **Votes** tables, joined on `outfitId`.

Measures how well products perform based on the voting scores of outfits they appeared in.

- **overallAvgRating** — average rating across all votes cast in the system
- **ratingDistribution** — histogram of vote counts for each star rating (1 through 5)
- **budgetVsScore** — one data point per scored outfit: total price, average score received, and number of products in the outfit (useful for visualizing whether spending more correlates with higher scores)
- **topProductsByScore** — top 20 products ranked by average outfit score when they were included; only products that appeared in at least 2 scored outfits are included to reduce noise
