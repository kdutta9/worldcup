# CLAUDE.md — agent notes

Full architecture is in [README.md](README.md); read its **Sportsbook** and
**Live line movement** sections before touching `scripts/sportsbook/`. This file
is only the things that have actually tripped agents up.

## Mental model: a sheet is dated by the results, its lines preview the next day

A dated book sheet `public/data/books/<id>/<D>.json` reads as *the evening of day
D, after D's matches*: banked points reflect D's results, and the slips it carries
are a **preview of the upcoming fixtures** (D+1 onward). A night's results become
the lines people read going into the next match day.

- The **newest sheet is dated by the latest match in the log**, not the wall clock.
  After entering a match dated `2026-07-10`, the newest sheet is `2026-07-10` even
  if the machine clock has rolled to the 11th. `--backfill` builds one sheet per
  match date in the log — plus any `EXTRA_SHEET_DATES` whose consensus has landed
  (see below).
- **The clock is UTC and it lies to you.** `fetch-consensus` and `add-results` use
  `new Date().toISOString()`, so on a US evening the "today" they see is already
  tomorrow. Entering the 15th's result at 6pm Pacific stamps `results.json` with
  the 16th, and a bare `npm run fetch-consensus` will mint a **`2026-07-16`**
  consensus — which, with rest-gap dates live, mints a 7/16 sheet a day early.
  During a rest gap, fetch the date you mean: `node scripts/sportsbook/fetch-consensus.mjs <D>`.
- **A rest gap still needs a line.** The final is July 19 but the log stops the
  15th. `EXTRA_SHEET_DATES` lists the match-free dates that get a sheet anyway;
  each is built only once a consensus file exists for that exact date. Sheets are
  labelled the *next* morning, so the `2026-07-18` sheet displays as "JUL 19
  MORNING LINE" — that's the one the finals post should cite on the day.
- A **new specials board uses `since: <that match date>`** — the same date as the
  results that triggered it, *not* the next day. Each sheet gets the latest board
  whose `since` ≤ the sheet date.

## The trap: prices reprice themselves, the words do not

`npm run refresh-book` re-simulates and re-prices every market — the numbers are
always fresh, so it *looks* finished. But the **specials slips and watch copy are
hand-authored config** in `scripts/sportsbook/build-books.mjs`
(`CONFIG[<pool>].specials.boards` and `.watch`). If you don't add a new board with
a `since` on the new match date, the newest sheet **silently inherits the previous
day's lines** — correct prices, stale story. "Generate new lines" is always a
manual authoring step; the pipeline will not write prose for you.

So the true end-of-day sequence is:

```
npm run add-results -- "..."        # 1. enter the night's scores
# 2. edit build-books.mjs: add a `since: <that date>` board (+ watch copy) per pool
npm run refresh-book                # 3. fetch consensus + rebuild snapshots
npm run publish                     # 4. commit source, then build + deploy
```

Skipping step 2 is the failure mode: everything runs clean and the lines are stale.

**A dead seat can still break the Watch.** The watch panel's O/U ladder drops any
rung that's already settled, so pointing `watch` at a seat whose teams are all
eliminated leaves an empty ladder — the panel renders hollow. When the featured
seat freezes, move the watch to someone with a live team (that's why Boofy's went
Kunal → Rob → Dante).

## Never reprice a posted sheet

Anything that changes what a market *means* — the goal-difference tiebreak, the
margin schedule, new panel copy, a display field — must be **gated on a date**,
never switched on globally. `GD_TIEBREAK_SINCE`, `FIELD_MARGIN_SINCE`, the `since`
timelines (`watch`, `specials.boards`, `h2hPairs`, `copyFrom`, all read via
`latestSince`), and the `tiebreak`-gated `gd` field all exist for this reason.
Two guards prove you got it right, and both must stay green:

```
node scripts/sportsbook/build-books.mjs --check-open        # opening books bit-identical
node scripts/sportsbook/build-books.mjs --date 2026-07-14   # then: git diff → must be EMPTY
```

`--backfill` won't rebuild an old sheet on its own (freshness protects it), but
`--backfill --force` will, and it will silently drift a day's prices. Don't reach
for it to refresh today's line — use `--date <D>`.

## Rebuild after editing any prose

The committed `<D>.json` is a build artifact. After editing copy in
`build-books.mjs`, rerun `node scripts/sportsbook/build-books.mjs --date <D> --force`
(or `refresh-book`) before committing, or the JSON on disk won't match the config.
`node scripts/sportsbook/build-books.mjs --check-open` must still PASS — it proves
your config edits didn't perturb the committed opening books.
