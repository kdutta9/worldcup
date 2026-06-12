# World Cup Lotto '26

A draw tool for running a World Cup lotto draft. All 48 qualified nations are shuffled and dealt evenly — 6 teams per player for 8 players, 4 for 12, or 3 for 16. Every team goes to exactly one person, no leftovers.

## How the draw works

The shuffle is seeded: a random hex string is generated when you open the page, and the entire draw is a deterministic function of that seed. The algorithm is [xmur3](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) (string → hash) feeding [mulberry32](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) (PRNG) into a [Fisher–Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) over the 48 teams. Fisher–Yates is provably uniform — every permutation is equally likely.

Because the draw is deterministic, it's also auditable. The seed is displayed on the results screen. Anyone can paste the seed into the source, re-run it, and get the identical assignment. No one can claim the draw was rigged, and there are no re-draws.

## Project structure

```
src/
  main.jsx                  # React entry point
  App.jsx                   # Query-param router (draft / snapshot / scoreboard)
  WorldCupLottoDraft.jsx    # Setup, draw, results board, snapshot board
  Scoreboard.jsx            # Per-group standings + group list
  Masthead.jsx              # Shared header + nav
  draw.js                   # Teams + seeded Fisher–Yates shuffle
  snapshot.js               # Encode/decode the shareable draft URL
  scoring.js                # Stage→points, standings, data-loading seam
  styles.js                 # The single stylesheet
public/data/
  results.json              # Global team progress (furthest stage reached)
  groups.json               # Index of groups for the scoreboard landing
  groups/<id>.json          # One draft's assignments per group
scripts/
  add-group.mjs             # Snapshot link → group JSON + groups.json entry
```

The draw is computed client-side from the seed on every load. Scoreboard data is
fetched at runtime from the committed JSON under `public/data/` — there is no live
backend yet (see below).

## Routing

No router dependency; views switch on query params (refresh-safe on static hosting):

- `/worldcup/` — the draft tool
- `/worldcup/?d=<payload>` — a shared snapshot board
- `/worldcup/?scores` — scoreboard landing (lists groups)
- `/worldcup/?scores=<id>` — that group's standings

## Deployment architecture

Source lives in `github.com/kdutta9/worldcup` (this repo). Built output is deployed as a subdirectory of the main personal site:

- **Source repo**: `kdutta9/worldcup` → `main` branch
- **Host repo**: `kdutta9/kdutta9.github.io` → Jekyll site serving `kdutta.com`
- **Live URL**: `kdutta.com/worldcup`

`npm run deploy` builds with Vite, rsyncs `dist/` into `../kdutta9.github.io/worldcup/`, and commits + pushes the host repo. Jekyll passes the built HTML/JS through verbatim (no front matter = no processing).

## Features

### Draft snapshot URL
The results board carries a **Copy share link** button. It encodes `{seed, playerCount, groupName, names}` as base64url into `?d=` — the board is a pure function of those, so recipients see the identical deterministic draw, no screenshot or backend needed. The snapshot board is read-only, with options to replay the reveal animation or start a fresh draw.

### Live scoreboard
Per-group standings tracking lotto points as the tournament progresses.

**Scoring.** A team earns points for the furthest round it reaches: Round of 32 = 1,
R16 = 2, QF = 3, SF = 4, Runner-up = 5, Champion = 8 (group-stage exit = 0). A
player's score is the sum of their teams. The stage is the source of truth; points
are derived from one map in `scoring.js`.

**Data model.** One global `results.json` (team → furthest stage) shared by every
group, plus one `groups/<id>.json` per group holding that draft's player→team
assignments. Standings are derived client-side. The two JSON shapes map 1:1 onto
two Postgres tables for a future migration.

**Updating scores.** Edit `public/data/results.json` — add/bump a team's stage as it
advances — and run `npm run deploy`. Teams omitted from `stages` default to 0.

**Adding a group.** Finish a draft (with a group name set), hit **Save to scoreboard**
on the board — it copies a ready-to-run command — and paste it into your terminal:

```bash
npm run add-group -- "<share-link>"
```

The browser can't write repo files, so this Node script does it: it decodes the
snapshot link, re-runs the same seeded draw, writes `public/data/groups/<id>.json`,
and upserts the row into `groups.json`. Then `npm run deploy`.

**Real-time later.** All data access goes through `loadResults` / `loadGroup` /
`loadGroupsIndex` in `scoring.js`. Going real-time means swapping those bodies for
Supabase queries (same return shapes) plus a realtime subscription — no schema
redesign and no changes to the views.

### Sportsbook

`?book=<id>` renders a pre-tournament "sportsbook sheet" per group: outright /
top-3 / wooden-spoon prices, head-to-head matchups, an over/under ladder with a
points-distribution histogram, per-team rosters, and (where the group has lore)
a faction battle. Not real betting — a display format the group chat understands.

The numbers are real, though. `scripts/sportsbook/` holds the pipeline:

- `data.mjs` — the real 2026 groups, the FIFA R32→final bracket (incl. best-eight
  third-place slots), and the devigged pre-tournament championship consensus
  (DraftKings · FanDuel · Kalshi · ESPN, June 2026).
- `engine.mjs` — Poisson-goal tournament simulator; one rating per team drives
  group results and knockout win probability.
- `calibrate.mjs` — fits ratings until simulated title probabilities match the
  consensus; writes `ratings.json` (committed, so builds are reproducible).
- `build-books.mjs` (`npm run build-books`) — 400k simulated tournaments, scores
  every pool draw against them, prices the markets with a house margin, writes
  `public/data/books/<id>.json`.

Lines are frozen pre-tournament by design (the book "closed at kickoff"). To
re-price mid-tournament you'd condition the sim on results so far — not built.

## Local setup

```bash
npm install
npm run dev            # dev server with hot reload
```

Open http://localhost:5173/worldcup/. Try the views at `?scores`, `?scores=boofy`,
and a `?d=…` share link.

To build the production bundle and preview the exact static output that gets
deployed (served at the `/worldcup/` base path, same as live):

```bash
npm run build          # outputs to dist/
npm run preview        # serves dist/ locally
```

## Deploy

```bash
npm run deploy
```

Builds and pushes output into the host repo under `worldcup/`. Requires `../kdutta9.github.io` to exist locally and have a clean working tree.
