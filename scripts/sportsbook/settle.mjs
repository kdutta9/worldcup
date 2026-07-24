// Settlement grader: reads immutable inputs (results, groups, committed book
// sheets), computes final standings, grades every market the house ever posted
// at its debut price, and writes src/data/books/<id>-recap.json.
//
// This script ONLY READS sheets and results and WRITES recap JSON. It never
// touches build-books, never runs simulations, never modifies any <D>.json.
//
// NOTE: This is the ONE place the settlement deviates from the hand-copy
// convention — the recap has too many numbers to hand-verify, so it imports
// from scoring-core and computes everything from the committed data files.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  STAGE_POINTS,
  STAGE_LABEL,
  pointsForStage,
  computeStandings,
} from "../../src/scoring-core.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

// ── Pool configs (stakes + tiebreak, not imported from build-books) ──────────
const POOLS = {
  boofy: {
    tiebreak: "gd",
    payouts: { 1: 200, 2: 40, 3: 20 },
    places: 3,
  },
  "sons-of-steve-kerr": {
    tiebreak: "shootout",
    payouts: { 1: 150, 2: 60, 3: 30 },
    places: 3,
  },
};

// ── Odds parsing ─────────────────────────────────────────────────────────────
// Prices in the sheets use Unicode minus (U+2212), not ASCII hyphen.
function parseOdds(s) {
  if (!s || s === "—" || s === "OFF" || s === "LOCKED" || s === "OFF THE BOARD")
    return null;
  const clean = s.replace(/−/g, "-");
  return Number(clean);
}

function calcReturn(odds, stake, result) {
  if (result === "LOST") return 0;
  if (result === "PUSH") return stake;
  if (odds === null) return 0;
  if (odds > 0) return stake + (stake * odds) / 100;
  return stake + (stake * 100) / Math.abs(odds);
}

function roundCents(n) {
  return Math.round(n * 100) / 100;
}

// ── Standings ────────────────────────────────────────────────────────────────
function buildStandings(poolId) {
  const results = read("public/data/results.json");
  const group = read(`public/data/groups/${poolId}.json`);
  const cfg = POOLS[poolId];
  const rows = computeStandings(group, results.stages, results.gd, cfg.tiebreak);
  const lastRank = Math.max(...rows.map((r) => r.rank));

  rows.forEach((row) => {
    row.teams = row.teams.map((t) => ({
      ...t,
      stageLabel: STAGE_LABEL[t.stage] || t.stage,
    }));
    const payout = cfg.payouts[row.rank] ?? 0;
    row.payout = payout;
    row.payoutLabel = payout ? `$${payout}` : "—";
  });

  return { rows, lastRank, results, group, cfg };
}

// ── Market archive: collect every posted selection, first occurrence wins ────
function loadSheets(poolId) {
  const index = read(`public/data/books/${poolId}/index.json`);
  const sheets = [];
  for (const entry of index.entries) {
    const path =
      entry === "open"
        ? `public/data/books/${poolId}.json`
        : `public/data/books/${poolId}/${entry}.json`;
    sheets.push({ key: entry, date: entry === "open" ? "open" : entry, data: read(path) });
  }
  return sheets;
}

function pairKey(a, b) {
  return [a, b].sort().join(" vs ");
}

function collectMarkets(poolId, sheets) {
  const opening = sheets[0].data;
  const markets = {
    outright: [],
    toCash: [],
    spoon: [],
    h2h: [],
    grudges: [],
    watch: [],
    faction: [],
    specials: [],
  };

  // Standing markets: from opening book only
  for (const row of opening.outright) {
    markets.outright.push({
      market: "outright",
      label: row.player,
      price: row.price,
      player: row.player,
      since: "open",
    });
  }
  for (const row of opening.toCash) {
    markets.toCash.push({
      market: "toCash",
      label: row.player,
      price: row.price,
      player: row.player,
      since: "open",
    });
  }
  for (const row of opening.spoon) {
    markets.spoon.push({
      market: "spoon",
      label: row.player,
      price: row.price,
      player: row.player,
      since: "open",
    });
  }

  // H2H: first occurrence of each pair across all sheets
  const seenH2H = new Set();
  for (const sheet of sheets) {
    if (!sheet.data.h2h) continue;
    for (const pair of sheet.data.h2h) {
      const key = pairKey(pair.a, pair.b);
      if (seenH2H.has(key)) continue;
      seenH2H.add(key);
      markets.h2h.push({
        market: "h2h",
        label: `${pair.a} vs ${pair.b}`,
        a: pair.a,
        b: pair.b,
        priceA: pair.priceA,
        priceB: pair.priceB,
        since: sheet.date,
      });
    }
  }

  // Grudges: opening book only (Boofy)
  if (opening.grudges?.pairs) {
    for (const pair of opening.grudges.pairs) {
      markets.grudges.push({
        market: "grudge",
        label: `${pair.a} vs ${pair.b}`,
        note: pair.note,
        a: pair.a,
        b: pair.b,
        priceA: pair.priceA,
        priceB: pair.priceB,
        since: "open",
      });
    }
  }

  // Watch: first occurrence of each (player, line) rung across all sheets
  const seenWatch = new Set();
  for (const sheet of sheets) {
    if (!sheet.data.watch?.ladder) continue;
    const w = sheet.data.watch;
    for (const rung of w.ladder) {
      const overKey = `${w.player}|O|${rung.line}`;
      const underKey = `${w.player}|U|${rung.line}`;
      if (!seenWatch.has(overKey)) {
        seenWatch.add(overKey);
        markets.watch.push({
          market: "watch",
          label: `${w.player} Over ${rung.line}`,
          player: w.player,
          line: rung.line,
          side: "over",
          price: rung.over,
          since: sheet.date,
        });
      }
      if (!seenWatch.has(underKey)) {
        seenWatch.add(underKey);
        markets.watch.push({
          market: "watch",
          label: `${w.player} Under ${rung.line}`,
          player: w.player,
          line: rung.line,
          side: "under",
          price: rung.under,
          since: sheet.date,
        });
      }
    }
  }

  // Faction: opening book only (SOSK)
  if (opening.faction) {
    const f = opening.faction;
    markets.faction.push({
      market: "faction",
      label: `${f.a.name} ML`,
      side: "a",
      type: "ml",
      price: f.a.moneyline,
      since: "open",
    });
    markets.faction.push({
      market: "faction",
      label: `${f.b.name} ML`,
      side: "b",
      type: "ml",
      price: f.b.moneyline,
      since: "open",
    });
    markets.faction.push({
      market: "faction",
      label: `${f.a.name} ${f.a.spread.line}`,
      side: "a",
      type: "spread",
      spreadLine: parseFloat(String(f.a.spread.line).replace(/−/g, "-")),
      price: f.a.spread.price,
      since: "open",
    });
    markets.faction.push({
      market: "faction",
      label: `${f.b.name} ${f.b.spread.line}`,
      side: "b",
      type: "spread",
      spreadLine: parseFloat(String(f.b.spread.line).replace(/−/g, "-")),
      price: f.b.spread.price,
      since: "open",
    });
    markets.faction.push({
      market: "faction",
      label: `${f.a.name} O ${f.a.total.line}`,
      side: "a",
      type: "totalOver",
      totalLine: f.a.total.line,
      price: f.a.total.over,
      since: "open",
    });
    markets.faction.push({
      market: "faction",
      label: `${f.a.name} U ${f.a.total.line}`,
      side: "a",
      type: "totalUnder",
      totalLine: f.a.total.line,
      price: f.a.total.under,
      since: "open",
    });
    markets.faction.push({
      market: "faction",
      label: `${f.b.name} O ${f.b.total.line}`,
      side: "b",
      type: "totalOver",
      totalLine: f.b.total.line,
      price: f.b.total.over,
      since: "open",
    });
    markets.faction.push({
      market: "faction",
      label: `${f.b.name} U ${f.b.total.line}`,
      side: "b",
      type: "totalUnder",
      totalLine: f.b.total.line,
      price: f.b.total.under,
      since: "open",
    });
  }

  // Specials: first occurrence of each label across all sheets
  const seenSpecials = new Set();
  for (const sheet of sheets) {
    if (!sheet.data.caleb?.bets) continue;
    for (const bet of sheet.data.caleb.bets) {
      if (seenSpecials.has(bet.label)) continue;
      seenSpecials.add(bet.label);
      markets.specials.push({
        market: "special",
        label: bet.label,
        price: bet.price,
        since: sheet.date,
      });
    }
  }

  return markets;
}

// ── Specials condition map ───────────────────────────────────────────────────
// Each entry maps an exact label to a structured condition. Derived from
// build-books.mjs CONFIG `kind` values; frozen for the finished tournament.

const SPECIALS_CONDITIONS = {
  // ─── BOOFY ──────────────────────────────────────────────────────
  // Board 1 (opening)
  "Matt wins the whole pool (Panama · Uzbekistan · Curaçao · Haiti)":
    { type: "winsPool", player: "Matt" },
  "Matt cashes top 3":
    { type: "cashes", player: "Matt" },
  "Shaya sweeps the beef — finishes above Jake AND Matt":
    { type: "sweep", player: "Shaya", over: ["Jake", "Matt"] },
  "Kunal goes nuclear — Over 14.5 pts":
    { type: "overPts", player: "Kunal", line: 14.5 },
  "Rob bricks it — Under 4.5 pts with England AND France":
    { type: "underPts", player: "Rob", line: 4.5 },

  // Board 2 (2026-07-03)
  "Adrian wins the whole pool (Paraguay, and only Paraguay, remain)":
    { type: "winsPool", player: "Adrian" },
  "Dante rises from 11th — cashes top 3 on Spain alone":
    { type: "cashes", player: "Dante" },
  "Paraguay, slayers of Germany, reach the semifinal":
    { type: "teamReaches", team: "Paraguay", stage: "SF" },
  "Hosts with the most — Mexico win the whole thing":
    { type: "teamReaches", team: "Mexico", stage: "CHAMPION" },

  // Board 3 (2026-07-06)
  "Rob goes nuclear — England AND France both live and in the quarters, Over 12.5 points":
    { type: "overPts", player: "Rob", line: 12.5 },
  "Dante climbs from 10th — cashes top 3 on Spain alone":
    { type: "cashes", player: "Dante" },
  "The QF-96 derby — Jake (Switzerland) finishes above Jack (Colombia), settled tomorrow":
    { type: "finishesAbove", player: "Jake", other: "Jack" },
  "Nathan survives his own civil war (Argentina vs Egypt, both his) and wins the pool":
    { type: "winsPool", player: "Nathan" },
  "The full Cinderella — Morocco, and only Morocco, wins Dino the entire pool":
    { type: "winsPool", player: "Dino" },

  // Board 4 (2026-07-07)
  "“One more closer to the money” — Jake texts his way onto the podium, cashes top 3":
    { type: "cashes", player: "Jake" },
  "The final is Rob vs Rob — England AND France both reach it":
    { type: "teamsAllReach", teams: ["England", "France"], stage: "RUNNER_UP" },
  "Rob goes nuclear — Over 12.5 points":
    { type: "overPts", player: "Rob", line: 12.5 },
  "Max, a dirty Brit, sends England home on Saturday and wins the whole pool":
    { type: "winsPool", player: "Max" },
  "Dante climbs from the basement — cashes top 3 on Spain alone":
    { type: "cashes", player: "Dante" },

  // Board 5 (2026-07-08)
  "Rob runs the table — France past Morocco, England past Norway, he laps the field, Over 12.5 points":
    { type: "overPts", player: "Rob", line: 12.5 },
  "The full Cinderella survives — Morocco (Dino) knocks out Rob's France and wins the pool":
    { type: "winsPool", player: "Dino" },
  "Max, a dirty Brit, sends England home Saturday and wins the whole pool":
    { type: "winsPool", player: "Max" },
  "One more closer to the money — Switzerland takes down Argentina for Jake":
    { type: "finishesAbove", player: "Jake", other: "Nathan" },

  // Board 6 (2026-07-09)
  "Rob runs the table — Over 12.5 points with an England vs France final":
    { type: "overPts", player: "Rob", line: 12.5 },
  "Max, a dirty Brit, wins the whole pool — step one is sending England home Saturday":
    { type: "winsPool", player: "Max" },
  "One more closer to the money — Jake climbs past Nathan in the pool, riding Switzerland's shot at Argentina":
    { type: "finishesAbove", player: "Jake", other: "Nathan" },
  "Dante's Inferno — top 3 or bust, and it starts with Spain getting past Belgium Friday":
    { type: "cashes", player: "Dante" },
  "The last two with a pulse — Max (Norway) outlasts Dante (Spain) for whatever's left on the board":
    { type: "finishesAbove", player: "Max", other: "Dante" },

  // Board 7 (2026-07-10)
  "Rob laps the field — England AND France both alive on opposite halves, so they can only meet in the final, and he wins the pool":
    { type: "winsPool", player: "Rob" },
  "Dante's Inferno — his entire summer is Spain, and cashing top 3 means Spain lifting the actual trophy; a final isn't enough, it has to be the whole thing":
    { type: "cashes", player: "Dante" },
  "Dead but not buried — Dino, every team he owns eliminated, frozen on 7, still cashes top 3 if the climbers all stall":
    { type: "cashes", player: "Dino" },
  "Nathan needs Argentina — step one is beating Jake's Switzerland in Saturday's all-Boofy quarterfinal, then the pool is his":
    { type: "winsPool", player: "Nathan" },
  "Max, a dirty Brit, sends Rob's England home Saturday and rides Norway to the whole pool":
    { type: "winsPool", player: "Max" },
  "One more closer to the money — Jake climbs past Nathan, riding Switzerland's shot at Argentina":
    { type: "finishesAbove", player: "Jake", other: "Nathan" },

  // Board 8 (2026-07-11)
  "The final is Rob vs Rob — England AND France both reach it, the trophy and the runner-up landing on one seat":
    { type: "teamsAllReach", teams: ["England", "France"], stage: "RUNNER_UP" },
  "Rob laps the field — two live semifinalists on opposite halves, and he wins the pool":
    { type: "winsPool", player: "Rob" },
  "Nathan's only road runs through Rob — Argentina has to beat England on Wednesday, then the pool is his":
    { type: "winsPool", player: "Nathan" },
  "Dante's Inferno, last chamber — top 3 means Spain lifting the actual trophy, a final isn't enough, and it starts by getting past Rob's France":
    { type: "cashes", player: "Dante" },
  "Killed by his own country — Max, a dirty Brit whose Norway fell to England, is frozen at 7 and still cashes top 3 if Spain stays boring":
    { type: "cashes", player: "Max" },
  "Dead but not buried — Dino, every team he owns eliminated, frozen on 7, cashes top 3 if the climbers all stall":
    { type: "cashes", player: "Dino" },

  // Board 9 (2026-07-14)
  "Rob wins the pool — his England beats Nathan's Argentina and it's over":
    { type: "winsPool", player: "Rob" },
  "Nathan wins the pool — his Argentina beats Rob's England and the $200 is his":
    { type: "winsPool", player: "Nathan" },
  "Dante takes the last podium spot — but only if his Spain wins the whole thing; a runner-up leaves him a point short":
    { type: "cashes", player: "Dante" },
  "Dino and Max back into third — the two frozen sevens (Cinderella's corpse and a dirty Brit killed by his own country) split the last seat if Spain loses the final":
    { type: "cashes", player: "Dino" },

  // Board 10 (2026-07-15)
  "Dante steals second — Spain lift the Cup, he ties Rob on 8, and takes it on goal difference, +4 to −2":
    { type: "finishesAbove", player: "Dante", other: "Rob" },
  "Rob salvages the $40 — Spain lose, Dante stalls on 5, and runner-up is the last thing England and France ever bought him":
    { type: "finishesAbove", player: "Rob", other: "Dante" },
  "Dino backs into the last chair — dead since the quarterfinal, he needs Spain to lose, then beats Max to it by seven goals neither of them can touch":
    { type: "cashes", player: "Dino" },
  "Nathan wins the pool — the house is not taking this action and posts the number purely so it can be admired":
    { type: "winsPool", player: "Nathan" },

  // ─── SOSK ───────────────────────────────────────────────────────
  // Board 1 (2026-07-03)
  "Prozan wins the pool (the ladder out of the basement exists)":
    { type: "winsPool", player: "Prozan" },
  "Prozan cashes top 3":
    { type: "cashes", player: "Prozan" },
  "The Prozan special — USA AND Brazil both reach the quarters":
    { type: "teamsAllReach", teams: ["United States", "Brazil"], stage: "QF" },
  "USA win the whole thing":
    { type: "teamReaches", team: "United States", stage: "CHAMPION" },
  "Canada lift the trophy (Burnes insists he's never even been)":
    { type: "teamReaches", team: "Canada", stage: "CHAMPION" },

  // Board 2 (2026-07-06)
  "The QF-98 leapfrog — Burnes (Spain) runs down Chris (Belgium), the fallen favorite's revenge":
    { type: "finishesAbove", player: "Burnes", other: "Chris" },
  "House money — Kunal (Norway) outscores Oanta (England) in the QF-99 mirror":
    { type: "finishesAbove", player: "Kunal", other: "Oanta" },
  "J Call storms the lead — Argentina, Egypt AND Switzerland all still standing, wins the pool":
    { type: "winsPool", player: "J Call" },
  "Arnst runs away and hides — France and Morocco both live, Over 13.5 points":
    { type: "overPts", player: "Arnst", line: 13.5 },
  "HG crashes the podium — Colombia alone drags him into the top 3":
    { type: "cashes", player: "HG" },

  // Board 3 (2026-07-07)
  "J Call beats J Call (Argentina vs Switzerland, both his) and wins the pool":
    { type: "winsPool", player: "J Call" },
  "Kunal (Norway) outscores Oanta (England) — settled on the pitch Saturday, adjudicated at the bar":
    { type: "finishesAbove", player: "Kunal", other: "Oanta" },
  "The leapfrog lives — Burnes (Spain) still runs down Chris (Belgium), Friday is the whole ballgame":
    { type: "finishesAbove", player: "Burnes", other: "Chris" },
  "Arnst plays himself Thursday and his survivor reaches the final — Over 10.5 points":
    { type: "overPts", player: "Arnst", line: 10.5 },
  "The Hawaii West parlay — Norway AND Argentina both win Saturday, drinks on the doubters":
    { type: "teamsAllReach", teams: ["Norway", "Argentina"], stage: "SF" },

  // Board 4 (2026-07-08)
  "The logjam breaks his way — J Call, guaranteed a semifinalist (Argentina vs Switzerland, both his), wins the pool":
    { type: "winsPool", player: "J Call" },
  "Battle of the men who play themselves — J Call (Argentina/Switzerland) finishes above Arnst (France/Morocco)":
    { type: "finishesAbove", player: "J Call", other: "Arnst" },
  "The leapfrog, now on Friday — Burnes (Spain) runs down Chris (Belgium) head-to-head":
    { type: "finishesAbove", player: "Burnes", other: "Chris" },
  "Chris holds serve — the fallen favorite (Belgium) beats Spain and cashes top 3":
    { type: "cashes", player: "Chris" },
  "The Hawaii West parlay — Norway AND Argentina both reach the semis, drinks on the doubters":
    { type: "teamsAllReach", teams: ["Norway", "Argentina"], stage: "SF" },

  // Board 5 (2026-07-09)
  "The logjam breaks his way — Jacob Call wins the pool":
    { type: "winsPool", player: "J Call" },
  "Battle of the men who play themselves — J Call (Argentina/Switzerland) finishes above Arnst, now with a one-point bigger cushion":
    { type: "finishesAbove", player: "J Call", other: "Arnst" },
  "Kunal (Norway) outscores Oanta (England) — Saturday at Hawaii West, adjudicated over a poorly mixed Mai Tai":
    { type: "finishesAbove", player: "Kunal", other: "Oanta" },
  "Oanta's last stand — top 3 or nothing, and it hinges on England getting past Erling Haaland":
    { type: "cashes", player: "Oanta" },

  // Board 6 (2026-07-10)
  "The leapfrog reborn — Burnes (Spain) runs down the frozen Chris (Belgium), but only through France: Spain reaching the final ties it at 9, only the trophy passes him":
    { type: "finishesAbove", player: "Burnes", other: "Chris" },
  "The statue holds — Chris, every team eliminated, cashes top 3 anyway; dead-heat rules split the cash, so even a tie pays":
    { type: "cashes", player: "Chris" },
  "Arnst runs it back — France, the tournament favorite, lifts the Cup and he clears Over 12.5 points":
    { type: "overPts", player: "Arnst", line: 12.5 },
  "J Call beats J Call — Argentina vs Switzerland on Saturday, both his, so he can't lose a semifinalist, and rides the survivor to win the pool":
    { type: "winsPool", player: "J Call" },
  "The Saturday mirror — Kunal (Norway) outlasts Oanta (England), settled on the pitch, adjudicated over a poorly mixed Mai Tai":
    { type: "finishesAbove", player: "Kunal", other: "Oanta" },
  "Chaos at Hawaii West — Norway AND Switzerland both pull the Saturday upset and turn SF-102 into a Cinderella semifinal, drinks on the doubters":
    { type: "teamsAllReach", teams: ["Norway", "Switzerland"], stage: "SF" },

  // Board 7 (2026-07-11)
  "J Call beats the host — Argentina past Oanta's England on Wednesday — and wins the pool":
    { type: "winsPool", player: "J Call" },
  "Arnst answers the co-leader — France past Burnes's Spain on Tuesday, and he clears Over 12.5 points":
    { type: "overPts", player: "Arnst", line: 12.5 },
  "The co-leaders collide for the Cup — Argentina AND France both reach the final, J Call vs Arnst for everything":
    { type: "teamsAllReach", teams: ["Argentina", "France"], stage: "RUNNER_UP" },
  "The leapfrog, last leg — Burnes (Spain) runs down the frozen Chris, but only the trophy does it: a final merely ties, and it's through Arnst's France first":
    { type: "finishesAbove", player: "Burnes", other: "Chris" },
  "Oanta crashes his own party — the man who threw the Saturday needs England to win the whole thing to cash top 3":
    { type: "cashes", player: "Oanta" },

  // Board 8 (2026-07-14)
  "Burnes wins the pool — Spain lifts the Cup and the $150 is his; the board's favorite":
    { type: "winsPool", player: "Burnes" },
  "Oanta wins the pool — England beats Argentina, then dethrones Spain in the final":
    { type: "winsPool", player: "Oanta" },
  "J Call wins the pool — Argentina beats England, then dethrones Spain in the final":
    { type: "winsPool", player: "J Call" },
  "Arnst holds second — frozen at 10, locked onto the podium, he keeps at least a share of the $60 spot in every outcome but one":
    { type: "finishesAbove", player: "Arnst", other: "Burnes" },
  "Arnst slips to sole third — the lone exception: Argentina reaches the final AND Spain wins it, stacking two seats above him":
    { type: "and", conditions: [
      { type: "teamReaches", team: "Spain", stage: "CHAMPION" },
      { type: "teamReaches", team: "Argentina", stage: "RUNNER_UP" },
    ]},
  "Chris steals a podium — frozen at 9, every team dead, he backs into a shared third only if Argentina wins the whole thing":
    { type: "cashes", player: "Chris" },

  // Board 9 (2026-07-15)
  "Burnes wins the pool — he bought Spain in June and Spain lifting the Cup on Sunday is the entire $150":
    { type: "winsPool", player: "Burnes" },
  "The birthday boy takes it all — Argentina win on July 19, Jacob Call's actual birthday, and the pool is his":
    { type: "winsPool", player: "J Call" },
  "Arnst's check is Burnes's problem — frozen on 10, he is second if Spain lose and third if Spain win, and he cannot lift a finger either way":
    { type: "finishesAbove", player: "Arnst", other: "Burnes" },
  "The one-goal tiebreak — Chris, every team dead, takes third off Burnes because Spain losing drops their goal difference below his 7":
    { type: "finishesAbove", player: "Chris", other: "Burnes" },
  "Burnes salvages something — Spain lift the Cup, or Argentina need a shootout, which leaves Spain's goal difference untouched and dead-heats the last $30":
    { type: "cashes", player: "Burnes" },

  // Board 10 (2026-07-18)
  "To the spot — Argentina win, Burnes and Chris finish level on nine, and the last $30 is settled by a five-kick shootout":
    { type: "and", conditions: [
      { type: "teamReaches", team: "Argentina", stage: "CHAMPION" },
      { type: "tiedWith", player: "Burnes", other: "Chris" },
    ]},
  "Burnes wins the shootout — a shootout is a goalkeeper's document, and he owns a Berkeley IM title in goal":
    { type: "and", conditions: [
      { type: "teamReaches", team: "Argentina", stage: "CHAMPION" },
      { type: "tiedWith", player: "Burnes", other: "Chris" },
      { type: "external", result: false },
    ]},
  "Chris wins the shootout — high school soccer against an IM-league DKE legend in goal, and the taker always fancies himself":
    { type: "and", conditions: [
      { type: "teamReaches", team: "Argentina", stage: "CHAMPION" },
      { type: "tiedWith", player: "Burnes", other: "Chris" },
      { type: "external", result: false },
    ]},
};

// ── Condition evaluator ──────────────────────────────────────────────────────
function evaluate(cond, standings, results) {
  const byPlayer = Object.fromEntries(standings.map((r) => [r.player, r]));
  const lastRank = Math.max(...standings.map((r) => r.rank));

  function ev(c) {
    switch (c.type) {
      case "winsPool":
        return byPlayer[c.player]?.rank === 1;
      case "cashes":
        return (byPlayer[c.player]?.rank ?? 999) <= 3;
      case "lastPlace":
        return byPlayer[c.player]?.rank === lastRank;
      case "overPts":
        return (byPlayer[c.player]?.total ?? 0) > c.line;
      case "underPts":
        return (byPlayer[c.player]?.total ?? 0) < c.line;
      case "finishesAbove":
        return (byPlayer[c.player]?.rank ?? 999) < (byPlayer[c.other]?.rank ?? 999);
      case "teamReaches":
        return (STAGE_POINTS[results.stages[c.team]] ?? 0) >= STAGE_POINTS[c.stage];
      case "teamsAllReach":
        return c.teams.every(
          (t) => (STAGE_POINTS[results.stages[t]] ?? 0) >= STAGE_POINTS[c.stage]
        );
      case "sweep":
        return c.over.every(
          (other) => (byPlayer[c.player]?.rank ?? 999) < (byPlayer[other]?.rank ?? 999)
        );
      case "tiedWith":
        return byPlayer[c.player]?.rank === byPlayer[c.other]?.rank;
      case "external":
        return c.result;
      case "and":
        return c.conditions.every((sub) => ev(sub));
      default:
        console.warn(`Unknown condition type: ${c.type}`);
        return false;
    }
  }
  return ev(cond);
}

// ── Grading ──────────────────────────────────────────────────────────────────
const STAKE = 10;

function gradeMarket(m, standings, results, poolId, openingBook) {
  const byPlayer = Object.fromEntries(standings.map((r) => [r.player, r]));
  const lastRank = Math.max(...standings.map((r) => r.rank));
  const cfg = POOLS[poolId];

  function deadHeatReturn(odds, rank, marketPlaces, nPlayers) {
    const tiedAtRank = standings.filter((r) => r.rank === rank).length;
    if (tiedAtRank <= 1) return calcReturn(parseOdds(odds), STAKE, "WON");
    const slotsAvailable = Math.max(marketPlaces - (rank - 1), 0);
    if (slotsAvailable <= 0) return 0;
    const fraction = Math.min(slotsAvailable, tiedAtRank) / tiedAtRank;
    const fullReturn = calcReturn(parseOdds(odds), STAKE, "WON");
    return STAKE + (fullReturn - STAKE) * fraction;
  }

  if (m.market === "outright") {
    const rank = byPlayer[m.player]?.rank ?? 999;
    const result = rank === 1 ? "WON" : "LOST";
    const odds = parseOdds(m.price);
    const ret = result === "WON" ? deadHeatReturn(m.price, rank, 1, standings.length) : 0;
    return { ...m, result, stake: STAKE, ret: roundCents(ret) };
  }

  if (m.market === "toCash") {
    const rank = byPlayer[m.player]?.rank ?? 999;
    const tiedAtRank = standings.filter((r) => r.rank === rank).length;
    const slotsBelow = cfg.places - (rank - 1);
    let result;
    if (rank <= cfg.places && slotsBelow >= tiedAtRank) result = "WON";
    else if (rank > cfg.places) result = "LOST";
    else result = "WON"; // dead heat straddling the line — partial pay
    const ret = result === "WON" ? deadHeatReturn(m.price, rank, cfg.places, standings.length) : 0;
    return { ...m, result, stake: STAKE, ret: roundCents(ret) };
  }

  if (m.market === "spoon") {
    const rank = byPlayer[m.player]?.rank ?? 0;
    const result = rank === lastRank ? "WON" : "LOST";
    const odds = parseOdds(m.price);
    const ret = result === "WON" ? deadHeatReturn(m.price, rank, 1, standings.length) : 0;
    return { ...m, result, stake: STAKE, ret: roundCents(ret) };
  }

  if (m.market === "h2h" || m.market === "grudge") {
    const rankA = byPlayer[m.a]?.rank ?? 999;
    const rankB = byPlayer[m.b]?.rank ?? 999;
    const graded = [];

    const resultA = rankA < rankB ? "WON" : rankA === rankB ? "PUSH" : "LOST";
    const retA = calcReturn(parseOdds(m.priceA), STAKE, resultA);
    graded.push({
      market: m.market, label: `${m.label}: ${m.a}`, price: m.priceA,
      a: m.a, b: m.b, side: "a", result: resultA, stake: STAKE, ret: roundCents(retA),
      since: m.since, note: m.note,
    });

    const resultB = rankB < rankA ? "WON" : rankA === rankB ? "PUSH" : "LOST";
    const retB = calcReturn(parseOdds(m.priceB), STAKE, resultB);
    graded.push({
      market: m.market, label: `${m.label}: ${m.b}`, price: m.priceB,
      a: m.a, b: m.b, side: "b", result: resultB, stake: STAKE, ret: roundCents(retB),
      since: m.since, note: m.note,
    });

    return graded;
  }

  if (m.market === "watch") {
    const total = byPlayer[m.player]?.total ?? 0;
    let result;
    if (m.side === "over") result = total > m.line ? "WON" : total < m.line ? "LOST" : "PUSH";
    else result = total < m.line ? "WON" : total > m.line ? "LOST" : "PUSH";
    const ret = calcReturn(parseOdds(m.price), STAKE, result);
    return { ...m, result, stake: STAKE, ret: roundCents(ret), actual: total };
  }

  if (m.market === "faction") {
    const f = openingBook.faction;
    const totalA = f.a.players.reduce(
      (sum, p) => sum + (standings.find((r) => r.player === p.name)?.total ?? 0), 0
    );
    const totalB = f.b.players.reduce(
      (sum, p) => sum + (standings.find((r) => r.player === p.name)?.total ?? 0), 0
    );

    let result;
    if (m.type === "ml") {
      if (m.side === "a") result = totalA > totalB ? "WON" : totalA < totalB ? "LOST" : "PUSH";
      else result = totalB > totalA ? "WON" : totalB < totalA ? "LOST" : "PUSH";
    } else if (m.type === "spread") {
      const adjusted = m.side === "a" ? totalA + m.spreadLine : totalB + m.spreadLine;
      const opponent = m.side === "a" ? totalB : totalA;
      result = adjusted > opponent ? "WON" : adjusted < opponent ? "LOST" : "PUSH";
    } else if (m.type === "totalOver") {
      const actual = m.side === "a" ? totalA : totalB;
      result = actual > m.totalLine ? "WON" : actual < m.totalLine ? "LOST" : "PUSH";
    } else if (m.type === "totalUnder") {
      const actual = m.side === "a" ? totalA : totalB;
      result = actual < m.totalLine ? "WON" : actual > m.totalLine ? "LOST" : "PUSH";
    }
    const ret = calcReturn(parseOdds(m.price), STAKE, result);
    return {
      ...m, result, stake: STAKE, ret: roundCents(ret),
      actualA: totalA, actualB: totalB,
    };
  }

  if (m.market === "special") {
    const cond = SPECIALS_CONDITIONS[m.label];
    if (!cond) {
      console.warn(`No condition mapped for special: "${m.label}"`);
      return { ...m, result: "LOST", stake: STAKE, ret: 0, unmapped: true };
    }
    const won = evaluate(cond, standings, results);
    const result = won ? "WON" : "LOST";
    const ret = calcReturn(parseOdds(m.price), STAKE, result);
    return { ...m, result, stake: STAKE, ret: roundCents(ret) };
  }

  return { ...m, result: "LOST", stake: STAKE, ret: 0 };
}

// ── Margin computation (for bad beat) ────────────────────────────────────────
function computeMargin(graded, standings, cfg) {
  const byPlayer = Object.fromEntries(standings.map((r) => [r.player, r]));
  if (graded.result !== "LOST") return undefined;

  if (["outright", "toCash", "spoon"].includes(graded.market)) {
    const rank = byPlayer[graded.player]?.rank ?? 999;
    if (graded.market === "outright") {
      const winner = standings.find((r) => r.rank === 1);
      const diff = (byPlayer[graded.player]?.total ?? 0) - winner.total;
      const gdDiff = cfg.tiebreak === "gd"
        ? (byPlayer[graded.player]?.gd ?? 0) - winner.gd
        : 0;
      return { points: diff, gd: gdDiff };
    }
    if (graded.market === "toCash") {
      const cutoff = standings.filter((r) => r.rank <= 3);
      const lastCasher = cutoff[cutoff.length - 1];
      const diff = (byPlayer[graded.player]?.total ?? 0) - lastCasher.total;
      return { points: diff };
    }
    return undefined;
  }

  if (graded.market === "watch" && graded.actual !== undefined) {
    return { gap: Math.abs(graded.actual - graded.line) };
  }

  if ((graded.market === "h2h" || graded.market === "grudge") && graded.side) {
    const loser = graded.side === "a" ? graded.a : graded.b;
    const winner = graded.side === "a" ? graded.b : graded.a;
    const diff = (byPlayer[loser]?.total ?? 0) - (byPlayer[winner]?.total ?? 0);
    return { points: diff };
  }

  return undefined;
}

function marginMagnitude(margin) {
  if (!margin) return Infinity;
  if (margin.gap !== undefined) return Math.abs(margin.gap);
  return Math.abs(margin.points ?? Infinity);
}

// ── Superlatives ─────────────────────────────────────────────────────────────
function computeSuperlatives(allGraded, standings, cfg) {
  const won = allGraded.filter((g) => g.result === "WON");
  const lost = allGraded.filter((g) => g.result === "LOST");

  // Ticket of the tournament: WON bet with longest posted odds
  const ticketOfTournament = won
    .filter((g) => parseOdds(g.price) !== null)
    .sort((a, b) => (parseOdds(b.price) ?? 0) - (parseOdds(a.price) ?? 0))[0] ?? null;

  // Bad beat: LOST bet with smallest margin
  const lostWithMargin = lost
    .map((g) => ({ ...g, margin: computeMargin(g, standings, cfg) }))
    .filter((g) => g.margin && marginMagnitude(g.margin) < Infinity)
    .sort((a, b) => marginMagnitude(a.margin) - marginMagnitude(b.margin));
  const badBeat = lostWithMargin[0] ?? null;

  // Specials that cashed
  const specialsThatCashed = won
    .filter((g) => g.market === "special")
    .map((g) => ({ label: g.label, price: g.price, since: g.since, ret: g.ret }));

  return { ticketOfTournament, badBeat, specialsThatCashed };
}

// ── House financials ─────────────────────────────────────────────────────────
function computeHouse(allGraded) {
  const nTickets = allGraded.length;
  const taken = STAKE * nTickets;
  const paid = allGraded.reduce((sum, g) => sum + g.ret, 0);
  const hold = roundCents(taken - paid);
  const holdPct = roundCents((hold / taken) * 100);

  const byMarket = {};
  for (const g of allGraded) {
    const key = g.market;
    if (!byMarket[key]) byMarket[key] = { tickets: 0, taken: 0, paid: 0 };
    byMarket[key].tickets++;
    byMarket[key].taken += STAKE;
    byMarket[key].paid += g.ret;
  }
  for (const key of Object.keys(byMarket)) {
    byMarket[key].paid = roundCents(byMarket[key].paid);
    byMarket[key].hold = roundCents(byMarket[key].taken - byMarket[key].paid);
  }

  return { taken, paid: roundCents(paid), hold, holdPct, nTickets, byMarket };
}

// ── Main ─────────────────────────────────────────────────────────────────────
function settle(poolId) {
  console.log(`\n${"=".repeat(60)}\nSettling ${poolId}\n${"=".repeat(60)}`);

  const { rows: standings, lastRank, results, group, cfg } = buildStandings(poolId);
  console.log("\nFinal standings:");
  for (const r of standings) {
    console.log(`  ${r.rank}. ${r.player} — ${r.total} pts${cfg.tiebreak === "gd" ? `, GD ${r.gd >= 0 ? "+" : ""}${r.gd}` : ""} → ${r.payoutLabel}`);
  }

  const sheets = loadSheets(poolId);
  const markets = collectMarkets(poolId, sheets);
  const openingBook = read(`public/data/books/${poolId}.json`);

  // Grade everything
  const allGraded = [];
  for (const type of ["outright", "toCash", "spoon", "watch", "faction", "specials"]) {
    for (const m of markets[type]) {
      const graded = gradeMarket(m, standings, results, poolId, openingBook);
      if (Array.isArray(graded)) allGraded.push(...graded);
      else allGraded.push(graded);
    }
  }
  // H2H and grudges produce two tickets per pair
  for (const type of ["h2h", "grudges"]) {
    for (const m of markets[type]) {
      const graded = gradeMarket(m, standings, results, poolId, openingBook);
      if (Array.isArray(graded)) allGraded.push(...graded);
      else allGraded.push(graded);
    }
  }

  const house = computeHouse(allGraded);
  const superlatives = computeSuperlatives(allGraded, standings, cfg);

  console.log(`\nHouse: $${house.taken} taken, $${house.paid} paid, $${house.hold} hold (${house.holdPct}%)`);
  console.log(`Tickets: ${house.nTickets}`);

  if (superlatives.ticketOfTournament) {
    console.log(`\nTicket of the tournament: "${superlatives.ticketOfTournament.label}" at ${superlatives.ticketOfTournament.price} → $${superlatives.ticketOfTournament.ret}`);
  }
  if (superlatives.badBeat) {
    console.log(`Bad beat: "${superlatives.badBeat.label}" — margin: ${JSON.stringify(superlatives.badBeat.margin)}`);
  }
  if (superlatives.specialsThatCashed.length) {
    console.log(`\nSpecials that cashed:`);
    for (const s of superlatives.specialsThatCashed) {
      console.log(`  "${s.label}" at ${s.price} → $${s.ret}`);
    }
  }

  // Check for unmapped specials
  const unmapped = allGraded.filter((g) => g.unmapped);
  if (unmapped.length) {
    console.warn(`\n⚠ ${unmapped.length} unmapped specials (graded as LOST by default):`);
    for (const u of unmapped) console.warn(`  "${u.label}"`);
  }

  // Build output
  const recap = {
    id: poolId,
    generated: new Date().toISOString().slice(0, 10),
    standings: standings.map((r) => ({
      rank: r.rank,
      player: r.player,
      points: r.total,
      gd: r.gd,
      payout: r.payoutLabel,
      teams: r.teams.map((t) => ({
        name: t.name,
        stage: t.stage,
        stageLabel: t.stageLabel,
        points: t.points,
        gd: t.gd,
      })),
    })),
    markets: {
      outright: allGraded.filter((g) => g.market === "outright"),
      toCash: allGraded.filter((g) => g.market === "toCash"),
      spoon: allGraded.filter((g) => g.market === "spoon"),
      h2h: allGraded.filter((g) => g.market === "h2h"),
      grudges: allGraded.filter((g) => g.market === "grudge"),
      faction: allGraded.filter((g) => g.market === "faction"),
      watch: allGraded.filter((g) => g.market === "watch"),
      specials: allGraded.filter((g) => g.market === "special"),
    },
    house,
    superlatives,
  };

  const outPath = `src/data/books/${poolId}-recap.json`;
  writeFileSync(join(ROOT, outPath), JSON.stringify(recap, null, 2));
  console.log(`\nWrote ${outPath}`);

  return recap;
}

// Run for both pools
settle("boofy");
settle("sons-of-steve-kerr");
