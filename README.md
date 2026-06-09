# World Cup Lotto '26

A draw tool for running a World Cup lotto draft. All 48 qualified nations are shuffled and dealt evenly — 6 teams per player for 8 players, 4 for 12, or 3 for 16. Every team goes to exactly one person, no leftovers.

## How the draw works

The shuffle is seeded: a random hex string is generated when you open the page, and the entire draw is a deterministic function of that seed. The algorithm is [xmur3](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) (string → hash) feeding [mulberry32](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) (PRNG) into a [Fisher–Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) over the 48 teams. Fisher–Yates is provably uniform — every permutation is equally likely.

Because the draw is deterministic, it's also auditable. The seed is displayed on the results screen. Anyone can paste the seed into the source, re-run it, and get the identical assignment. No one can claim the draw was rigged, and there are no re-draws.

## Project structure

```
src/
  main.jsx                  # React entry point
  WorldCupLottoDraft.jsx    # Full app — setup, draw, and results board
```

State lives entirely in React (no backend). The draw is computed client-side from the seed on every load.

## Deployment architecture

Source lives in `github.com/kdutta9/worldcup` (this repo). Built output is deployed as a subdirectory of the main personal site:

- **Source repo**: `kdutta9/worldcup` → `main` branch
- **Host repo**: `kdutta9/kdutta9.github.io` → Jekyll site serving `kdutta.com`
- **Live URL**: `kdutta.com/worldcup`

`npm run deploy` builds with Vite, rsyncs `dist/` into `../kdutta9.github.io/worldcup/`, and commits + pushes the host repo. Jekyll passes the built HTML/JS through verbatim (no front matter = no processing).

## Planned features

### Draft snapshot URL
Encode seed + player names into the URL so a completed draw can be shared as a link rather than a screenshot. Entirely client-side — no backend needed. Recipients see the same deterministic board.

### Live scoreboard
Per-group standings tracking lotto points as the tournament progresses. Two groups. Data source and update mechanism TBD — options range from a committed JSON file (redeploy to update) to a live DB (Supabase) if real-time updates across viewers are needed.

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:5173/worldcup/.

## Deploy

```bash
npm run deploy
```

Builds and pushes output into the host repo under `worldcup/`. Requires `../kdutta9.github.io` to exist locally and have a clean working tree.
