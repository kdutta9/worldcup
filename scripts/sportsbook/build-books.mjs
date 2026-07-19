// Build the sportsbook JSON for every pool group: run one big batch of
// tournament simulations, score each pool's draw against every simulated
// tournament, then price the markets with the house margin.
//
//   node scripts/sportsbook/build-books.mjs [sims]                # opening books → public/data/books/<id>.json
//   node scripts/sportsbook/build-books.mjs --date 2026-06-15     # conditioned snapshot → public/data/books/<id>/<date>.json
//   node scripts/sportsbook/build-books.mjs --backfill [--force]  # snapshot every match date (+ any rest-gap date whose consensus has landed)
//   node scripts/sportsbook/build-books.mjs --check-open          # verify a zero-match build reproduces the committed open books
//
// Dated snapshots are pure derivations of public/data/matches.json (≤ date) and
// the freshest consensus file ≤ date: matches already played are replayed as
// fixed results, alive teams are re-calibrated to that day's devigged title
// consensus, and only the remaining tournament is randomized. Fixed seeds per
// date make every snapshot reproducible from the log alone.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  TEAM_NAMES,
  TEAM_INDEX,
  GROUP_OF,
  STAGE,
  STAGE_POINTS,
  CONSENSUS_TITLE_ODDS,
  targetTitleProbs,
} from "./data.mjs";
import { simulateTournament, mulberry32 } from "./engine.mjs";
import { deriveState, buildCondition, loadMatches } from "./state.mjs";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const SIMS = Number(argv.find((a) => /^\d+$/.test(a)) ?? 400000);
const DATE_ARG = opt("--date");
const BACKFILL = argv.includes("--backfill");
const FORCE = argv.includes("--force");
const CHECK_OPEN = argv.includes("--check-open");
const OPEN_SEED = 20260611; // the committed opening books' seed — do not change

// How a pool breaks a dead heat is a per-pool rule with its own timeline, read
// off each pool's `tiebreakRule` config the same way every other dated timeline
// is (see `latestSince`). Three rules: "split" (the default — a dead heat shares
// the place), "gd" (goal difference decides), and "shootout" (a level pool goes
// to penalties). Both pools adopted "gd" the day the final was set (2026-07-15);
// SOSK then swapped it for "shootout" on 2026-07-18 while Boofy kept "gd". The
// rule has to reach inside the batch, not just the display: whether a level
// finish shares credit or is broken on GD changes the tie probability the
// shootout markets price. Gating by date keeps --check-open green and every
// prior sheet reproducible: before a pool's first entry it splits, as it always
// did, and those sheets are history.
const tiebreakRuleOf = (poolId, date) => latestSince(CONFIG[poolId]?.tiebreakRule ?? [], date)?.rule ?? "split";

// Sheets on dates with no match — the reprint that carries a round's line across
// a rest gap. The tournament ends July 19 but the log stops on the 15th, so the
// four days of championship week would otherwise post no line at all. A date here
// is built only once a consensus file exists for it *exactly*, which keeps the
// wall clock out of the pipeline: the market snapshot is the day's event, so
// `npm run refresh-book` each morning fetches the market and the sheet follows.
const EXTRA_SHEET_DATES = ["2026-07-16", "2026-07-17", "2026-07-18"];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MATCHES_PATH = join(ROOT, "public/data/matches.json");
const CONSENSUS_DIR = join(ROOT, "scripts/sportsbook/consensus");
const baseRatings = (() => {
  const byName = JSON.parse(readFileSync(join(ROOT, "scripts/sportsbook/ratings.json"), "utf8"));
  return TEAM_NAMES.map((n) => byName[n]);
})();

// --- Pricing -----------------------------------------------------------------
// Margins (total book): outright ~135%, place markets ~125% per place, two-way
// sides ~107.5% each (≈115% book) — same shape as the SOSK sheet. These describe
// a FULL field; see fieldMargin for what happens as runners die.
const MARGIN = { outright: 1.35, place: 1.25, twoWay: 1.075 };

// A book's overround is a function of how many runners it's actually pricing: a
// two-way market runs ~107.5%, a twelve-runner futures board ~135%. The constants
// above only ever encoded the full-field end of that, which was invisible until
// the field collapsed to two and the outright board started charging 35% vig on a
// single coin flip — posting BOTH finalists at negative odds, a thing no real book
// has ever done, and pricing "Burnes wins the pool" (−390) differently from
// "Dante finishes above Rob" (−175) despite the two being the same event.
//
// So interpolate on the live runner count, anchored on the book's own numbers:
// a full field reproduces the original constant exactly, and two live runners give
// the two-way price the h2h board already posts. Everything between is linear.
const fieldMargin = (full, live, np) =>
  live <= 2 || np <= 2 ? MARGIN.twoWay : MARGIN.twoWay + ((live - 2) / (np - 2)) * (full - MARGIN.twoWay);

// Scaling changes what a settled-heavy board charges, so — like the tiebreak — it
// applies from the sheet it was introduced on and never reprices a posted one.
// (`--check-open` is unaffected either way: the opening book has no dead seats, so
// a full field resolves fieldMargin straight back to the original constant.)
const FIELD_MARGIN_SINCE = "2026-07-15";

function american(p) {
  const q = Math.min(p, 0.96); // cap so prices stop at ~-2400
  return q >= 0.5 ? -(100 * q) / (1 - q) : (100 * (1 - q)) / q;
}
function roundOdds(o) {
  const m = Math.abs(o);
  const step = m < 200 ? 5 : m < 1000 ? 10 : m < 3000 ? 50 : m < 10000 ? 100 : 1000;
  const r = Math.round(m / step) * step;
  return o < 0 ? -Math.max(r, 100) : Math.max(r, 100);
}
function fmt(o) {
  return o < 0 ? `−${Math.abs(o)}` : `+${o}`;
}
function price(p, margin) {
  if (p <= 0) return null; // off the board — it has never happened in the sims
  return fmt(roundOdds(american(Math.min(p * margin, 0.985))));
}

// Config timelines (watch seats, specials boards, h2h pairs) all read the same
// way: an entry carries the first date it applies, an entry with no `since` is
// the opening one, and a sheet gets the latest entry on or before its own date.
// That is what lets a seat change or a new board at a new round leave every
// earlier sheet reproducing exactly as committed.
const latestSince = (entries, date) =>
  entries
    .filter((e) => date >= (e.since ?? ""))
    .sort((x, y) => (x.since ?? "").localeCompare(y.since ?? ""))
    .at(-1) ?? null;
// --- Load pools ----------------------------------------------------------------
const groupsDir = join(ROOT, "public/data/groups");
const pools = readdirSync(groupsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(groupsDir, f), "utf8")))
  .map((g) => ({
    ...g,
    players: g.players.map((p) => ({
      name: p.name,
      teams: p.teams,
      idx: p.teams.map((t) => {
        if (!(t in TEAM_INDEX)) throw new Error(`Unknown team ${t} in ${g.id}`);
        return TEAM_INDEX[t];
      }),
    })),
  }));

// Pool-specific book config. Factions/watch/stakes mirror each group's lore;
// Boofy's faction battle slots in once the lore lands.
const CONFIG = {
  "sons-of-steve-kerr": {
    bookName: "SOSK SPORTSBOOK",
    tagline: "Official betting partner of Sons of Steve Kerr",
    stakes: { buyIn: "$30", pot: "$240", payouts: ["1st $150", "2nd $60", "3rd $30"] },
    places: 3,
    // Ties broke on goal difference from the final-morning sheet (07-15), then
    // the pool voted to hand it back to the players: from 07-18 a level pool is
    // settled by a five-kick shootout, each man in his own goal. The shootout
    // rule scores a Burnes/Chris level finish as a real dead heat again (so the
    // tie probability the shootout markets price comes back), but unlike a split
    // it's losable — one man takes the whole $30, so neither clinches on a tie.
    tiebreakRule: [
      { since: "2026-07-15", rule: "gd" },
      { since: "2026-07-18", rule: "shootout" },
    ],
    copy: {
      outright: "First place takes $150. Dead-heat rules: ties split the cash.",
      toCash: "Any money is good money ($30 still buys a burrito).",
      spoon: "Somebody has to carry the shame until 2030.",
      h2h: "The four strongest seats, priced against each other. Higher pool finish wins; tie on points = stakes returned (handled as half-win in pricing).",
      watch: "Ghana, Colombia, Australia, Algeria, South Africa, South Korea. The model's median is 6 points. Main line:",
    },
    copyFrom: [
      {
        since: "2026-07-15", // the pool ruled ties break on cumulative goal difference
        outright:
          "First place takes $150. Ties break on cumulative goal difference — every team you own, every match of the tournament. Only a dead heat on both splits the cash.",
        toCash:
          "Any money is good money ($30 still buys a burrito). Burnes and Chris are level on 9 points AND on 7 goal difference: one goal on Sunday settles the last $30.",
        h2h: "The four strongest seats, priced against each other. Higher pool finish wins; level on points goes to the better goal difference, and only a dead heat on both returns stakes.",
      },
      {
        since: "2026-07-18", // the pool dropped goal difference and now settles a level pool by shootout
        outright:
          "First place takes $150. Goal difference is out — the pool voted to settle a level finish from the penalty spot, five kicks a side, each man in his own goal. Only Burnes and Chris can reach one.",
        toCash:
          "Any money is good money ($30 still buys a burrito). Burnes and Chris are level on 9: if Argentina win, the last $30 is decided by a five-kick shootout, not by a column.",
        h2h: "The four strongest seats, priced against each other. Higher pool finish wins; tie on points = stakes returned (handled as half-win in pricing).",
      },
    ],
    // Watch timeline: HG (Hunter) drew the loaded hand pre-tournament; by the QF
    // only Colombia is live, so the seat moves to J Call — three teams still
    // standing, with the biggest swing left in the pool. The HG entry carries no
    // copy, so it falls back to copy.watch above and every prior sheet reproduces.
    watch: [
      { player: "HG", title: "HUNTER WATCH — HG TOTAL POINTS" },
      {
        since: "2026-07-07",
        player: "J Call",
        title: "J CALL WATCH — J CALL TOTAL POINTS",
        copy: "Argentina and Switzerland both through — and they collide in Saturday's quarterfinal, so J Call is guaranteed a semifinalist. The pool's most live hand. The model's median is 10 points. Main line:",
      },
      {
        since: "2026-07-11",
        player: "J Call",
        title: "J CALL WATCH — J CALL TOTAL POINTS",
        copy: "He played himself Saturday and Argentina survived Switzerland 3–1 in extra time — saved, the group insists, by a phantom second yellow on Embolo. Argentina is his only live hand now, tied atop the pool with Arnst, and it draws Oanta's England in the semifinal. The model's median is 11 points. Main line:",
      },
      {
        since: "2026-07-14",
        player: "J Call",
        title: "J CALL WATCH — J CALL TOTAL POINTS",
        copy: "Spain's rout of France reshaped the whole top of the board, but J Call's Argentina is still standing and still his most live hand. Beat Oanta's England and he's in the final with a live title shot at Spain; lose and he's frozen at 10 — either way he is banked into the podium. The model's median is 10 points. Main line:",
      },
      {
        since: "2026-07-15",
        player: "J Call",
        title: "J CALL WATCH — J CALL TOTAL POINTS",
        copy: "Argentina beat Oanta's England 2–1 in Atlanta and Jacob Call is banked on eleven with a finalist in hand — and the final is Sunday, July 19, which happens to be his birthday. There are exactly two numbers left on his ticket: 11 if Spain win, 14 if Argentina do. Nothing in between, which is why the ladder below is a cliff rather than a slope. The model's median is 11 points. Main line:",
      },
    ],
    faction: {
      title: "THE DKE CIVIL WAR — OLD DKE VS NEW DKE",
      blurb:
        "Faction battle: combined points, all teams each side. The scoring system hands out exactly 65 points every tournament — this is a zero-sum war, and the margin is always odd, so the moneyline can't push.",
      a: { name: "OLD DKE", players: ["HG", "Prozan", "Arnst", "Oanta"] },
      b: { name: "NEW DKE", players: ["Burnes", "J Call", "Kunal", "Chris"] },
    },
    joints: [
      { id: "prozan-parlay", type: "teamsReach", teams: ["United States", "Brazil"], stage: "QF" },
      // Both Saturday quarterfinal winners: Norway over England, Argentina over
      // Switzerland — reaching the SF is exactly winning the QF.
      { id: "hawaii-west", type: "teamsReach", teams: ["Norway", "Argentina"], stage: "SF" },
      // The all-underdog Saturday: both dogs bite, and SF-102 becomes Norway vs
      // Switzerland — a Cinderella semifinal with no top-four seed in it.
      { id: "hawaii-west-chaos", type: "teamsReach", teams: ["Norway", "Switzerland"], stage: "SF" },
      // The two co-leaders' teams sit in opposite semifinals (France in SF-101,
      // Argentina in SF-102), so "both reach the final" is exactly an Arnst-vs-J-Call
      // title match — the SOSK mirror of Boofy's Rob-vs-Rob final.
      { id: "callarnst-final", type: "teamsReach", teams: ["Argentina", "France"], stage: "RUNNER_UP" },
      // Arnst is frozen at 10 (France out): locked onto the podium, barred from
      // first. He drops from 2nd to sole 3rd only when TWO seats clear 10 — Spain
      // champion (Burnes 12) AND Argentina in the final (J Call 11). Both at once.
      { id: "arnst-third", type: "teamStages", reqs: [["Spain", "CHAMPION"], ["Argentina", "RUNNER_UP"]] },
    ],
    specials: {
      title: "PROZAN'S PARLAY WINDOW — DEGEN SPECIALS",
      blurb:
        "Prozan is in the pool, which the house considers a market inefficiency. These are the slips he has actually asked for. Cash up front — we know him.",
      // No corner on pre-R16 SOSK sheets (no opening board). R16 kickoff, then QF.
      boards: [
        {
          since: "2026-07-03", // the sheet read the morning of R16 kickoff
          bets: [
            { label: "Prozan wins the pool (the ladder out of the basement exists)", kind: "winsPool", player: "Prozan" },
            { label: "Prozan cashes top 3", kind: "cashes", player: "Prozan" },
            { label: "The Prozan special — USA AND Brazil both reach the quarters", kind: "joint", id: "prozan-parlay" },
            { label: "USA win the whole thing", kind: "teamReaches", team: "United States", stage: "CHAMPION" },
            { label: "Canada lift the trophy (Burnes insists he's never even been)", kind: "teamReaches", team: "Canada", stage: "CHAMPION" },
          ],
        },
        {
          since: "2026-07-06", // QF field set. Prozan's own window slammed shut with USA + Brazil.
          // Owner-native lines: pool finishes, seat-vs-seat duels, point props — priced off
          // the sim but distinct from the raw team futures on the main board.
          blurb:
            "Prozan's own window slammed shut the day USA and Brazil went home — he's a dead-last statue frozen on 4 points. So the house keeps his name on the marquee and books everyone else's action. Cash up front — we know the type.",
          bets: [
            { label: "The QF-98 leapfrog — Burnes (Spain) runs down Chris (Belgium), the fallen favorite's revenge", kind: "outscores", player: "Burnes", other: "Chris" },
            { label: "House money — Kunal (Norway) outscores Oanta (England) in the QF-99 mirror", kind: "outscores", player: "Kunal", other: "Oanta" },
            { label: "J Call storms the lead — Argentina, Egypt AND Switzerland all still standing, wins the pool", kind: "winsPool", player: "J Call" },
            { label: "Arnst runs away and hides — France and Morocco both live, Over 13.5 points", kind: "overPts", player: "Arnst", line: 13.5 },
            { label: "HG crashes the podium — Colombia alone drags him into the top 3", kind: "cashes", player: "HG" },
          ],
        },
        {
          since: "2026-07-07", // R16 complete, three-way tie at 9. Arnst and J Call each play themselves in the QFs.
          // Prozan's window retires with its statue; the Saturday doubleheader
          // will be watched at Hawaii West, so the bar takes over the marquee.
          title: "HAWAII WEST SPECIALS — THE SATURDAY WINDOW",
          blurb:
            "Saturday's doubleheader — Norway–England and Argentina–Switzerland — will be watched, as tradition demands, at Hawaii West, the worst (best) bar in San Francisco. Prozan's window is retired with its statue. These are the bar's lines. Cash up front — the jukebox doesn't take IOUs.",
          bets: [
            { label: "J Call beats J Call (Argentina vs Switzerland, both his) and wins the pool", kind: "winsPool", player: "J Call" },
            { label: "Kunal (Norway) outscores Oanta (England) — settled on the pitch Saturday, adjudicated at the bar", kind: "outscores", player: "Kunal", other: "Oanta" },
            { label: "The leapfrog lives — Burnes (Spain) still runs down Chris (Belgium), Friday is the whole ballgame", kind: "outscores", player: "Burnes", other: "Chris" },
            { label: "Arnst plays himself Thursday and his survivor reaches the final — Over 10.5 points", kind: "overPts", player: "Arnst", line: 10.5 },
            { label: "The Hawaii West parlay — Norway AND Argentina both win Saturday, drinks on the doubters", kind: "joint", id: "hawaii-west" },
          ],
        },
        {
          since: "2026-07-08", // QF morning: three-way tie at 9 (J Call, Chris, Arnst). Two of the three
          // drew both teams in a single quarterfinal, so they clinch a semifinalist without lifting a finger.
          // The DKE Civil War is mathematically over (New DKE clinched), so the bar's card is the whole show.
          title: "HAWAII WEST SPECIALS — QF MORNING",
          blurb:
            "Three seats knotted at the top on 9 — and two of them, J Call and Arnst, drew both sides of a quarterfinal, so nobody but themselves can knock them out of the lead. Chris has to beat Spain to keep pace. The DKE Civil War is settled — New DKE clinched it the day the bracket set — so Hawaii West takes the marquee. Doors open early Thursday for France–Morocco, loosies on the bar at a dollar a stick. Cash up front; the jukebox still doesn't take IOUs.",
          bets: [
            { label: "The logjam breaks his way — J Call, guaranteed a semifinalist (Argentina vs Switzerland, both his), wins the pool", kind: "winsPool", player: "J Call" },
            { label: "Battle of the men who play themselves — J Call (Argentina/Switzerland) finishes above Arnst (France/Morocco)", kind: "outscores", player: "J Call", other: "Arnst" },
            { label: "The leapfrog, now on Friday — Burnes (Spain) runs down Chris (Belgium) head-to-head", kind: "outscores", player: "Burnes", other: "Chris" },
            { label: "Chris holds serve — the fallen favorite (Belgium) beats Spain and cashes top 3", kind: "cashes", player: "Chris" },
            { label: "The Hawaii West parlay — Norway AND Argentina both reach the semis, drinks on the doubters", kind: "joint", id: "hawaii-west" },
          ],
        },
        {
          since: "2026-07-09", // QF-97 final: France 2, Morocco 0. Morocco was already locked at 3 (banked
          // reaching the QF), so Arnst's floor ticks up exactly one point on France's SF banking — the
          // three-way logjam barely moves. The doubleheader is now the whole show, so the bar's card
          // gets two more standalone Saturday lines instead of just the combined parlay.
          title: "HAWAII WEST SPECIALS — DOORS OPEN SATURDAY",
          blurb:
            "France 2, Morocco 0 — Arnst nets exactly one point for it, since Morocco was already locked at 3 and France just moved up a rung to the semis. Barely dents the three-way logjam at the top. The real business is Saturday's doubleheader, so the bar opens the card wide: loosies on the counter at a dollar a stick, the jukebox still doesn't take IOUs.",
          bets: [
            { label: "The logjam breaks his way — Jacob Call wins the pool", kind: "winsPool", player: "J Call" },
            { label: "Battle of the men who play themselves — J Call (Argentina/Switzerland) finishes above Arnst, now with a one-point bigger cushion", kind: "outscores", player: "J Call", other: "Arnst" },
            { label: "The leapfrog, now on Friday — Burnes (Spain) runs down Chris (Belgium) head-to-head", kind: "outscores", player: "Burnes", other: "Chris" },
            { label: "Kunal (Norway) outscores Oanta (England) — Saturday at Hawaii West, adjudicated over a poorly mixed Mai Tai", kind: "outscores", player: "Kunal", other: "Oanta" },
            { label: "Oanta's last stand — top 3 or nothing, and it hinges on England getting past Erling Haaland", kind: "cashes", player: "Oanta" },
            { label: "The Hawaii West parlay — Norway AND Argentina both reach the semis, drinks on the doubters", kind: "joint", id: "hawaii-west" },
          ],
        },
        {
          since: "2026-07-10", // QF-98: Spain 2, Belgium 1. Belgium out freezes Chris solid at 9 (every
          // team eliminated) and reframes the leapfrog — Burnes can only catch him by taking Spain THROUGH
          // France in the semi. And the bracket locked a France–Spain semifinal: Arnst and Burnes, the
          // pool's top two, collide for a single finalist's ticket. Everything else runs through Saturday.
          title: "HAWAII WEST SPECIALS — THE SATURDAY DOUBLEHEADER",
          blurb:
            "Spain 2, Belgium 1 — and the bracket sets a cruel one: Arnst's France meets Burnes's Spain in the semifinal, the pool's top two colliding for a single ticket to the final. Chris is a statue at 9, every team he owns eliminated, guarding the last podium rung. Everything else runs through Saturday's doubleheader at Hawaii West — Norway–England and Argentina–Switzerland, the second of which is J Call playing himself. Loosies a dollar a stick; the jukebox still doesn't take IOUs.",
          bets: [
            { label: "The leapfrog reborn — Burnes (Spain) runs down the frozen Chris (Belgium), but only through France: Spain reaching the final ties it at 9, only the trophy passes him", kind: "outscores", player: "Burnes", other: "Chris" },
            { label: "The statue holds — Chris, every team eliminated, cashes top 3 anyway; dead-heat rules split the cash, so even a tie pays", kind: "cashes", player: "Chris" },
            { label: "Arnst runs it back — France, the tournament favorite, lifts the Cup and he clears Over 12.5 points", kind: "overPts", player: "Arnst", line: 12.5 },
            { label: "J Call beats J Call — Argentina vs Switzerland on Saturday, both his, so he can't lose a semifinalist, and rides the survivor to win the pool", kind: "winsPool", player: "J Call" },
            { label: "The Saturday mirror — Kunal (Norway) outlasts Oanta (England), settled on the pitch, adjudicated over a poorly mixed Mai Tai", kind: "outscores", player: "Kunal", other: "Oanta" },
            { label: "Chaos at Hawaii West — Norway AND Switzerland both pull the Saturday upset and turn SF-102 into a Cinderella semifinal, drinks on the doubters", kind: "joint", id: "hawaii-west-chaos" },
          ],
        },
        {
          since: "2026-07-11", // QF-99/100: England 2, Norway 1 and Argentina 3, Switzerland 1 (ET).
          // J Call played himself (Argentina vs Switzerland) and Argentina survived, so the
          // four live seats are now EXACTLY the four semifinalists, one owner each, all drawn
          // into duels: Arnst (France) vs Burnes (Spain) Tuesday, J Call (Argentina) vs Oanta
          // (England) Wednesday. The Saturday doubleheader is spent — its parlays retire — so
          // the marquee passes to the man who organized the whole thing at Hawaii West.
          title: "THE OANTA INVITATIONAL — PRESENTED BY HAWAII WEST",
          blurb:
            "Saturday at Hawaii West was, by unanimous panel vote, beast — two good TVs, a full ashtray, loosies a dollar a stick, and Oanta the man who organized it. So the semifinal card carries his name. The cruelty of the draw: every live seat is now a semifinalist, and they're paired off. Arnst (France) meets Burnes (Spain) Tuesday — a co-leader against the leapfrog. J Call (Argentina) meets Oanta (England) Wednesday — a co-leader against the host himself, who has to lift the actual trophy to crash his own party. Chris is a statue at 9, every team eliminated, guarding the last podium rung. Cash up front; the jukebox still doesn't take IOUs.",
          bets: [
            { label: "J Call beats the host — Argentina past Oanta's England on Wednesday — and wins the pool", kind: "winsPool", player: "J Call" },
            { label: "Arnst answers the co-leader — France past Burnes's Spain on Tuesday, and he clears Over 12.5 points", kind: "overPts", player: "Arnst", line: 12.5 },
            { label: "The co-leaders collide for the Cup — Argentina AND France both reach the final, J Call vs Arnst for everything", kind: "joint", id: "callarnst-final" },
            { label: "The leapfrog, last leg — Burnes (Spain) runs down the frozen Chris, but only the trophy does it: a final merely ties, and it's through Arnst's France first", kind: "outscores", player: "Burnes", other: "Chris" },
            { label: "Oanta crashes his own party — the man who threw the Saturday needs England to win the whole thing to cash top 3", kind: "cashes", player: "Oanta" },
            { label: "The statue holds — Chris, every team eliminated, cashes top 3 anyway; dead-heat rules split the cash, so even a tie pays", kind: "cashes", player: "Chris" },
          ],
        },
        {
          since: "2026-07-14", // SF-101: Spain 2, France 0. France out freezes Arnst solid at 10 —
          // locked onto the podium (a champion always clears 10) but barred from first. Spain in the
          // final lifts Burnes's floor to 9 and makes "Spain wins the Cup" worth the whole pool to him.
          // The other final seat is the noon England–Argentina semi: Oanta vs J Call, winner faces Spain.
          title: "THE OANTA INVITATIONAL — THE LAST SEMIFINAL",
          blurb:
            "Spain 2, France 0 — the tournament favorite is dead and Spain is in the final. That froze Arnst at 10: locked onto the podium, barred from first, only the size of his check still live. Burnes now holds the whole pool in one result — Spain lifting the Cup is the $150. The other seat in the final is settled at noon at Hawaii West: Oanta's England vs J Call's Argentina, winner faces Spain, loser is done. Cash up front; the jukebox still doesn't take IOUs.",
          bets: [
            { label: "Burnes wins the pool — Spain lifts the Cup and the $150 is his; the board's favorite", kind: "winsPool", player: "Burnes" },
            { label: "Oanta wins the pool — England beats Argentina, then dethrones Spain in the final", kind: "winsPool", player: "Oanta" },
            { label: "J Call wins the pool — Argentina beats England, then dethrones Spain in the final", kind: "winsPool", player: "J Call" },
            { label: "Arnst holds second — frozen at 10, locked onto the podium, he keeps at least a share of the $60 spot in every outcome but one", kind: "jointNot", id: "arnst-third" },
            { label: "Arnst slips to sole third — the lone exception: Argentina reaches the final AND Spain wins it, stacking two seats above him", kind: "joint", id: "arnst-third" },
            { label: "Chris steals a podium — frozen at 9, every team dead, he backs into a shared third only if Argentina wins the whole thing", kind: "cashes", player: "Chris" },
          ],
        },
        {
          since: "2026-07-15", // SF-102: Argentina 2, England 1 — Messi assists in the 85th and the
          // 90+2nd. The field is now exactly two live seats, Burnes (Spain) and J Call (Argentina),
          // and whichever one's team lifts the Cup wins the pool outright. Everything below them is
          // frozen and sorted by the new goal-difference tiebreak, which is where the cruelty lives:
          // Burnes and Chris are tied on 9 points AND on 7 goal difference right now, so a Spain
          // defeat drops Burnes below Chris by exactly one goal — unless it's a shootout, which
          // leaves Spain's GD untouched and dead-heats them for the $30.
          title: "THE BIRTHDAY INVITATIONAL — JULY 19, THE FINAL",
          blurb:
            "The final is Sunday, July 19. Sunday, July 19 is Jacob Call's birthday. Jacob Call owns Argentina. The house has stopped pretending this is a coincidence and simply put his name on the marquee. Two seats are live and they are the two finalists' owners — Burnes bought Spain in June, J Call has Argentina, and whichever team lifts the Cup, that man wins the pool. There is no third road. Beneath them the new goal-difference rule has already quietly settled almost everything: Arnst is frozen on 10 and playing only for the size of his check, and Chris — a statue on 9 since Belgium died — is tied with Burnes on points AND on goal difference, which means one goal on Sunday decides the last $30. Cash up front; the jukebox still doesn't take IOUs.",
          bets: [
            { label: "Burnes wins the pool — he bought Spain in June and Spain lifting the Cup on Sunday is the entire $150", kind: "winsPool", player: "Burnes" },
            { label: "The birthday boy takes it all — Argentina win on July 19, Jacob Call's actual birthday, and the pool is his", kind: "winsPool", player: "J Call" },
            { label: "Arnst's check is Burnes's problem — frozen on 10, he is second if Spain lose and third if Spain win, and he cannot lift a finger either way", kind: "outscores", player: "Arnst", other: "Burnes" },
            { label: "The one-goal tiebreak — Chris, every team dead, takes third off Burnes because Spain losing drops their goal difference below his 7", kind: "outscores", player: "Chris", other: "Burnes" },
            { label: "Burnes salvages something — Spain lift the Cup, or Argentina need a shootout, which leaves Spain's goal difference untouched and dead-heats the last $30", kind: "cashes", player: "Burnes" },
          ],
        },
        {
          since: "2026-07-18", // The pool amended its own rulebook: goal difference is out, and a
          // level pool now settles from the penalty spot — five kicks, each man in his own goal.
          // GD is off for SOSK from this sheet (see tiebreakRule), so a Burnes/Chris tie is a real
          // dead heat in the sim again. That has one and only one trigger: Argentina winning the
          // Cup drops Burnes to nine, level with the frozen Chris, and the last $30 goes to kicks.
          // The `ties` line prices that trigger off the sim; the two `prob` lines are the shootout
          // itself, which the tournament model can't touch — Chris played high school soccer, Burnes
          // kept goal for the DKE side that won the Berkeley IM title, and the house has a read.
          title: "THE BIRTHDAY INVITATIONAL — THE SHOOTOUT",
          blurb:
            "The final is today — July 19, Jacob Call's birthday, Jacob Call's Argentina, the house long past pretending that's a coincidence. Two seats are live and both are finalists' owners: Spain lifts the Cup and Burnes takes the $150, Argentina lifts it and J Call does. The pool tore up the goal-difference rule it wrote last week and handed the tiebreak back to the players — a level finish now goes to a five-kick shootout, each man keeping his own goal. It can only ever happen one way: Argentina win, Burnes falls to nine beside the frozen Chris, and the last $30 is decided from twelve yards. Chris played high school soccer. Burnes won a Berkeley IM title in goal. Cash up front; the jukebox still doesn't take IOUs.",
          bets: [
            { label: "Burnes wins the pool — he bought Spain in June and Spain lifting the Cup on Sunday is the entire $150", kind: "winsPool", player: "Burnes" },
            { label: "The birthday boy takes it all — Argentina win on July 19, Jacob Call's actual birthday, and the pool is his", kind: "winsPool", player: "J Call" },
            { label: "Arnst's check is Burnes's problem — frozen on 10, he is second if Spain lose and third if Spain win, and he cannot lift a finger either way", kind: "outscores", player: "Arnst", other: "Burnes" },
            { label: "To the spot — Argentina win, Burnes and Chris finish level on nine, and the last $30 is settled by a five-kick shootout", kind: "ties", player: "Burnes", other: "Chris" },
            { label: "Burnes wins the shootout — a shootout is a goalkeeper's document, and he owns a Berkeley IM title in goal", kind: "prob", p: 0.55 },
            { label: "Chris wins the shootout — high school soccer against an IM-league DKE legend in goal, and the taker always fancies himself", kind: "prob", p: 0.45 },
          ],
        },
      ],
    },
  },
  boofy: {
    bookName: "BOOFY SPORTSBOOK",
    tagline: "Official betting partner of Boofy",
    stakes: { buyIn: "$20", pot: "$260", payouts: ["1st $200", "2nd $40", "3rd $20"] },
    places: 3,
    // Boofy adopted goal difference on the final-morning sheet and kept it — no
    // shootout amendment here, so it runs "gd" from 07-15 onward.
    tiebreakRule: [{ since: "2026-07-15", rule: "gd" }],
    copy: {
      outright: "First place takes $200 even — Dante topped up the pot. Dead-heat rules: ties split the cash.",
      toCash: "Twelve seats, three podium spots. Any money is good money.",
      spoon: "Somebody has to carry the shame until 2030.",
      h2h: "The four strongest seats, priced against each other. Higher pool finish wins; tie on points = stakes returned (handled as half-win in pricing).",
    },
    copyFrom: [
      {
        since: "2026-07-15", // the pool ruled ties break on cumulative goal difference
        outright:
          "First place takes $200 even — Dante topped up the pot, and Nathan has already won it. Ties break on cumulative goal difference — every team you own, every match of the tournament.",
        toCash:
          "Twelve seats, three podium spots, two of them settled. The tiebreak decided the rest in advance: Dante beats Rob by six goals if they tie on 8, Dino beats Max by seven on 7.",
        h2h: "The seats with something left to settle. Higher pool finish wins; level on points goes to the better goal difference, and only a dead heat on both returns stakes.",
      },
    ],
    // Watch timeline: Kunal drew a loaded hand pre-tournament; by the QF all four
    // of his teams were out, so the seat moves to Rob (England + France, both live).
    watch: [
      {
        player: "Kunal",
        title: "KUNAL WATCH — KUNAL TOTAL POINTS",
        copy: "Germany, Brazil, South Korea, Netherlands — the house's problem child drew a loaded hand. The model's median is 8 points. Main line:",
      },
      {
        since: "2026-07-06",
        player: "Rob",
        title: "ROB WATCH — ROB TOTAL POINTS",
        copy: "England and France both through to the quarters — on opposite sides of the bracket, the biggest live hand in the pool. The model's median is 11 points. Main line:",
      },
      {
        since: "2026-07-07",
        player: "Rob",
        title: "ROB WATCH — ROB TOTAL POINTS",
        copy: "England and France both banked the quarters, on opposite halves — they can only meet in the final. The model's median is 9 points. Main line:",
      },
      {
        since: "2026-07-10",
        player: "Rob",
        title: "ROB WATCH — ROB TOTAL POINTS",
        copy: "France has already banked its semifinal — and drew Spain in it — while England still has to get past Norway on Saturday. Opposite halves: the two can only ever meet in the final. The model's median is 11 points. Main line:",
      },
      {
        since: "2026-07-11",
        player: "Rob",
        title: "ROB WATCH — ROB TOTAL POINTS",
        copy: "Both England and France are through to the semifinals now, on opposite halves — France meets Spain Tuesday, England meets Argentina Wednesday — so the house owns both sides of the bracket and the two can only reunite in the final. The model's median is 12 points. Main line:",
      },
      {
        since: "2026-07-14",
        player: "Rob",
        title: "ROB WATCH — ROB TOTAL POINTS",
        copy: "France died in the semifinal and took the Rob-vs-Rob final with it — but England is still Rob's, and England vs Nathan's Argentina decides the whole pool: win it and Rob banks a finalist and the title is his to lose; lose it and he settles for runner-up in the pool at 8. The model's median is 9 points. Main line:",
      },
      {
        since: "2026-07-15",
        player: "Dante",
        title: "DANTE WATCH — DANTE TOTAL POINTS",
        copy: "England lost and Rob is a statue on 8 — the Watch moves to the last seat in the pool with a pulse. Dante has Spain, Spain are in the final, and his whole summer is two numbers: 8 if they lift the Cup, 5 if they don't. Eight ties Rob and beats him on goal difference for second and $40; five is sixth place and nothing. The model's median is 8 points. Main line:",
      },
    ],
    faction: null,
    // Explicit H2H pairs from the Spain-in-final sheet on; before that the auto
    // shelf (top four by expected points) still governs, so earlier sheets are
    // untouched. Settled pairs are filtered out of the view, so each entry lists
    // only what's still live on that date.
    h2hPairs: [
      {
        // Two duels: Rob vs Nathan for the pool, and Dante (Spain, needs the
        // title) vs the two frozen, tied sevens — Dino & Max moved together
        // under dead-heat rules, so one line off Dino covered both.
        since: "2026-07-14",
        pairs: [
          { a: "Rob", b: "Nathan" },
          { a: "Dante", b: "Dino", bLabel: "Dino & Max" },
        ],
      },
      {
        // The goal-difference tiebreak divorced Dino and Max — Dino wins that
        // pair 12 to 5 in every branch, so it's settled and comes off the board.
        // Nathan has clinched, England is dead: the only live questions left are
        // Dante's Spain against Rob for second, and against Dino for the last chair.
        since: "2026-07-15",
        pairs: [
          { a: "Dante", b: "Rob" },
          { a: "Dante", b: "Dino" },
        ],
      },
    ],
    grudges: {
      title: "BAD BLOOD — GRUDGE MATCHES",
      blurb:
        "Some matchups are about money. These are not. Higher pool finish settles it; tie on points = stakes returned, beef continues.",
      pairs: [
        { a: "Shaya", b: "Jake", note: "THE FOREVER FEUD" },
        { a: "Shaya", b: "Matt", note: "YES, SHAYA AGAIN" },
      ],
    },
    joints: [
      { id: "shaya-sweep", type: "sweep", player: "Shaya", over: ["Jake", "Matt"] },
      // England and France sit on opposite bracket halves — they can only meet
      // in the final, so "both reach the final" is exactly the Rob-vs-Rob final.
      { id: "rob-final", type: "teamsReach", teams: ["England", "France"], stage: "RUNNER_UP" },
    ],
    specials: {
      title: "CALEB'S CORNER — DEGEN SPECIALS",
      blurb:
        "Caleb is not in the pool. That has never once stopped him. The house posts the slips he'd actually ask for, and reserves the right to demand cash up front.",
      boards: [
        {
          // Opening board (no `since`). Three of its five slips died with Matt
          // and Shaya's group-stage exits; kept intact so opening books reprice.
          bets: [
            { label: "Matt wins the whole pool (Panama · Uzbekistan · Curaçao · Haiti)", kind: "winsPool", player: "Matt" },
            { label: "Matt cashes top 3", kind: "cashes", player: "Matt" },
            { label: "Shaya sweeps the beef — finishes above Jake AND Matt", kind: "joint", id: "shaya-sweep" },
            { label: "Kunal goes nuclear — Over 14.5 pts", kind: "overPts", player: "Kunal", line: 14.5 },
            { label: "Rob bricks it — Under 4.5 pts with England AND France", kind: "underPts", player: "Rob", line: 4.5 },
          ],
        },
        {
          since: "2026-07-03", // the sheet read the morning of R16 kickoff
          bets: [
            { label: "Adrian wins the whole pool (Paraguay, and only Paraguay, remain)", kind: "winsPool", player: "Adrian" },
            { label: "Dante rises from 11th — cashes top 3 on Spain alone", kind: "cashes", player: "Dante" },
            { label: "Rob bricks it — Under 4.5 pts with England AND France", kind: "underPts", player: "Rob", line: 4.5 },
            { label: "Paraguay, slayers of Germany, reach the semifinal", kind: "teamReaches", team: "Paraguay", stage: "SF" },
            { label: "Hosts with the most — Mexico win the whole thing", kind: "teamReaches", team: "Mexico", stage: "CHAMPION" },
          ],
        },
        {
          since: "2026-07-06", // QF field set; the R16 board's Paraguay/Mexico/Adrian slips are all dead.
          // Owner-native lines — pool finishes, seat duels, point props — not raw team futures.
          bets: [
            { label: "Rob goes nuclear — England AND France both live and in the quarters, Over 12.5 points", kind: "overPts", player: "Rob", line: 12.5 },
            { label: "Dante climbs from 10th — cashes top 3 on Spain alone", kind: "cashes", player: "Dante" },
            { label: "The QF-96 derby — Jake (Switzerland) finishes above Jack (Colombia), settled tomorrow", kind: "outscores", player: "Jake", other: "Jack" },
            { label: "Nathan survives his own civil war (Argentina vs Egypt, both his) and wins the pool", kind: "winsPool", player: "Nathan" },
            { label: "The full Cinderella — Morocco, and only Morocco, wins Dino the entire pool", kind: "winsPool", player: "Dino" },
          ],
        },
        {
          since: "2026-07-07", // R16 complete: three-way tie at 7, Rob in two of the four QFs, Kunal dead.
          bets: [
            { label: "“One more closer to the money” — Jake texts his way onto the podium, cashes top 3", kind: "cashes", player: "Jake" },
            { label: "The final is Rob vs Rob — England AND France both reach it", kind: "joint", id: "rob-final" },
            { label: "Rob goes nuclear — Over 12.5 points", kind: "overPts", player: "Rob", line: 12.5 },
            { label: "Max, a dirty Brit, sends England home on Saturday and wins the whole pool", kind: "winsPool", player: "Max" },
            { label: "Dante climbs from the basement — cashes top 3 on Spain alone", kind: "cashes", player: "Dante" },
          ],
        },
        {
          since: "2026-07-08", // QF morning: three-way tie at 7 (Dino, Max, Nathan). Rob, one back with
          // England AND France, personally lines up against two of the three co-leaders this week.
          title: "CALEB'S CORNER — QF MORNING",
          blurb:
            "Three seats knotted at 7 — Dino, Max, Nathan — and the man one point back drew both England and France, so Rob personally lines up against two of the three co-leaders: his France meets Dino's Morocco on Thursday, his England meets Max's Norway on Saturday. Caleb has a slip on every inch of it. Cash up front — he knows the drill.",
          bets: [
            { label: "Rob runs the table — France past Morocco, England past Norway, he laps the field, Over 12.5 points", kind: "overPts", player: "Rob", line: 12.5 },
            { label: "The final is Rob vs Rob — England AND France both reach it", kind: "joint", id: "rob-final" },
            { label: "The full Cinderella survives — Morocco (Dino) knocks out Rob's France and wins the pool", kind: "winsPool", player: "Dino" },
            { label: "Max, a dirty Brit, sends England home Saturday and wins the whole pool", kind: "winsPool", player: "Max" },
            { label: "One more closer to the money — Switzerland takes down Argentina for Jake", kind: "outscores", player: "Jake", other: "Nathan" },
          ],
        },
        {
          since: "2026-07-09", // QF-97 final: France 2, Morocco 0. Dino's whole roster is cooked —
          // Iran, Portugal, Canada, Morocco, every seat frozen — so the Cinderella slip and the
          // Rob-vs-Rob joint both retire; Rob's lone remaining leg (England, Saturday) is the new
          // single line. Three quarterfinals left decide almost the entire rest of the field.
          title: "CALEB'S CORNER — ONE DOWN, THREE TO GO",
          blurb:
            "France 2, Morocco 0 — book it. Dino's Cinderella died with the final whistle; Iran, Portugal, Canada, Morocco, all four teams cooked, he's frozen on 7 points for the rest of his natural life. Rob banked his semifinalist and pulls clear at the top of the pool with just England left to close it out Saturday. Spain–Belgium Friday and the Norway–England / Argentina–Switzerland doubleheader Saturday settle basically everyone else's summer. Caleb has a slip on what's left. Cash up front — he knows the drill.",
          bets: [
            { label: "Rob runs the table — Over 12.5 points with an England vs France final", kind: "overPts", player: "Rob", line: 12.5 },
            { label: "Max, a dirty Brit, wins the whole pool — step one is sending England home Saturday", kind: "winsPool", player: "Max" },
            { label: "One more closer to the money — Jake climbs past Nathan in the pool, riding Switzerland's shot at Argentina", kind: "outscores", player: "Jake", other: "Nathan" },
            { label: "Dante's Inferno — top 3 or bust, and it starts with Spain getting past Belgium Friday", kind: "cashes", player: "Dante" },
            { label: "The last two with a pulse — Max (Norway) outlasts Dante (Spain) for whatever's left on the board", kind: "outscores", player: "Max", other: "Dante" },
          ],
        },
        {
          since: "2026-07-10", // QF-98: Spain 2, Belgium 1. Belgium out kills Nick (dead at 6) and hands
          // Dante's Spain a semifinal — against Rob's France. Every game the pool has left is now a
          // seat-vs-seat collision: Rob's England vs Max's Norway and Nathan's Argentina vs Jake's
          // Switzerland on Saturday, Rob's France vs Dante's Spain in the semifinal.
          title: "CALEB'S CORNER — THE BOOFY CIVIL WAR",
          blurb:
            "Spain 2, Belgium 1 — book it, then watch what it did to the bracket. Every match Boofy has left is one seat's team against another's: Saturday it's Rob's England vs Max's Norway and Nathan's Argentina vs Jake's Switzerland; the semifinal is Rob's France against Dante's Spain, the runaway leader trying to bury the basement's last hope. Nick is dead — Belgium was his only pulse, frozen at 6. Caleb has a slip on every collision. Cash up front — he knows the drill.",
          bets: [
            { label: "Rob laps the field — England AND France both alive on opposite halves, so they can only meet in the final, and he wins the pool", kind: "winsPool", player: "Rob" },
            { label: "Dante's Inferno — his entire summer is Spain, and cashing top 3 means Spain lifting the actual trophy; a final isn't enough, it has to be the whole thing", kind: "cashes", player: "Dante" },
            { label: "Dead but not buried — Dino, every team he owns eliminated, frozen on 7, still cashes top 3 if the climbers all stall", kind: "cashes", player: "Dino" },
            { label: "Nathan needs Argentina — step one is beating Jake's Switzerland in Saturday's all-Boofy quarterfinal, then the pool is his", kind: "winsPool", player: "Nathan" },
            { label: "Max, a dirty Brit, sends Rob's England home Saturday and rides Norway to the whole pool", kind: "winsPool", player: "Max" },
            { label: "One more closer to the money — Jake climbs past Nathan, riding Switzerland's shot at Argentina", kind: "outscores", player: "Jake", other: "Nathan" },
          ],
        },
        {
          since: "2026-07-11", // QF-99/100: England 2, Norway 1 and Argentina 3, Switzerland 1 (ET).
          // The semifinal bracket is a Rob ambush: he owns France AND England, drawn into
          // opposite semifinals, so he is personally the opponent both live challengers must
          // beat — his France meets Dante's Spain Tuesday, his England meets Nathan's Argentina
          // Wednesday. Max's Norway was knocked out by England — his own country — freezing him
          // at 7 beside the equally-frozen Dino.
          title: "CALEB'S CORNER — THE FINAL BOSS",
          blurb:
            "England 2, Norway 1; Argentina 3, Switzerland 1 in extra time — and the bracket hands the house its edge. Rob owns both France and England, drawn into opposite semifinals, so every live contender has to go through one of his teams: Dante's Spain meets Rob's France on Tuesday, Nathan's Argentina meets Rob's England on Wednesday. Win both and it's an England–France final with a single seat holding the trophy AND the runner-up. Max — a dirty Brit — watched his Norway get knocked out by England, his own country, and sits frozen at 7 next to Dino, both praying the boring team stays boring. Caleb has a slip on all of it. Cash up front — he knows the drill.",
          bets: [
            { label: "The final is Rob vs Rob — England AND France both reach it, the trophy and the runner-up landing on one seat", kind: "joint", id: "rob-final" },
            { label: "Rob laps the field — two live semifinalists on opposite halves, and he wins the pool", kind: "winsPool", player: "Rob" },
            { label: "Nathan's only road runs through Rob — Argentina has to beat England on Wednesday, then the pool is his", kind: "winsPool", player: "Nathan" },
            { label: "Dante's Inferno, last chamber — top 3 means Spain lifting the actual trophy, a final isn't enough, and it starts by getting past Rob's France", kind: "cashes", player: "Dante" },
            { label: "Killed by his own country — Max, a dirty Brit whose Norway fell to England, is frozen at 7 and still cashes top 3 if Spain stays boring", kind: "cashes", player: "Max" },
            { label: "Dead but not buried — Dino, every team he owns eliminated, frozen on 7, cashes top 3 if the climbers all stall", kind: "cashes", player: "Dino" },
          ],
        },
        {
          since: "2026-07-14", // SF-101: Spain 2, France 0. France out froze Rob's France at 4 and
          // killed the Rob-vs-Rob final for good — but Rob still owns England, and the noon
          // England–Argentina semifinal now decides the entire pool: the winner's owner (Rob with
          // England, Nathan with Argentina) banks a finalist and clears every frozen seat. Dante's
          // Spain is in the final; his max is 8, so he takes the last podium spot only by winning it all.
          title: "CALEB'S CORNER — ONE GAME FOR THE POOL",
          blurb:
            "Spain 2, France 0 — and the Rob-vs-Rob final everyone dreaded died with it. But look what it left: Rob still owns England, Nathan owns Argentina, and their teams meet at noon for the final. Whoever wins banks a finalist and clears the whole frozen field — so this one semifinal IS the pool. Dante's Spain is already in the final, but his ceiling is 8: he grabs the last podium chair only if Spain actually lifts the Cup. Caleb has a slip on all of it. Cash up front — he knows the drill.",
          bets: [
            { label: "Rob wins the pool — his England beats Nathan's Argentina and it's over", kind: "winsPool", player: "Rob" },
            { label: "Nathan wins the pool — his Argentina beats Rob's England and the $200 is his", kind: "winsPool", player: "Nathan" },
            { label: "Dante takes the last podium spot — but only if his Spain wins the whole thing; a runner-up leaves him a point short", kind: "cashes", player: "Dante" },
            { label: "Dino and Max back into third — the two frozen sevens (Cinderella's corpse and a dirty Brit killed by his own country) split the last seat if Spain loses the final", kind: "cashes", player: "Dino" },
          ],
        },
        {
          since: "2026-07-15", // SF-102: Argentina 2, England 1. Rob's England is dead and Nathan has
          // mathematically clinched the $200. What's left is $40 and $20 — and the goal-difference
          // tiebreak has already decided most of it in advance: Dante beats Rob (+4 to −2) if they
          // tie on 8, and Dino beats Max (12 to 5) in the tie on 7 that both are frozen into. Max
          // therefore cashes in ZERO branches, so his slip comes off the board entirely. The
          // third-place game is a non-event: Rob owns England AND France, so it's a wash on his ledger.
          title: "CALEB'S CORNER — LIVE FROM NICK'S PLACE",
          blurb:
            "Sunday's final is at Nick's place. Nick has been dead since the quarterfinal — Belgium was his only pulse, frozen on 6 — and he is hosting the party regardless, which the house finds both tragic and extremely on brand. Caleb will be in attendance, in person, for the first time all tournament, and the house can finally explain why he has never been in this pool: Boofy needed a twelfth man, the group asked Caleb because Caleb is a degenerate gambler — the entire reason his name is on these lines — and Caleb said no. The seat went to Nathan. Nathan has clinched the $200 and will collect it on Sunday in Caleb's eyeline. The face of this sportsbook declined the only bet that ever mattered. What's left is $40, $20, and a goal-difference rule that settled three of the four remaining questions before kickoff — Dante beats Rob by six goals if they tie, Dino beats Max by seven, and Max, a dirty Brit whose Norway was knocked out by England, now cashes in exactly zero outcomes. Cash up front — he knows the drill.",
          bets: [
            { label: "Dante steals second — Spain lift the Cup, he ties Rob on 8, and takes it on goal difference, +4 to −2", kind: "outscores", player: "Dante", other: "Rob" },
            { label: "Rob salvages the $40 — Spain lose, Dante stalls on 5, and runner-up is the last thing England and France ever bought him", kind: "outscores", player: "Rob", other: "Dante" },
            { label: "Dino backs into the last chair — dead since the quarterfinal, he needs Spain to lose, then beats Max to it by seven goals neither of them can touch", kind: "cashes", player: "Dino" },
            { label: "Nathan wins the pool — the house is not taking this action and posts the number purely so it can be admired", kind: "winsPool", player: "Nathan" },
          ],
        },
      ],
    },
  },
};

// Joint events counted inside the sim loop; specials reference them by id.
// "sweep" = player strictly outscores everyone listed; "teamsReach" = every
// team listed reaches at least the stage.
const jointIdx = pools.map((pool) => {
  const at = (nm) => {
    const i = pool.players.findIndex((pl) => pl.name === nm);
    if (i < 0) throw new Error(`Unknown player "${nm}" in ${pool.id} joints`);
    return i;
  };
  return (CONFIG[pool.id]?.joints ?? []).map((j) =>
    j.type === "sweep"
      ? { id: j.id, type: j.type, p: at(j.player), over: j.over.map(at) }
      : j.type === "teamStages"
        ? { id: j.id, type: j.type, reqs: j.reqs.map(([t, s]) => [TEAM_INDEX[t], STAGE[s]]) }
        : { id: j.id, type: j.type, teams: j.teams.map((t) => TEAM_INDEX[t]), stage: STAGE[j.stage] }
  );
});

// --- Simulate ------------------------------------------------------------------
const n = TEAM_NAMES.length;
const MAXPTS = 66;

// `rules` is per-pool: an array of tiebreak-rule strings aligned to `pools`
// ("split" | "gd" | "shootout"), or a bare null for the opening build (every
// pool splits). Only the "gd" rule reads goal difference in the scoring loop;
// "split" and "shootout" both let a level finish share credit here (the shootout
// itself is priced separately, off the tie probability this produces). teamGD is
// accumulated whenever ANY pool runs GD — its presence must not depend on which
// pool, so the RNG stream stays identical to the old global-flag build for every
// historic date.
function runBatch(ratings, sims, seed, cond, rules = null) {
  const gdOf = (p) => (Array.isArray(rules) ? rules[p] === "gd" : false);
  const anyGD = Array.isArray(rules) && rules.some((r) => r === "gd");
  const stages = new Uint8Array(n);
  const pts = new Uint8Array(n);
  const teamGD = anyGD ? new Float64Array(n) : null;
  const stageCounts = Array.from({ length: n }, () => new Float64Array(7));
  const ptsSum = new Float64Array(n);

  const acc = pools.map((pool, p) => {
    const np = pool.players.length;
    return {
      hist: Array.from({ length: np }, () => new Float64Array(MAXPTS)),
      sum: new Float64Array(np),
      win: new Float64Array(np),
      top: new Float64Array(np),
      last: new Float64Array(np),
      pairWin: new Float64Array(np * np), // [i*np+j] = sims where i outscored j
      pairTie: new Float64Array(np * np),
      factionHist: new Float64Array(MAXPTS), // side A's combined total
      joint: new Float64Array(jointIdx[p].length), // sims where each joint event hit
      totals: new Float64Array(np), // scratch
      gds: new Float64Array(np), // scratch — this sim's goal difference per seat
    };
  });

  const rng = mulberry32(seed);
  console.log(`Simulating ${sims.toLocaleString()} tournaments…`);
  const t0 = Date.now();
  for (let s = 0; s < sims; s++) {
    simulateTournament(ratings, rng, stages, cond, teamGD);
    for (let t = 0; t < n; t++) {
      const st = stages[t];
      stageCounts[t][st]++;
      pts[t] = STAGE_POINTS[st];
      ptsSum[t] += pts[t];
    }
    for (let p = 0; p < pools.length; p++) {
      const pool = pools[p];
      const a = acc[p];
      const np = pool.players.length;
      const useGD = gdOf(p);
      const totals = a.totals;
      const gds = a.gds;
      for (let i = 0; i < np; i++) {
        let tot = 0;
        for (const ti of pool.players[i].idx) tot += pts[ti];
        totals[i] = tot;
        a.hist[i][tot]++;
        a.sum[i] += tot;
        if (useGD) {
          let g = 0;
          for (const ti of pool.players[i].idx) g += teamGD[ti];
          gds[i] = g;
        }
      }
      // Dead-heat credits for win / top-places / last. Seats are ordered on
      // points, then — once the tiebreak is live — on goal difference, so a
      // dead heat now needs both to match and the split is genuinely rare.
      const cfg = CONFIG[pool.id];
      const places = cfg?.places ?? 3;
      for (let i = 0; i < np; i++) {
        let above = 0;
        let below = 0;
        let ties = 0;
        for (let j = 0; j < np; j++) {
          const d = totals[j] - totals[i] || (useGD ? gds[j] - gds[i] : 0);
          if (d > 0) above++;
          else if (d < 0) below++;
          else ties++;
          if (j > i) {
            if (d < 0) a.pairWin[i * np + j]++;
            else if (d > 0) a.pairWin[j * np + i]++;
            else a.pairTie[i * np + j]++;
          }
        }
        if (above === 0) a.win[i] += 1 / ties;
        a.top[i] += Math.min(Math.max(places - above, 0), ties) / ties;
        a.last[i] += Math.min(Math.max(1 - below, 0), ties) / ties;
      }
      for (let k = 0; k < jointIdx[p].length; k++) {
        const jt = jointIdx[p][k];
        const hit =
          jt.type === "sweep"
            ? jt.over.every((j) => totals[jt.p] > totals[j])
            : jt.type === "teamStages"
              ? jt.reqs.every(([t, s]) => stages[t] >= s)
              : jt.teams.every((t) => stages[t] >= jt.stage);
        if (hit) a.joint[k]++;
      }
      if (cfg?.faction) {
        let totA = 0;
        for (const name of cfg.faction.a.players) totA += totals[pool.players.findIndex((pl) => pl.name === name)];
        a.factionHist[totA]++;
      }
    }
  }
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { stageCounts, ptsSum, acc };
}

// --- Conditional calibration -------------------------------------------------------
// Refit alive teams' ratings (warm-started from the committed pre-tournament fit)
// until CONDITIONAL championship probabilities match the day's consensus.
// Eliminated teams keep their stale ratings — they may still play out dead-rubber
// group matches, but the market has nothing to say about them. The alive-team
// mean is pinned so their level relative to eliminated opponents doesn't drift.
function calibrateConditional(target, cond, { iters = 16, sims = 50000, seedBase }) {
  const alive = target.map((p) => p > 0);
  const nAlive = alive.filter(Boolean).length;
  const tSum = target.reduce((s, p, i) => s + (alive[i] ? p : 0), 0);
  const tN = target.map((p, i) => (alive[i] ? p / tSum : 0));
  const r = baseRatings.slice();
  const meanOf = () => r.reduce((s, v, i) => s + (alive[i] ? v : 0), 0) / nAlive;
  const mean0 = meanOf();
  const stages = new Uint8Array(n);
  let err = Infinity;
  console.log(`Calibrating ${nAlive} alive teams to consensus (${iters}×${sims.toLocaleString()} sims)…`);
  for (let it = 0; it < iters; it++) {
    const eta = it < 6 ? 0.5 : it < 12 ? 0.3 : 0.15;
    const rng = mulberry32(seedBase + 1000 + it);
    const titles = new Float64Array(n);
    for (let s = 0; s < sims; s++) {
      simulateTournament(r, rng, stages, cond);
      for (let t = 0; t < n; t++) if (stages[t] === STAGE.CHAMPION) titles[t]++;
    }
    err = 0;
    for (let t = 0; t < n; t++) {
      if (!alive[t]) continue;
      const simP = (titles[t] + 0.5) / (sims + nAlive * 0.5); // Laplace keeps longshot gradients finite
      const g = Math.log(tN[t]) - Math.log(simP);
      err += Math.abs(g) * tN[t];
      r[t] += eta * g;
    }
    const shift = mean0 - meanOf();
    for (let t = 0; t < n; t++) if (alive[t]) r[t] += shift;
  }
  console.log(`Calibration done, weighted |Δlog| = ${err.toFixed(4)}`);
  return { ratings: r, err: +err.toFixed(4) };
}

// --- Derive markets --------------------------------------------------------------
const histStats = (hist, sims) => {
  let cum = 0;
  let median = 0;
  for (let v = 0; v < MAXPTS; v++) {
    cum += hist[v];
    if (cum >= sims / 2) {
      median = v;
      break;
    }
  }
  return median;
};
const pOver = (hist, sims, line) => {
  let c = 0;
  for (let v = Math.ceil(line); v < MAXPTS; v++) c += hist[v];
  return c / sims;
};
const bestLine = (hist, sims, lo = 0.5, hi = 64.5) => {
  let best = lo;
  let bestGap = Infinity;
  for (let line = lo; line <= hi; line += 1) {
    const gap = Math.abs(pOver(hist, sims, line) - 0.5);
    if (gap < bestGap) {
      bestGap = gap;
      best = line;
    }
  }
  return best;
};
const trimHist = (hist, sims) => {
  // Drop the long tail of sub-0.25% bars — they render as empty pixels.
  let max = MAXPTS - 1;
  while (max > 0 && hist[max] / sims < 0.0025) max--;
  return Array.from({ length: max + 1 }, (_, v) => ({ pts: v, pct: +((hist[v] / sims) * 100).toFixed(2) }));
};

// Mathematical lock/elimination bounds per pool seat: a team that's out is
// frozen at its reached stage; an alive team could in principle win it all.
// Sound (never flags a live market settled), if conservative the other way.
// Banked stage for standings/bounds: a semifinal winner awaiting the final has
// reached runner-up (5), though stageOf holds it at SF for the "Finalist" label.
function bankedStage(state, t) {
  return state.finalists?.has(t) ? STAGE.RUNNER_UP : state.stageOf[t] ?? STAGE.GROUP;
}

function playerBounds(pool, state) {
  const min = [];
  const max = [];
  const gd = [];
  const frozen = [];
  for (const pl of pool.players) {
    let lo = 0;
    let hi = 0;
    let g = 0;
    for (const t of pl.teams) {
      const reached = STAGE_POINTS[bankedStage(state, t)];
      lo += reached;
      hi += state.eliminated.has(t) ? reached : STAGE_POINTS[STAGE.CHAMPION];
      g += state.cumGD[t] ?? 0;
    }
    min.push(lo);
    max.push(hi);
    gd.push(g);
    frozen.push(pl.teams.every((t) => state.eliminated.has(t)));
  }
  return { min, max, gd, frozen };
}

// Order two seats by what the fixtures still permit, never by the sim. A seat
// with a team alive has unbounded goal difference, so GD only decides a pair
// once BOTH are frozen — then their points and their GD are equally final and
// the tiebreak settles them for good. Without that guard an exact points tie
// between two dead seats would sit "live" forever while the sim quietly priced
// one of them at zero.
function boundsCmp(bounds, rule) {
  const { min, max, gd, frozen } = bounds;
  const gdMode = rule === "gd";
  // A level finish is "losable" — a threat either seat can go under — whenever
  // the rule actually breaks ties: goal difference or a shootout. Under the
  // original "split" rule a dead heat shares the place, so it threatens nobody.
  const losable = rule === "gd" || rule === "shootout";
  const tiedFrozen = (i, j) => gdMode && frozen[i] && frozen[j] && min[i] === min[j];
  return {
    // j finishes strictly above i in every outcome that remains. A level finish
    // is only ever "sure" under GD, and only once both seats are frozen — a
    // shootout is never sure for either side, so it adds nothing here.
    surelyAbove: (j, i) => min[j] > max[i] || (tiedFrozen(i, j) && gd[j] > gd[i]),
    // j could still finish strictly above i. Split: only a higher ceiling
    // threatens i. GD: a tie is losable unless both are frozen and i owns the
    // better goal difference. Shootout: a tie is losable, full stop — either man
    // can win from the spot, so j's ceiling merely reaching i's floor threatens.
    couldBeAbove: (j, i) =>
      max[j] > min[i] ||
      (losable && max[j] === min[i] && (!gdMode || !(frozen[i] && frozen[j]) || gd[j] > gd[i])),
  };
}

function marketStatuses(bounds, places, rule) {
  const { surelyAbove, couldBeAbove } = boundsCmp(bounds, rule);
  const np = bounds.min.length;
  const win = [];
  const cash = [];
  const spoon = [];
  for (let i = 0; i < np; i++) {
    const others = [...Array(np).keys()].filter((j) => j !== i);
    win.push(
      others.some((j) => surelyAbove(j, i))
        ? "dead"
        : others.every((j) => surelyAbove(i, j))
          ? "locked"
          : null
    );
    cash.push(
      others.filter((j) => surelyAbove(j, i)).length >= places
        ? "dead"
        : others.filter((j) => couldBeAbove(j, i)).length <= places - 1
          ? "locked"
          : null
    );
    spoon.push(
      others.some((j) => surelyAbove(i, j))
        ? "dead"
        : others.every((j) => surelyAbove(j, i))
          ? "locked"
          : null
    );
  }
  return { win, cash, spoon };
}

// A faction side clinches when its guaranteed floor clears a strict majority of
// the 65 points. Floor = banked points now + one advancement point for every
// still-to-play knockout in which BOTH teams belong to that side (one of them
// must win and move up a stage). A rigorous lower bound — deeper same-side
// collisions, unknown until earlier rounds resolve, can only add to it — so it
// never flags a live battle decided, unlike reading a 0-in-400k sim count.
function factionClinch(pool, faction, state) {
  const teamsOf = (nm) => pool.players[pool.players.findIndex((pl) => pl.name === nm)].teams;
  const sideOfTeam = {};
  const floor = { a: 0, b: 0 };
  for (const side of ["a", "b"]) {
    for (const nm of faction[side].players) {
      for (const t of teamsOf(nm)) {
        sideOfTeam[t] = side;
        floor[side] += STAGE_POINTS[bankedStage(state, t)];
      }
    }
  }
  const matchStage = (id) =>
    id <= 88 ? STAGE.R32 : id <= 96 ? STAGE.R16 : id <= 100 ? STAGE.QF : id <= 102 ? STAGE.SF : STAGE.RUNNER_UP;
  for (const [idStr, teams] of Object.entries(state.koTeams)) {
    const id = Number(idStr);
    const [x, y] = teams;
    if (id === 103 || state.ko[id] || !x || !y) continue; // bronze / already played / unresolved
    const side = sideOfTeam[x];
    if (side && side === sideOfTeam[y]) {
      const s = matchStage(id);
      floor[side] += STAGE_POINTS[s + 1] - STAGE_POINTS[s];
    }
  }
  const need = Math.floor(65 / 2) + 1; // 33 — strict majority of the 65 points
  return floor.a >= need ? "a" : floor.b >= need ? "b" : null;
}

// One pool's book from a finished batch. `snapshot` is null for the opening
// build; for dated builds it carries meta + decided-market detection inputs.
function deriveBook(pool, p, batch, sims, snapshot) {
  const cfg = CONFIG[pool.id];
  if (!cfg) return null;
  const { stageCounts, ptsSum, acc } = batch;
  const a = acc[p];
  const np = pool.players.length;
  const players = pool.players.map((pl, i) => ({
    name: pl.name,
    teams: pl.teams,
    avg: +(a.sum[i] / sims).toFixed(1),
    median: histStats(a.hist[i], sims),
    pWin: a.win[i] / sims,
    pTop: a.top[i] / sims,
    pLast: a.last[i] / sims,
  }));

  // The pool's tiebreak rule on this sheet: "split" (dead heats share), "gd"
  // (goal difference decides), or "shootout" (a level pool goes to penalties).
  // Only "gd" surfaces a goal-difference column; the shootout is priced in the
  // specials off the tie probability, not shown as a standings number.
  const rule = snapshot?.tiebreak?.[p] ?? "split";
  const showGD = rule === "gd";
  const statuses = snapshot
    ? marketStatuses(playerBounds(pool, snapshot.state), cfg.places ?? 3, rule)
    : null;

  // Per-market margins, scaled by how many runners that market is actually
  // pricing. A settled seat isn't a runner — it carries no price — so a board
  // down to two live names is a two-way market and gets charged like one.
  const liveRunners = (sts) => (sts ? sts.filter((s) => !s).length : np);
  const scaled = (snapshot?.date ?? "") >= FIELD_MARGIN_SINCE;
  const marginOf = (full, sts) => (scaled ? fieldMargin(full, liveRunners(sts), np) : full);
  const M = {
    outright: marginOf(MARGIN.outright, statuses?.win),
    cash: marginOf(MARGIN.place, statuses?.cash),
    spoon: marginOf(MARGIN.place, statuses?.spoon),
  };

  const row = (i, p, margin, status) => ({
    player: players[i].name,
    teams: players[i].teams,
    price: status ? null : price(p, margin),
    fairPct: +(p * 100).toFixed(1),
    ...(status ? { status } : {}),
  });

  const byWin = [...players.keys()].sort((x, y) => players[y].pWin - players[x].pWin);
  const byLast = [...players.keys()].sort((x, y) => players[y].pLast - players[x].pLast);

  // Banked points and still-alive teams as of this sheet's date, so a dated
  // sheet's outright panel can double as the live standings table. Only emitted
  // on dated snapshots — the opening book stays as originally committed (and
  // check-open stays green), and no historical sheet is rewritten unless rebuilt.
  // `gd` rides along only once the tiebreak is live — it's the number that now
  // separates tied seats, and gating it keeps it off every historical sheet.
  const standingsRow = (i) => ({
    pts: players[i].teams.reduce((s, t) => s + STAGE_POINTS[bankedStage(snapshot.state, t)], 0),
    ...(showGD
      ? { gd: players[i].teams.reduce((s, t) => s + (snapshot.state.cumGD[t] ?? 0), 0) }
      : {}),
    alive: players[i].teams.filter((t) => !snapshot.state.eliminated.has(t)),
  });

  const outright = byWin.map((i) => {
    const base = row(i, players[i].pWin, M.outright, statuses?.win[i]);
    return snapshot ? { ...base, ...standingsRow(i) } : base;
  });
  const toCash = [...players.keys()]
    .sort((x, y) => players[y].pTop - players[x].pTop)
    .map((i) => row(i, players[i].pTop, M.cash, statuses?.cash[i]));
  const spoon = byLast.map((i) => row(i, players[i].pLast, M.spoon, statuses?.spoon[i]));

  // Head-to-heads, priced pairwise with ties as half-wins (dead heat = stakes
  // returned). Default is the four strongest seats by expected points, round-
  // robined; a pool may instead declare explicit pairs from a given date (with
  // an optional display label to fold tied seats into one line). Gated on date
  // so the opening book and every prior sheet keep the auto round-robin.
  const bounds = snapshot ? playerBounds(pool, snapshot.state) : null;
  const cmp = bounds ? boundsCmp(bounds, rule) : null;
  const pairSettled = (i, j) =>
    !cmp ? null : cmp.surelyAbove(i, j) ? "a" : cmp.surelyAbove(j, i) ? "b" : null;
  const h2hEntry = (i, j, aLabel, bLabel) => {
    const tie = (a.pairTie[Math.min(i, j) * np + Math.max(i, j)] ?? 0) / sims;
    const pi = a.pairWin[i * np + j] / sims + tie / 2;
    const settled = pairSettled(i, j);
    return {
      a: aLabel ?? players[i].name,
      b: bLabel ?? players[j].name,
      priceA: settled ? null : price(pi, MARGIN.twoWay),
      priceB: settled ? null : price(1 - pi, MARGIN.twoWay),
      ...(settled ? { settled } : {}),
    };
  };
  const nameIdx = (nm) => pool.players.findIndex((pl) => pl.name === nm);
  const h2h = [];
  const pairsCfg = latestSince(cfg.h2hPairs ?? [], snapshot?.date ?? "");
  if (pairsCfg) {
    for (const pr of pairsCfg.pairs) h2h.push(h2hEntry(nameIdx(pr.a), nameIdx(pr.b), pr.aLabel, pr.bLabel));
  } else {
    const shelf = [...players.keys()].sort((x, y) => players[y].avg - players[x].avg).slice(0, 4);
    for (let x = 0; x < shelf.length; x++)
      for (let y = x + 1; y < shelf.length; y++) h2h.push(h2hEntry(shelf[x], shelf[y]));
  }

  // Watch section: O/U ladder + points distribution for the featured seat.
  // `watch` may be a single seat (static) or a timeline of {since, player,
  // title, copy}: pick the latest entry on or before the sheet date, so a seat
  // change at a new round doesn't rewrite the watch on historical sheets. When
  // the chosen entry carries its own `copy`, it overrides copy.watch.
  const date = snapshot?.date ?? "";
  const watchCfg = latestSince(Array.isArray(cfg.watch) ? cfg.watch : [cfg.watch], date);
  const wIdx = pool.players.findIndex((pl) => pl.name === watchCfg.player);
  const wHist = a.hist[wIdx];
  const main = bestLine(wHist, sims);
  const ladder = [];
  for (let line = Math.max(0.5, main - 3); line <= main + 5; line += 1) {
    const po = pOver(wHist, sims, line);
    if (po <= 0 || po >= 1) continue; // settled rungs come off the board
    ladder.push({ line, over: price(po, MARGIN.twoWay), under: price(1 - po, MARGIN.twoWay) });
  }
  const watch = {
    player: watchCfg.player,
    title: watchCfg.title,
    teams: pool.players[wIdx].teams,
    median: players[wIdx].median,
    mainLine: main,
    ladder,
    hist: trimHist(wHist, sims),
  };
  // Copy that changes at a round boundary — the tiebreak rewrote what a "tie"
  // even means, so the panel blurbs describing dead heats had to move with it.
  // Same timeline shape as everything else: keys here patch cfg.copy for sheets
  // on or after `since`, and earlier sheets keep the wording they were posted with.
  const { since: _since, ...copyPatch } = latestSince(cfg.copyFrom ?? [], date) ?? {};
  const copy = {
    ...cfg.copy,
    ...copyPatch,
    ...(watchCfg.copy ? { watch: watchCfg.copy } : {}),
  };

  // Faction battle (if this pool has one): moneyline, spread ±1.5, team totals.
  let faction = null;
  if (cfg.faction) {
    const fh = a.factionHist;
    const sideAvg = (names) =>
      +names.reduce((s, nm) => s + players[pool.players.findIndex((pl) => pl.name === nm)].avg, 0).toFixed(1);
    const pAWin = pOver(fh, sims, 32.5);
    const lineA = bestLine(fh, sims);
    // Margin is always odd: +1.5 covers on any win or a 1-point loss (total ≥ 32).
    const pACoverPlus = pOver(fh, sims, 31.5);
    const pBCoverMinus = 1 - pACoverPlus;
    const pBWin = 1 - pAWin;
    const pBCoverPlus = 1 - pOver(fh, sims, 33.5);
    const pACoverMinus = pOver(fh, sims, 33.5);
    const mk = (name, playersList, pWin, plus, minus, totalLine, pOverTotal) => ({
      name,
      players: playersList.map((nm) => {
        const i = pool.players.findIndex((pl) => pl.name === nm);
        return { name: nm, teams: pool.players[i].teams };
      }),
      avg: sideAvg(playersList),
      moneyline: price(pWin, MARGIN.twoWay),
      spread: pWin >= 0.5 ? { line: "−1.5", price: price(minus, MARGIN.twoWay) } : { line: "+1.5", price: price(plus, MARGIN.twoWay) },
      total: {
        line: totalLine,
        over: price(pOverTotal, MARGIN.twoWay),
        under: price(1 - pOverTotal, MARGIN.twoWay),
      },
    });
    faction = {
      title: cfg.faction.title,
      blurb: cfg.faction.blurb,
      a: mk(cfg.faction.a.name, cfg.faction.a.players, pAWin, pACoverPlus, pACoverMinus, lineA, pOver(fh, sims, lineA)),
      // B's total mirrors A's (totB = 65 − totA), so B's over is A's under.
      b: mk(cfg.faction.b.name, cfg.faction.b.players, pBWin, pBCoverPlus, pBCoverMinus, 65 - lineA, 1 - pOver(fh, sims, lineA)),
    };

    // Bracket-aware clinch: prove the battle is decided from the fixtures, not the
    // sim (a 0-in-400k longshot is not the same as a mathematical lock). A side's
    // guaranteed floor is its banked points plus one advancement point for every
    // still-to-play knockout in which BOTH teams are on that side — one of them
    // must win and advance. If a floor already clears half of the 65 points, the
    // war is over: we pull the moneyline/spread/total so nobody can bet a settled
    // result at the house cap ("free money"), and post a CLINCHED / OUT status.
    const decided = snapshot ? factionClinch(pool, cfg.faction, snapshot.state) : null;
    if (decided) {
      for (const side of ["a", "b"]) {
        faction[side].status = decided === side ? "clinched" : "eliminated";
        faction[side].moneyline = null;
        faction[side].spread = { ...faction[side].spread, price: null };
        faction[side].total = { ...faction[side].total, over: null, under: null };
      }
      faction.decided = decided;
    }
  }

  const idxOf = (nm) => pool.players.findIndex((pl) => pl.name === nm);
  const pairPrice = (i, j) => {
    const tie = a.pairTie[Math.min(i, j) * np + Math.max(i, j)] / sims;
    return a.pairWin[i * np + j] / sims + tie / 2;
  };

  // Grudge matches: lore pairs priced like any other H2H, dead heat = push.
  let grudges = null;
  if (cfg.grudges) {
    grudges = {
      title: cfg.grudges.title,
      blurb: cfg.grudges.blurb,
      pairs: cfg.grudges.pairs.map(({ a: an, b: bn, note }) => {
        const i = idxOf(an);
        const j = idxOf(bn);
        const pi = pairPrice(i, j);
        const settled = pairSettled(i, j);
        return {
          a: an,
          b: bn,
          note,
          priceA: settled ? null : price(pi, MARGIN.twoWay),
          priceB: settled ? null : price(1 - pi, MARGIN.twoWay),
          ...(settled ? { settled } : {}),
        };
      }),
    };
  }

  // Specials corner — "Caleb's Corner" in the lore, hence the field name. The
  // slips are config data, priced off the same sim accumulators as every other
  // market. `boards` is a timeline: each entry's `since` is the first date it
  // applies (a board with no `since` is the opening board). A sheet gets the
  // latest board whose `since` is on or before its date, so every historical
  // sheet — opening, R16, QF — reprices reproducibly from the same config.
  let caleb = null;
  const boardCfg = latestSince(cfg.specials?.boards ?? [], date);
  const board = boardCfg?.bets ?? null;
  if (board) {
    const jointOf = (id) => {
      const k = jointIdx[p].findIndex((j) => j.id === id);
      if (k < 0) throw new Error(`Unknown joint "${id}" in ${pool.id} specials`);
      return a.joint[k];
    };
    const pReach = (team, stage) => {
      const sc = stageCounts[TEAM_INDEX[team]];
      let c = 0;
      for (let k = STAGE[stage]; k <= STAGE.CHAMPION; k++) c += sc[k];
      return c / sims;
    };
    // Specials ride the same margins as the boards they mirror — a slip reading
    // "X wins the pool" must not disagree with X's own outright price.
    const priceBet = (bet) => {
      switch (bet.kind) {
        case "winsPool":
          return price(players[idxOf(bet.player)].pWin, M.outright);
        case "cashes":
          return price(players[idxOf(bet.player)].pTop, M.cash);
        case "lastPlace":
          return price(players[idxOf(bet.player)].pLast, M.spoon);
        case "overPts":
          return price(pOver(a.hist[idxOf(bet.player)], sims, bet.line), MARGIN.twoWay);
        case "underPts":
          return price(1 - pOver(a.hist[idxOf(bet.player)], sims, bet.line), MARGIN.twoWay);
        case "outscores":
          return price(pairPrice(idxOf(bet.player), idxOf(bet.other)), MARGIN.twoWay);
        case "ties": {
          // Both seats finish level on points — a genuine dead heat, which only
          // exists once GD is off. This is the probability the pool goes to a
          // penalty shootout, priced straight off the sim's pair-tie counter.
          const i = idxOf(bet.player);
          const j = idxOf(bet.other);
          return price((a.pairTie[Math.min(i, j) * np + Math.max(i, j)] ?? 0) / sims, MARGIN.twoWay);
        }
        case "prob":
          // A hand-set line the sim can't produce — the tournament model has no
          // opinion on two men taking penalties at each other. `p` is a lore
          // judgement (see the shootout board); it rides the same two-way vig as
          // every other side so the overround stays honest.
          return price(bet.p, MARGIN.twoWay);
        case "joint":
          return price(jointOf(bet.id) / sims, MARGIN.twoWay);
        case "jointNot":
          return price(1 - jointOf(bet.id) / sims, MARGIN.twoWay);
        case "teamReaches":
          return price(pReach(bet.team, bet.stage), bet.stage === "CHAMPION" ? MARGIN.outright : MARGIN.place);
        default:
          throw new Error(`Unknown special bet kind "${bet.kind}"`);
      }
    };
    caleb = {
      title: boardCfg.title ?? cfg.specials.title,
      blurb: boardCfg.blurb ?? cfg.specials.blurb,
      bets: board.map((b) => ({ label: b.label, price: priceBet(b) })),
    };
  }

  // Rosters: every seat's teams with tournament probabilities and fair title odds.
  const titleOddsOf =
    snapshot?.titleOddsOf ??
    ((name) => `+${CONSENSUS_TITLE_ODDS[name]}`);
  const rosters = [...players.keys()]
    .sort((x, y) => players[y].avg - players[x].avg)
    .map((i) => ({
      player: players[i].name,
      avg: players[i].avg,
      settled: bounds ? bounds.min[i] === bounds.max[i] : false,
      teams: pool.players[i].teams.map((name) => {
        const t = TEAM_INDEX[name];
        const sc = stageCounts[t];
        const ge = (st) => {
          let c = 0;
          for (let k = st; k < 7; k++) c += sc[k];
          return c / sims;
        };
        return {
          name,
          group: GROUP_OF[name],
          makeKo: +(ge(1) * 100).toFixed(1),
          qf: +(ge(3) * 100).toFixed(1),
          winCup: +(ge(6) * 100).toFixed(1),
          expPts: +(ptsSum[t] / sims).toFixed(2),
          // The market's own number, not the sim's — sim-derived odds are pure
          // noise for +100000 longshots at 400k trials.
          titleOdds: titleOddsOf(name),
        };
      }),
    }));

  return {
    id: pool.id,
    name: pool.name,
    bookName: cfg.bookName,
    tagline: cfg.tagline,
    stakes: cfg.stakes,
    copy,
    meta: snapshot
      ? {
          sims,
          generated: snapshot.date,
          date: snapshot.date,
          seed: pool.seed ?? null,
          sources: "LIVE MARKET CONSENSUS",
          consensusDate: snapshot.consensusDate,
          consensusSource: snapshot.consensusSource,
          matchesConditioned: snapshot.nMatches,
          calibrationErr: snapshot.calibrationErr,
          // Which margin schedule priced this sheet. Sheets on different bases
          // aren't price-comparable — the view suppresses ▲▼ across the change,
          // since most of that "move" would be vig, not probability. Emitted only
          // when true, so sheets predating the change are untouched.
          ...(scaled ? { marginScaled: true } : {}),
          players: np,
          teamsPerPlayer: pool.teamsPerPlayer,
        }
      : {
          sims,
          generated: "2026-06-11",
          seed: pool.seed ?? null,
          sources: "DRAFTKINGS · FANDUEL · KALSHI · ESPN CONSENSUS",
          players: np,
          teamsPerPlayer: pool.teamsPerPlayer,
        },
    outright,
    toCash,
    spoon,
    h2h,
    grudges,
    caleb,
    watch,
    faction,
    rosters,
  };
}

const bookJson = (book) => JSON.stringify(book, null, 2) + "\n";

// --- Modes ---------------------------------------------------------------------

function buildOpenBooks() {
  const batch = runBatch(baseRatings, SIMS, OPEN_SEED, null);
  return pools.map((pool, p) => deriveBook(pool, p, batch, SIMS, null)).filter(Boolean);
}

function writeOpen() {
  mkdirSync(join(ROOT, "public/data/books"), { recursive: true });
  for (const book of buildOpenBooks()) {
    const out = join(ROOT, "public/data/books", `${book.id}.json`);
    writeFileSync(out, bookJson(book));
    console.log(`Wrote ${out}`);
  }
}

function checkOpen() {
  let ok = true;
  for (const book of buildOpenBooks()) {
    const committed = readFileSync(join(ROOT, "public/data/books", `${book.id}.json`), "utf8");
    const same = bookJson(book) === committed;
    console.log(`${same ? "PASS" : "FAIL"}  ${book.id} (zero-match build vs committed opening book)`);
    ok &&= same;
  }
  process.exit(ok ? 0 : 1);
}

function resolveConsensus(date) {
  const files = existsSync(CONSENSUS_DIR)
    ? readdirSync(CONSENSUS_DIR)
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .map((f) => f.slice(0, 10))
        .sort()
    : [];
  const used = files.filter((d) => d <= date).at(-1);
  if (!used)
    throw new Error(`No consensus file ≤ ${date} in ${CONSENSUS_DIR} — run npm run fetch-consensus first.`);
  const parsed = JSON.parse(readFileSync(join(CONSENSUS_DIR, `${used}.json`), "utf8"));
  if (used !== date) console.log(`No consensus for ${date}; falling back to ${used}`);
  return parsed;
}

function buildSnapshot(date) {
  console.log(`\n=== Snapshot ${date} ===`);
  const upTo = loadMatches(MATCHES_PATH).filter((m) => m.date <= date);
  const state = deriveState(upTo);
  const cond = buildCondition(state);
  const consensus = resolveConsensus(date);
  // Eliminations are enforced here, not just at fetch time — a fallback to an
  // earlier consensus file must not resurrect a team knocked out since.
  const target = TEAM_NAMES.map((t) => (state.eliminated.has(t) ? 0 : consensus.probs[t] ?? 0));

  // A zero-match build against the pre-tournament consensus IS the opening book:
  // same ratings, same seed, bit-identical markets.
  const base = targetTitleProbs();
  const isOpenEquivalent = !cond && target.every((p, i) => Math.abs(p - base[i]) < 1e-5);
  let ratings = baseRatings;
  let calibrationErr = null;
  let seed = OPEN_SEED;
  if (!isOpenEquivalent) {
    seed = Number(date.replaceAll("-", "")); // deterministic per snapshot date
    ({ ratings, err: calibrationErr } = calibrateConditional(target, cond, { seedBase: seed }));
  } else {
    console.log("Zero matches + pre-tournament consensus → reusing committed ratings/seed");
  }

  const tiebreak = pools.map((pool) => tiebreakRuleOf(pool.id, date));
  const batch = runBatch(ratings, SIMS, seed, cond, tiebreak);
  const snapshot = {
    date,
    tiebreak,
    state,
    nMatches: upTo.length,
    consensusDate: consensus.date,
    consensusSource: consensus.source,
    calibrationErr,
    titleOddsOf: (name) => {
      if (state.stageOf[name] === STAGE.CHAMPION) return "WON";
      const p = consensus.probs[name] ?? 0;
      if (state.eliminated.has(name) || p <= 0) return "OUT";
      if (p >= 0.985) return "WON";
      return fmt(roundOdds(american(p)));
    },
  };
  for (let p = 0; p < pools.length; p++) {
    const book = deriveBook(pools[p], p, batch, SIMS, snapshot);
    if (!book) continue;
    const dir = join(ROOT, "public/data/books", book.id);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, `${date}.json`);
    writeFileSync(out, bookJson(book));
    updateIndex(book.id, date);
    console.log(`Wrote ${out}`);
  }
}

function updateIndex(poolId, date) {
  const path = join(ROOT, "public/data/books", poolId, "index.json");
  const index = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { entries: ["open"] };
  if (!index.entries.includes(date)) {
    index.entries = ["open", ...index.entries.filter((e) => e !== "open"), date].sort((x, y) =>
      x === "open" ? -1 : y === "open" ? 1 : x < y ? -1 : 1
    );
    writeFileSync(path, JSON.stringify(index, null, 2) + "\n");
  }
}

function backfill() {
  const all = loadMatches(MATCHES_PATH);
  const matchDates = [...new Set(all.map((m) => m.date))];
  if (!matchDates.length) {
    console.log("No matches in the log — nothing to backfill.");
    return;
  }
  // A rest-gap date joins the queue only once its own market snapshot has been
  // fetched — no consensus file, no sheet, no guessing at future dates.
  const gapDates = EXTRA_SHEET_DATES.filter((d) => existsSync(join(CONSENSUS_DIR, `${d}.json`)));
  const dates = [...new Set([...matchDates, ...gapDates])].sort();
  for (const date of dates) {
    // A sheet built before that day's results landed (a morning-of build)
    // conditions on fewer matches than the log now holds — rebuild it.
    const nUpTo = all.filter((m) => m.date <= date).length;
    const isGap = !matchDates.includes(date);
    const fresh = (pool) => {
      if (!CONFIG[pool.id]) return true;
      const f = join(ROOT, "public/data/books", pool.id, `${date}.json`);
      if (!existsSync(f)) return false;
      const meta = JSON.parse(readFileSync(f, "utf8")).meta;
      // A gap sheet exists to carry that day's market, so it's stale until it
      // has actually been priced off that day's own consensus.
      return meta?.matchesConditioned === nUpTo && (!isGap || meta?.consensusDate === date);
    };
    if (pools.every(fresh) && !FORCE) {
      console.log(`Skip ${date} (snapshot fresh; --force to rebuild)`);
      continue;
    }
    buildSnapshot(date);
  }
}

if (CHECK_OPEN) checkOpen();
else if (BACKFILL) backfill();
else if (DATE_ARG) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE_ARG)) throw new Error(`Bad --date "${DATE_ARG}"`);
  buildSnapshot(DATE_ARG);
} else writeOpen();
