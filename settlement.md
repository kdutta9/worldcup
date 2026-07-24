# Handoff: end-of-tournament SETTLEMENT (Option C)

You are picking up a finished, deployed static site (`~/Desktop/projects/worldcup`,
Vite/React, served at kdutta.com/worldcup). The 2026 World Cup is **over** (Spain
champion; `public/data/results.json` is final, dated 2026-07-19). Your job is to
build the tournament's closing settlement.

## READ FIRST (non-negotiable)
- `README.md` — sections **Sportsbook**, **Live line movement**, **The house organ**.
- `CLAUDE.md` — especially *Never reprice a posted sheet* and *The trap: prices
  reprice themselves, the words do not*.
- `src/posts.jsx` header comment + the two finals posts (`id: "final-boofy"`,
  `id: "final-sosk"`) — this is the house style you're matching.
- `src/scoring.js` — `STAGE_POINTS` (note `THIRD`/`FOURTH`/`FINALIST` all exist),
  `computeStandings(group, stages, gd, tiebreak)`.

## What we're building (Option C, agreed with Kunal)
1. `scripts/sportsbook/settle.mjs` → writes `public/data/books/<id>-recap.json`.
   A **computed** grader over immutable inputs. No hand-copied numbers.
2. One **closing house-organ post per pool** ("THE HOUSE CLOSES THE BOOK", ids
   `settle-boofy` / `settle-sosk`) that tells the story in prose but **imports the
   recap JSON** for its graded tables/superlatives, plus a footer link to it from
   the live book. This is the ONE place we deviate from posts.jsx's hand-copy
   convention — flag it in a comment; a full settlement is too many numbers to
   hand-verify.

Two pools: `boofy` (12 seats, tiebreak `gd`, has `grudges`) and
`sons-of-steve-kerr` (tiebreak `shootout`, has `faction`). Handle both.

---

## THE GOVERNING PRINCIPLE — opening lines vs. lines drafted mid-tournament

The book has two kinds of markets, and the settlement treats them under ONE rule:

> **Grade every *distinct* market exactly once, at the first price the house ever
> posted on it — regardless of when that was.**

- **Standing markets** (outright, to-cash/top-3, wooden spoon, the pre-posted H2H
  pairs, SOSK's faction moneyline/spread/totals, the O/U watch ladder) were first
  posted on the **opening book** (`books/<id>.json`). They *repriced* every
  matchday, but those reprices are the same market updating on information —
  settling them would double-count, and the "price drifted" story is already told
  by the live book's LINE MOVEMENT chart. So: grade at the **opening price**.
- **Append-only specials** (Caleb's Corner / "Prozan's Parlay Window" slips, plus
  any grudge/H2H pairs added later) are **genuinely new markets** — a slip like
  "Dante steals second on goal difference" could only be hung once the bracket made
  it possible. Each has its own `since` debut and its own posted price. Grade each
  at its **debut price**, once.

Both cases collapse to the same sentence: *first-posted price, once per market.*
That's the clean, defensible thesis of the whole page — "here is the reckoning on
every line the house ever hung, priced at the moment it was hung." Opening-day and
mid-tournament lines are peers, not two systems.

**Where to read the market archive.** The immutable record of what was actually
published is the committed dated sheets: `public/data/books/<id>/<D>.json` (plus
the opening `books/<id>.json`). Walk them in date order via
`books/<id>/index.json`. For each market:
- Standing markets: take the entry from the **opening** book.
- Specials/grudges/H2H: take the **union across all sheets**, keyed by a stable
  identity (normalized `label` for specials; the team pair for H2H/grudges),
  **first occurrence wins** (that's the debut price). A slip that appears on
  sheets 07-13→07-18 is graded once, at its 07-13 number.

Do NOT read prices out of `build-books.mjs` CONFIG — read the committed JSON
sheets. The sheets are the artifact that was published; the config is the recipe.

**Confirm with Kunal before building** (default = as written above): settle
standing markets at OPENING price (recommended) vs. CLOSING price. Closing lines on
a decided market are trivially ~100% and dull, and duplicate the movement chart —
opening is the honest "day-one read" grade. Recommend opening; let him overrule.

---

## settle.mjs — spec

**Inputs:** `public/data/results.json` (final `stages` + `gd`),
`public/data/groups/<id>.json` (seat→teams), the committed book sheets above.

**Standings & points.** `src/scoring.js` can't be `import`ed by Node (it evaluates
`import.meta.env` at module load and defines the fetch seam). Either (a) extract
`STAGE_POINTS` + `pointsForStage` + `computeStandings` into a pure sibling both
import, or (b) re-derive in settle.mjs — the logic is ~15 lines. Prefer (a); it
kills the duplication. Use each book's own `tiebreak` (boofy `gd`, SOSK
`shootout`). Note `THIRD`/`FOURTH`/`FINALIST` map to their point values already.

**Grading a bet.** For every posted selection produce
`{market, label, price, result: "WON"|"LOST"|"PUSH", stake:10, ret}`:
- Parse American odds (`"+43000"`, `"−165"` — note the unicode minus U+2212 in the
  data, not ASCII `-`). `ret` on a $10 WON = `10 + 10*odds/100` (fav:
  `10 + 10*100/|odds|`); LOST = `0`; PUSH = `10` (stake back).
- **Dead heats** split per the book's house rule. With `tiebreak:"gd"` a true tie
  needs equal points AND equal GD; `shootout` leaves a points tie shared. A
  place-market dead heat pays `stake * (places_left / runners_tied)` at the posted
  price (standard dead-heat reduction) — apply where a top-3/place selection lands
  in a shared rank straddling the payout line.
- Grade each market type against `results.json`: outright = did that seat finish
  1st; to-cash = top 3; spoon = last; H2H/grudge = which named seat finished
  higher; O/U rung = seat's final points vs the line; faction ML/spread/total =
  the faction battle's final aggregate. Specials: evaluate the literal condition in
  the slip (many are compound — "Spain lift the Cup AND Dante ties Rob on GD" —
  encode the predicate; do NOT try to NLP the label, hand-encode each special's
  condition keyed by its stable id).

**The house's night.** Model one $10 win ticket on **every posted selection** (each
outright runner, each to-cash runner, each spoon runner, each named side of every
H2H/grudge, each O/U rung as posted, each faction line, each special). Report
`taken = 10 * nTickets`, `paid = Σ ret`, `hold = taken - paid`, `holdPct`. The vig
makes `hold > 0` — that's the "house always wins" payoff. Break it out per market
so the post can show where the house made its money.

**Superlatives** (compute from the graded set):
- `ticketOfTournament`: the WON bet with the longest posted odds (biggest cashed
  longshot).
- `badBeat`: the LOST bet with the smallest final margin. Define margin per market
  where it's meaningful (standings/outright/spoon = points-or-GD gap to flipping;
  O/U = |points − line|; GD-tiebreak specials = the GD delta). Omit markets with no
  natural margin rather than inventing one.
- `specialsThatCashed`: the specials slips graded WON, with debut price and $10 ret.

**Output shape** (`public/data/books/<id>-recap.json`) — design it to be consumed
by the post JSX, roughly:
```jsonc
{
  "id": "boofy", "generated": "2026-07-20",
  "standings": [{ "rank":1, "player":"…", "points":8, "gd":4, "payout":"$200",
                  "teams":[{name,stage,points,gd}] }],
  "markets": {
    "outright": [{label, price, result, stake, ret, margin?}],
    "toCash": [...], "spoon": [...], "h2h": [...], "grudges": [...],
    "faction": [...], "watch": [...], "specials": [{…, since}]
  },
  "house": { "taken":…, "paid":…, "hold":…, "holdPct":…, "byMarket":{…} },
  "superlatives": { "ticketOfTournament":{…}, "badBeat":{…}, "specialsThatCashed":[…] }
}
```
Keep every price a string exactly as posted; keep `ret` a number rounded to cents.

---

## Presentation

- **Post per pool** in `src/posts.jsx` (`settle-boofy`, `settle-sosk`), rendered by
  the existing `Post.jsx` / `?post=<id>` route — no new route, no new idiom. Reuse
  the existing `Standings`/`Slips`/`Lines` helpers; add a `Recap`-style table that
  takes rows from the imported JSON and renders WON/LOST/PUSH chips + $10 results.
  Import the recap JSON at the top of posts.jsx (static import of the committed
  file) so numbers are computed, not hand-typed. Voice: match the finals posts
  (dry house-desk narrator, "THE WHY" column energy, sourcing footer).
- Sections, per the original brief: final standings + payouts; every market
  restated with chips and $10 results; **THE HOUSE'S NIGHT** (taken vs paid);
  superlatives (ticket of the tournament, worst bad beat, which specials cashed).
- **Footer link:** add the recap link to the book footer (`src/Sportsbook.jsx`),
  shown only once `<id>-recap.json` exists, and to the finals posts' footers.

## Guardrails
- **Never reprice a posted sheet.** settle.mjs only READS sheets + results and
  WRITES `<id>-recap.json`. It must not run build-books or touch any `<D>.json`.
  Before you finish: `node scripts/sportsbook/build-books.mjs --check-open` must
  still PASS and `git diff` on `public/data/books/<id>/` must be EMPTY.
- **Do not commit or deploy without asking Kunal.** (Standing user rule.)
- Co-author trailer on any commit names the model you actually are.

## Verify
1. `node scripts/sportsbook/settle.mjs` → inspect both `<id>-recap.json` by hand;
   spot-check a few grades against `results.json` (e.g. Spain seat outright WON;
   an eliminated seat's outright LOST; the +43000 "Matt wins pool" special LOST).
   Sanity-check `house.hold > 0`.
2. `npm run dev`, open `?post=settle-boofy` and `?post=settle-sosk` with the
   preview tools; check console clean, tables render, chips correct, footer links
   resolve. Screenshot for Kunal.
3. Re-run the two guardrail checks above; confirm no historic sheet moved.

## Open decisions to confirm with Kunal before building
1. Opening vs closing price for standing markets (recommend **opening**).
2. Ticket universe for "the house's night" = $10 on every posted selection
   (recommend yes — makes the vig visible and the math well-defined).
3. One combined recap or per-pool (recommend **per-pool**, mirroring the finals
   posts and the two distinct house rules).