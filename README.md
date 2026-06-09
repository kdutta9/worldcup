# World Cup Lotto '26

A draw tool for running a World Cup lotto draft. All 48 qualified nations are shuffled and dealt evenly — 6 teams per player for 8 players, 4 for 12, or 3 for 16. Every team goes to exactly one person, no leftovers.

## How the draw works

The shuffle is seeded: a random hex string is generated when you open the page, and the entire draw is a deterministic function of that seed. The algorithm is [xmur3](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) (string → hash) feeding [mulberry32](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) (PRNG) into a [Fisher–Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) over the 48 teams. Fisher–Yates is provably uniform — every permutation is equally likely.

Because the draw is deterministic, it's also auditable. The seed is displayed on the results screen. Anyone can paste the seed into the source, re-run it, and get the identical assignment. No one can claim the draw was rigged, and there are no re-draws.

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:5173/worldcup/.

## Deploy to GitHub Pages

```bash
npm run deploy
```

Builds to `dist/` and pushes to the `gh-pages` branch. Enable GitHub Pages in the repo settings pointing at that branch.
