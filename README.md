# 🏆 Bracket Engine — 6-Team Hybrid Playoff (Bun + SQLite)

## ⭐ All in one

`node install.mjs build` creates **`dist/BracketEngine-AllInOne.zip`**: one download with everything.

```
BracketEngine/
├── START-HERE.txt          ← read me first
├── Start-Windows.bat       ← double-click (Windows)
├── Start-Mac.command       ← double-click (Mac)
├── Start-Linux.sh          ← run (Linux)
├── app/                    ← ready-made apps for Windows, Mac (Apple Silicon + Intel) and Linux
├── node/                   ← plain JavaScript version (Node.js 18+)
├── source/                 ← this project
└── data/                   ← your tournaments: ONE database shared by all of the above
```

Each launcher uses the ready-made app for your computer, or the Node.js version if that app can't run. The app, the Node version and the source all use the same `data/bracket.sqlite` file, so your tournaments are the same whichever way you start the engine.

## What you get

| Build | Where | How to run | Needs |
|---|---|---|---|
| **Windows app (.exe)** | `dist/exe/BracketEngine-windows-x64.exe` | Double-click it. Your browser opens the bracket. | Nothing |
| **React web UI** | `dist/web/` (also built into every server) | Served at `http://localhost:3000` | — |
| **Plain JavaScript (Node.js)** | `dist/node/` | `npm install` then `npm start` | Node.js 18+ |
| **Bun server** | `dist/bun/` | `node install.mjs start` | Bun (installed automatically) |

To build all of them, run `node install.mjs build`. For Mac and Linux executables too, add `--platforms=windows,linux,mac`.

**The .exe:** your data is saved in `bracket.sqlite`, next to the exe. Keep the black window open while you use the app, and close it to stop. If port 3000 is busy, the app picks a free port. On first launch, Windows SmartScreen may show a warning because the exe isn't code-signed. Click **More info** → **Run anyway**.

## 🔮 Prediction mode

Turn on **🔮 Prediction** in the UI, or call `GET`/`POST /api/tournaments/:id/predict`. The engine simulates the rest of the bracket 20,000 times with the real rules, including the twice-to-beat logic, and shows:

- each team's chance to win the title, reach the Finals or make the top 4, plus its average finish
- each match's exact win odds, its likely winner, and the chance a twice-to-beat series needs Game 2
- the most likely team for every "To be decided" slot

**What-if picks:** tap a team to force it to win a match, and the odds update downstream. Picks are never saved, so real results are untouched.

**The model:** each team gets an Elo-style rating from its seed, using the **Favourite strength** slider. Seeds are 60 points apart by default, so Rank 1 beats Rank 6 about 85% of the time. Games already played adjust the ratings, controlled by the **Weight of results so far** slider. Matches already decided always count as fact. Each forecast uses a fixed random seed, so the same bracket always gives the same numbers.

`POST` body (all optional): `{ "picks": { "QF1": <teamId> }, "ratingPerSeed": 60, "formWeight": 1, "iterations": 20000, "seed": 1, "ratings": { "<teamId>": 1600 } }`


A fast, local-first tournament bracket engine that runs your playoffs. It uses Bun's native `bun:sqlite` driver, and the same business logic runs on Node.js through `better-sqlite3`.

## Folder structure

```
bracket-engine/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── server.ts                 # Bun.serve() entry point (REST API + React UI, also the .exe)
│   ├── server-node.ts            # Plain Node.js server (node:http + better-sqlite3)
│   ├── router.ts                 # Shared router so both servers run identical handlers
│   ├── http.ts                   # Route table + JSON/error handling
│   ├── app.ts                    # Composition root (picks driver, migrates, wires engine)
│   ├── db/
│   │   ├── adapter.ts            # DatabaseAdapter interface + WAL/perf PRAGMAs
│   │   ├── schema.ts             # tournaments / teams / matches / match_games DDL
│   │   └── repository.ts         # SQL-only persistence (no business rules)
│   ├── engine/
│   │   ├── types.ts              # Row types, statuses, API view models
│   │   ├── errors.ts             # DomainError → HTTP status mapping
│   │   ├── bracket-definition.ts # The 6-team bracket as pure data (a DAG)
│   │   ├── state-machine.ts      # Legal transitions, score validation, twice-to-beat logic
│   │   ├── prediction.ts         # 🔮 Monte Carlo forecast + what-if picks (read-only)
│   │   └── bracket-engine.ts     # Atomic commands: create / score / propagate / reset / simulate
│   └── adapters/
│       ├── index.ts              # openDatabase(): auto-selects driver per runtime
│       ├── bun-sqlite.ts         # Default adapter (zero dependencies)
│       └── better-sqlite3.ts     # Node.js drop-in adapter
├── web/                          # React UI (App.tsx, api.ts, styles.css, index.html)
├── install.mjs                   # Automatic setup / start / build (needs only Node.js)
├── tests/
│   ├── helpers.ts
│   ├── bracket-paths.test.ts     # Path A + Path B end-to-end
│   ├── validation.test.ts        # Validation, atomicity, reset, simulate
│   ├── prediction.test.ts        # Forecast maths, picks, read-only guarantee
│   └── api.test.ts               # Real HTTP tests against Bun.serve
└── scripts/
    ├── build.ts                  # Builds exe / web / js / bun outputs
    └── node-smoke.ts             # Runs the engine on Node + better-sqlite3
```

## Bracket rules

| Stage | Match | Teams | Format |
|---|---|---|---|
| 1 | `QF1` | Rank 1 vs Rank 3 | Twice-to-beat (Rank 1 advantage) |
| 1 | `QF2` | Rank 2 vs Rank 4 | Twice-to-beat (Rank 2 advantage) |
| 1 | `ELIM` | Rank 5 vs Rank 6 | Single (loser out) |
| 2 | `BATTLE_3RD` | Loser QF1 vs Loser QF2 | Single → winner = SF seed #3, loser → `BATTLE_4TH` |
| 2 | `BATTLE_4TH` | Loser BATTLE_3RD vs Winner ELIM | Single → winner = SF seed #4 |
| 3 | `SF1` | Winner QF1 vs Winner BATTLE_4TH | Single |
| 3 | `SF2` | Winner QF2 vs Winner BATTLE_3RD | Single |
| 4 | `THIRD_PLACE` | Loser SF1 vs Loser SF2 | Single |
| 4 | `FINALS` | Winner SF1 vs Winner SF2 | Single → Champion |

**Match states:** `PENDING` (waiting for teams) → `READY` (Game 1 scheduled) → `IN_PROGRESS` (optional) → `AWAITING_DECIDER` (Game 2 spawned because the lower seed won Game 1 of a QF) → `COMPLETED` (locked).

## Guarantees

- Every score submission runs in a single `BEGIN IMMEDIATE` transaction. The game, the match result, every downstream slot and the tournament status either all commit or all roll back. A test proves this.
- The database enforces its own rules (CHECK, UNIQUE and foreign keys): no draws, no negative scores, no team playing itself, and a COMPLETED match always has a winner.
- Every match row has a `version` column for optimistic locking, as extra protection against stale writes.
- Game 2 is created only when the lower seed wins Game 1 of `QF1` or `QF2`.

## Quick start (automatic, needs only Node.js)

Install Node.js 18+ from https://nodejs.org, then:

```bash
cd bracket-engine
node install.mjs          # installs Bun if missing, installs deps, runs tests, builds
node install.mjs start    # starts the server on http://localhost:3000
```

The installer works the same on Windows, macOS and Linux, with no admin rights needed. If npm can't install Bun globally, the installer puts Bun inside the project folder instead. Options:

- `node install.mjs --skip-tests` skips the test step.
- `PORT=4000 node install.mjs start` runs on another port. In PowerShell: `$env:PORT=4000; node install.mjs start`.
- `npm run setup` and `npm run serve` are shortcuts for the two commands above.

The database is saved at `data/bracket.sqlite`.

## Manual commands

```bash
# 1. Install Bun (once)
curl -fsSL https://bun.sh/install | bash        # macOS / Linux / WSL
# powershell -c "irm bun.sh/install.ps1 | iex"  # Windows

# 2. Install project dependencies
cd bracket-engine
bun install

# 3. Run the test suite
bun test

# 4. Development server (auto-reload) on http://localhost:3000
bun run dev

# 5. Production: bundle + run
bun run build
PORT=3000 DB_FILE=./data/bracket.sqlite bun run start:prod
#   (or without a build step:  bun run start)

# Optional: type-check
bun run typecheck

# Optional: prove the Node.js adapter (Node 22.6+)
npm install better-sqlite3
node --experimental-strip-types scripts/node-smoke.ts
```

On Windows PowerShell, set the environment variables first: `$env:PORT=3000; $env:DB_FILE="data/bracket.sqlite"; bun run start:prod`. Create the `data` folder before you start (`mkdir data`).

## REST API

| Method | Path | Body | Purpose |
|---|---|---|---|
| GET | `/health` | – | Liveness |
| POST | `/api/tournaments` | `{ name, teams: [{ name, seedRank }] ×6 }` | Create + seed |
| GET | `/api/tournaments` | – | List |
| GET | `/api/tournaments/:id/bracket` | – | Full bracket tree, standings, champion |
| POST | `/api/tournaments/:id/matches/:code/start` | – | `READY` → `IN_PROGRESS` |
| POST | `/api/tournaments/:id/matches/:code/games` | `{ scoreA, scoreB, gameNumber? }` | Record the open game |
| POST | `/api/tournaments/:id/matches/:code/reset` | – | Reset a match and everything downstream |
| POST | `/api/tournaments/:id/reset` | – | Reset the whole bracket |
| GET/POST | `/api/tournaments/:id/predict` | `{ picks?, ratingPerSeed?, formWeight?, iterations?, seed?, ratings? }` | 🔮 Forecast (read-only) |
| POST | `/api/tournaments/:id/simulate` | `{ strategy?: "random"\|"favorites"\|"upsets", seed?, until? }` | Auto-play |
| DELETE | `/api/tournaments/:id` | – | Delete |

Errors return `{ "error": { "code", "message" } }`. The status is 400 for a validation error, 404 when something isn't found, and 409 for an invalid state or a conflict.

### Quick try

```bash
curl -X POST localhost:3000/api/tournaments -H 'content-type: application/json' -d '{
  "name": "Summer Cup",
  "teams": [
    {"name":"Titans","seedRank":1},{"name":"Wolves","seedRank":2},{"name":"Hawks","seedRank":3},
    {"name":"Bears","seedRank":4},{"name":"Sharks","seedRank":5},{"name":"Foxes","seedRank":6}
  ]}'

# Rank 3 upsets Rank 1 in Game 1 → Game 2 is spawned automatically
curl -X POST localhost:3000/api/tournaments/1/matches/QF1/games \
  -H 'content-type: application/json' -d '{"scoreA":88,"scoreB":95}'

curl localhost:3000/api/tournaments/1/bracket
```

## Using it from Node.js

```ts
import { createAppContext } from "./src/app.ts";
const { engine } = await createAppContext("bracket.sqlite", "better-sqlite3");
```

The engine and repository depend only on the `DatabaseAdapter` interface, so you can switch drivers without changing business logic. To serve HTTP from Node, plug `engine` into any framework (Hono, Fastify, Express).
