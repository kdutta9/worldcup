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
  match date in the log.
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

## Rebuild after editing any prose

The committed `<D>.json` is a build artifact. After editing copy in
`build-books.mjs`, rerun `node scripts/sportsbook/build-books.mjs --date <D> --force`
(or `refresh-book`) before committing, or the JSON on disk won't match the config.
`node scripts/sportsbook/build-books.mjs --check-open` must still PASS — it proves
your config edits didn't perturb the committed opening books.
