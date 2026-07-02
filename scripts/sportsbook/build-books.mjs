// Build the sportsbook JSON for every pool group: run one big batch of
// tournament simulations, score each pool's draw against every simulated
// tournament, then price the markets with the house margin.
//
//   node scripts/sportsbook/build-books.mjs [sims]                # opening books → public/data/books/<id>.json
//   node scripts/sportsbook/build-books.mjs --date 2026-06-15     # conditioned snapshot → public/data/books/<id>/<date>.json
//   node scripts/sportsbook/build-books.mjs --backfill [--force]  # snapshot every match date in the log
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MATCHES_PATH = join(ROOT, "public/data/matches.json");
const CONSENSUS_DIR = join(ROOT, "scripts/sportsbook/consensus");
const baseRatings = (() => {
  const byName = JSON.parse(readFileSync(join(ROOT, "scripts/sportsbook/ratings.json"), "utf8"));
  return TEAM_NAMES.map((n) => byName[n]);
})();

// --- Pricing -----------------------------------------------------------------
// Margins (total book): outright ~135%, place markets ~125% per place, two-way
// sides ~107.5% each (≈115% book) — same shape as the SOSK sheet.
const MARGIN = { outright: 1.35, place: 1.25, twoWay: 1.075 };

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
    copy: {
      outright: "First place takes $150. Dead-heat rules: ties split the cash.",
      toCash: "Any money is good money ($30 still buys a burrito).",
      spoon: "Somebody has to carry the shame until 2030.",
      h2h: "The four strongest seats, priced against each other. Higher pool finish wins; tie on points = stakes returned (handled as half-win in pricing).",
      watch: "Ghana, Colombia, Australia, Algeria, South Africa, South Korea. The model's median is 6 points. Main line:",
    },
    watch: { player: "HG", title: "HUNTER WATCH — HG TOTAL POINTS" },
    faction: {
      title: "THE DKE CIVIL WAR — OLD DKE VS NEW DKE",
      blurb:
        "Faction battle: combined points, all teams each side. The scoring system hands out exactly 65 points every tournament — this is a zero-sum war, and the margin is always odd, so the moneyline can't push.",
      a: { name: "OLD DKE", players: ["HG", "Prozan", "Arnst", "Oanta"] },
      b: { name: "NEW DKE", players: ["Burnes", "J Call", "Kunal", "Chris"] },
    },
    morningLine: {
      title: "THE DKE BOOK — R16 SPECIALS",
      blurb:
        "The commish reopens the board: every Round-of-16 tie is two seats with a grudge. Upset prices are each underdog's real shot at the quarters. Opening lines are off the board.",
    },
  },
  boofy: {
    bookName: "BOOFY SPORTSBOOK",
    tagline: "Official betting partner of Boofy",
    stakes: { buyIn: "$20", pot: "$260", payouts: ["1st $200", "2nd $40", "3rd $20"] },
    places: 3,
    copy: {
      outright: "First place takes $200 even — Dante topped up the pot. Dead-heat rules: ties split the cash.",
      toCash: "Twelve seats, three podium spots. Any money is good money.",
      spoon: "Somebody has to carry the shame until 2030.",
      h2h: "The four strongest seats, priced against each other. Higher pool finish wins; tie on points = stakes returned (handled as half-win in pricing).",
      watch: "Germany, Brazil, South Korea, Netherlands — the house's problem child drew a loaded hand. The model's median is 8 points. Main line:",
    },
    watch: { player: "Kunal", title: "KUNAL WATCH — KUNAL TOTAL POINTS" },
    faction: null,
    grudges: {
      title: "BAD BLOOD — GRUDGE MATCHES",
      blurb:
        "Some matchups are about money. These are not. Higher pool finish settles it; tie on points = stakes returned, beef continues.",
      pairs: [
        { a: "Shaya", b: "Jake", note: "THE FOREVER FEUD" },
        { a: "Shaya", b: "Matt", note: "YES, SHAYA AGAIN" },
      ],
    },
    // Joint event counted during the sim for Caleb's parlay board.
    sweep: { player: "Shaya", over: ["Jake", "Matt"] },
    caleb: {
      title: "CALEB'S CORNER — DEGEN SPECIALS",
      blurb:
        "Caleb is not in the pool. That has never once stopped him. The house posts the slips he'd actually ask for, and reserves the right to demand cash up front.",
    },
    morningLine: {
      title: "THE MORNING LINE — R16 SPECIALS",
      blurb:
        "Opening lines are stale — half the field is dead. The live board: every Round-of-16 tie is two Boofy seats head to head, priced by each underdog's real chance of pulling the upset.",
    },
  },
};

// Pre-resolved player indices for joint "sweep" events counted inside the loop.
const sweepIdx = pools.map((pool) => {
  const sw = CONFIG[pool.id]?.sweep;
  if (!sw) return null;
  const at = (nm) => pool.players.findIndex((pl) => pl.name === nm);
  return { p: at(sw.player), over: sw.over.map(at) };
});

// --- Simulate ------------------------------------------------------------------
const n = TEAM_NAMES.length;
const MAXPTS = 66;

function runBatch(ratings, sims, seed, cond) {
  const stages = new Uint8Array(n);
  const pts = new Uint8Array(n);
  const stageCounts = Array.from({ length: n }, () => new Float64Array(7));
  const ptsSum = new Float64Array(n);

  const acc = pools.map((pool) => {
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
      totals: new Float64Array(np), // scratch
    };
  });

  const rng = mulberry32(seed);
  console.log(`Simulating ${sims.toLocaleString()} tournaments…`);
  const t0 = Date.now();
  for (let s = 0; s < sims; s++) {
    simulateTournament(ratings, rng, stages, cond);
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
      const totals = a.totals;
      for (let i = 0; i < np; i++) {
        let tot = 0;
        for (const ti of pool.players[i].idx) tot += pts[ti];
        totals[i] = tot;
        a.hist[i][tot]++;
        a.sum[i] += tot;
      }
      // Dead-heat credits for win / top-places / last.
      const cfg = CONFIG[pool.id];
      const places = cfg?.places ?? 3;
      for (let i = 0; i < np; i++) {
        let above = 0;
        let below = 0;
        let ties = 0;
        for (let j = 0; j < np; j++) {
          if (totals[j] > totals[i]) above++;
          else if (totals[j] < totals[i]) below++;
          else ties++;
          if (j > i) {
            if (totals[i] > totals[j]) a.pairWin[i * np + j]++;
            else if (totals[j] > totals[i]) a.pairWin[j * np + i]++;
            else a.pairTie[i * np + j]++;
          }
        }
        if (above === 0) a.win[i] += 1 / ties;
        a.top[i] += Math.min(Math.max(places - above, 0), ties) / ties;
        a.last[i] += Math.min(Math.max(1 - below, 0), ties) / ties;
      }
      if (sweepIdx[p] && sweepIdx[p].over.every((j) => totals[sweepIdx[p].p] > totals[j])) a.sweep = (a.sweep ?? 0) + 1;
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
function playerBounds(pool, state) {
  const min = [];
  const max = [];
  for (const pl of pool.players) {
    let lo = 0;
    let hi = 0;
    for (const t of pl.teams) {
      const reached = STAGE_POINTS[state.stageOf[t] ?? STAGE.GROUP];
      lo += reached;
      hi += state.eliminated.has(t) ? reached : STAGE_POINTS[STAGE.CHAMPION];
    }
    min.push(lo);
    max.push(hi);
  }
  return { min, max };
}

function marketStatuses(bounds, places) {
  const { min, max } = bounds;
  const np = min.length;
  const win = [];
  const cash = [];
  const spoon = [];
  for (let i = 0; i < np; i++) {
    const others = [...Array(np).keys()].filter((j) => j !== i);
    win.push(
      max[i] < Math.max(...others.map((j) => min[j]))
        ? "dead"
        : min[i] > Math.max(...others.map((j) => max[j]))
          ? "locked"
          : null
    );
    cash.push(
      others.filter((j) => min[j] > max[i]).length >= places
        ? "dead"
        : others.filter((j) => max[j] > min[i]).length <= places - 1
          ? "locked"
          : null
    );
    spoon.push(
      others.some((j) => max[j] < min[i])
        ? "dead"
        : others.every((j) => min[j] > max[i])
          ? "locked"
          : null
    );
  }
  return { win, cash, spoon };
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

  const statuses = snapshot ? marketStatuses(playerBounds(pool, snapshot.state), cfg.places ?? 3) : null;
  const row = (i, p, margin, status) => ({
    player: players[i].name,
    teams: players[i].teams,
    price: status ? null : price(p, margin),
    fairPct: +(p * 100).toFixed(1),
    ...(status ? { status } : {}),
  });

  const byWin = [...players.keys()].sort((x, y) => players[y].pWin - players[x].pWin);
  const byLast = [...players.keys()].sort((x, y) => players[y].pLast - players[x].pLast);

  const outright = byWin.map((i) => row(i, players[i].pWin, MARGIN.outright, statuses?.win[i]));
  const toCash = [...players.keys()]
    .sort((x, y) => players[y].pTop - players[x].pTop)
    .map((i) => row(i, players[i].pTop, MARGIN.place, statuses?.cash[i]));
  const spoon = byLast.map((i) => row(i, players[i].pLast, MARGIN.place, statuses?.spoon[i]));

  // Top-shelf head-to-heads: the four strongest seats, priced pairwise with
  // ties as half-wins (dead heat = stakes returned).
  const shelf = [...players.keys()].sort((x, y) => players[y].avg - players[x].avg).slice(0, 4);
  const h2h = [];
  const bounds = snapshot ? playerBounds(pool, snapshot.state) : null;
  const pairSettled = (i, j) =>
    !bounds ? null : bounds.min[i] > bounds.max[j] ? "a" : bounds.min[j] > bounds.max[i] ? "b" : null;
  for (let x = 0; x < shelf.length; x++) {
    for (let y = x + 1; y < shelf.length; y++) {
      const i = shelf[x];
      const j = shelf[y];
      const tie = (a.pairTie[Math.min(i, j) * np + Math.max(i, j)] ?? 0) / sims;
      const pi = a.pairWin[i * np + j] / sims + tie / 2;
      const settled = pairSettled(i, j);
      h2h.push({
        a: players[i].name,
        b: players[j].name,
        priceA: settled ? null : price(pi, MARGIN.twoWay),
        priceB: settled ? null : price(1 - pi, MARGIN.twoWay),
        ...(settled ? { settled } : {}),
      });
    }
  }

  // Watch section: O/U ladder + points distribution for the featured seat.
  const wIdx = pool.players.findIndex((pl) => pl.name === cfg.watch.player);
  const wHist = a.hist[wIdx];
  const main = bestLine(wHist, sims);
  const ladder = [];
  for (let line = Math.max(0.5, main - 3); line <= main + 5; line += 1) {
    const po = pOver(wHist, sims, line);
    if (po <= 0 || po >= 1) continue; // settled rungs come off the board
    ladder.push({ line, over: price(po, MARGIN.twoWay), under: price(1 - po, MARGIN.twoWay) });
  }
  const watch = {
    player: cfg.watch.player,
    title: cfg.watch.title,
    teams: pool.players[wIdx].teams,
    median: players[wIdx].median,
    mainLine: main,
    ladder,
    hist: trimHist(wHist, sims),
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

  // Caleb's Corner: the longshot slips a degenerate would actually ask for.
  let caleb = null;
  if (cfg.caleb) {
    const matt = players[idxOf("Matt")];
    const kunalHist = a.hist[idxOf("Kunal")];
    const robHist = a.hist[idxOf("Rob")];
    caleb = {
      title: cfg.caleb.title,
      blurb: cfg.caleb.blurb,
      bets: [
        { label: "Matt wins the whole pool (Panama · Uzbekistan · Curaçao · Haiti)", price: price(matt.pWin, MARGIN.outright) },
        { label: "Matt cashes top 3", price: price(matt.pTop, MARGIN.place) },
        { label: "Shaya sweeps the beef — finishes above Jake AND Matt", price: price((a.sweep ?? 0) / sims, MARGIN.twoWay) },
        { label: "Kunal goes nuclear — Over 14.5 pts", price: price(pOver(kunalHist, sims, 14.5), MARGIN.twoWay) },
        { label: "Rob bricks it — Under 4.5 pts with England AND France", price: price(1 - pOver(robHist, sims, 4.5), MARGIN.twoWay) },
      ],
    };
  }

  // Morning-line specials (dated snapshots only): the fresh R16 owner-clash
  // board — each Round-of-16 tie is two pool seats, priced by the underdog's real
  // shot at the quarters (a team's reach-QF probability IS its R16 win prob). Only
  // emitted once the R16 bracket populates, so it never shows on pre-knockout sheets.
  let morningLine = null;
  if (snapshot && cfg.morningLine) {
    const kt = snapshot.state.koTeams;
    const decided = snapshot.state.ko ?? {};
    const qfPctOf = (name) => {
      const sc = stageCounts[TEAM_INDEX[name]];
      let c = 0;
      for (let k = 3; k < 7; k++) c += sc[k];
      return c / sims;
    };
    const ownerOf = (name) => pool.players.find((pl) => pl.teams.includes(name))?.name;
    const bets = [];
    for (let id = 89; id <= 96; id++) {
      const pair = kt[id];
      if (!pair || pair[0] == null || pair[1] == null || decided[id]) continue;
      const [x, y] = pair;
      const ox = ownerOf(x);
      const oy = ownerOf(y);
      if (ox === oy) {
        bets.push({ label: `R16 · ${ox} vs himself — ${x} or ${y} reaches the QF (the other's done)`, price: null });
        continue;
      }
      const px = qfPctOf(x);
      const py = qfPctOf(y);
      const dog = px <= py ? { t: x, o: ox, p: px } : { t: y, o: oy, p: py };
      const fav = px <= py ? { t: y, o: oy } : { t: x, o: ox };
      bets.push({
        label: `R16 · ${dog.t} (${dog.o}) to knock out ${fav.t} (${fav.o})`,
        price: price(dog.p, MARGIN.twoWay),
      });
    }
    if (bets.length) {
      if (pool.id === "boofy") {
        const pRob = players[idxOf("Rob")].pWin;
        bets.push({ label: "THE FIELD — any seat other than Rob takes down the pool", price: price(1 - pRob, MARGIN.twoWay) });
      } else if (pool.id === "sons-of-steve-kerr") {
        const pArnst = players[idxOf("Arnst")].pWin;
        bets.push({ label: "THE FIELD — any seat other than Arnst takes down the pool", price: price(1 - pArnst, MARGIN.twoWay) });
        let close = 0;
        for (let v = 31; v <= 34; v++) close += a.factionHist[v];
        bets.push({ label: "DKE CIVIL WAR — decided by 3 points or fewer", price: price(close / sims, MARGIN.twoWay) });
      }
      morningLine = { title: cfg.morningLine.title, blurb: cfg.morningLine.blurb, bets };
    }
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
    copy: cfg.copy,
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
    ...(morningLine ? { morningLine } : {}),
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

  const batch = runBatch(ratings, SIMS, seed, cond);
  const snapshot = {
    date,
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
  const dates = [...new Set(loadMatches(MATCHES_PATH).map((m) => m.date))].sort();
  if (!dates.length) {
    console.log("No matches in the log — nothing to backfill.");
    return;
  }
  for (const date of dates) {
    const have = pools.every(
      (pool) => !CONFIG[pool.id] || existsSync(join(ROOT, "public/data/books", pool.id, `${date}.json`))
    );
    if (have && !FORCE) {
      console.log(`Skip ${date} (snapshot exists; --force to rebuild)`);
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
