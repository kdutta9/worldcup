// Build the sportsbook JSON for every pool group: run one big batch of
// tournament simulations, score each pool's draw against every simulated
// tournament, then price the markets with the house margin.
//
//   node scripts/sportsbook/build-books.mjs [sims]
//
// Outputs public/data/books/<id>.json, consumed by the ?book=<id> view.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TEAM_NAMES, TEAM_INDEX, GROUP_OF, STAGE_POINTS, CONSENSUS_TITLE_ODDS } from "./data.mjs";
import { simulateTournament, mulberry32 } from "./engine.mjs";

const SIMS = Number(process.argv[2] ?? 400000);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ratings = (() => {
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
  },
  boofy: {
    bookName: "BOOFY SPORTSBOOK",
    tagline: "Official betting partner of Boofy",
    stakes: null,
    places: 3,
    copy: {
      outright: "First place takes the pool. Dead-heat rules: ties split the cash.",
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
  },
};

// --- Simulate ------------------------------------------------------------------
const n = TEAM_NAMES.length;
const stages = new Uint8Array(n);
const pts = new Uint8Array(n);
const stageCounts = Array.from({ length: n }, () => new Float64Array(7));
const ptsSum = new Float64Array(n);

const MAXPTS = 66;
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

// Pre-resolved player indices for joint "sweep" events counted inside the loop.
const sweepIdx = pools.map((pool) => {
  const sw = CONFIG[pool.id]?.sweep;
  if (!sw) return null;
  const at = (nm) => pool.players.findIndex((pl) => pl.name === nm);
  return { p: at(sw.player), over: sw.over.map(at) };
});

const rng = mulberry32(20260611);
console.log(`Simulating ${SIMS.toLocaleString()} tournaments…`);
const t0 = Date.now();
for (let s = 0; s < SIMS; s++) {
  simulateTournament(ratings, rng, stages);
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

// --- Derive markets --------------------------------------------------------------
const histStats = (hist) => {
  let cum = 0;
  let median = 0;
  for (let v = 0; v < MAXPTS; v++) {
    cum += hist[v];
    if (cum >= SIMS / 2) {
      median = v;
      break;
    }
  }
  return median;
};
const pOver = (hist, line) => {
  let c = 0;
  for (let v = Math.ceil(line); v < MAXPTS; v++) c += hist[v];
  return c / SIMS;
};
const bestLine = (hist, lo = 0.5, hi = 64.5) => {
  let best = lo;
  let bestGap = Infinity;
  for (let line = lo; line <= hi; line += 1) {
    const gap = Math.abs(pOver(hist, line) - 0.5);
    if (gap < bestGap) {
      bestGap = gap;
      best = line;
    }
  }
  return best;
};
const trimHist = (hist) => {
  // Drop the long tail of sub-0.25% bars — they render as empty pixels.
  let max = MAXPTS - 1;
  while (max > 0 && hist[max] / SIMS < 0.0025) max--;
  return Array.from({ length: max + 1 }, (_, v) => ({ pts: v, pct: +((hist[v] / SIMS) * 100).toFixed(2) }));
};

mkdirSync(join(ROOT, "public/data/books"), { recursive: true });

for (let p = 0; p < pools.length; p++) {
  const pool = pools[p];
  const cfg = CONFIG[pool.id];
  if (!cfg) {
    console.log(`No book config for ${pool.id}, skipping`);
    continue;
  }
  const a = acc[p];
  const np = pool.players.length;
  const players = pool.players.map((pl, i) => ({
    name: pl.name,
    teams: pl.teams,
    avg: +(a.sum[i] / SIMS).toFixed(1),
    median: histStats(a.hist[i]),
    pWin: a.win[i] / SIMS,
    pTop: a.top[i] / SIMS,
    pLast: a.last[i] / SIMS,
  }));

  const byWin = [...players.keys()].sort((x, y) => players[y].pWin - players[x].pWin);
  const byLast = [...players.keys()].sort((x, y) => players[y].pLast - players[x].pLast);

  const outright = byWin.map((i) => ({
    player: players[i].name,
    teams: players[i].teams,
    price: price(players[i].pWin, MARGIN.outright),
    fairPct: +(players[i].pWin * 100).toFixed(1),
  }));
  const toCash = [...players.keys()]
    .sort((x, y) => players[y].pTop - players[x].pTop)
    .map((i) => ({
      player: players[i].name,
      teams: players[i].teams,
      price: price(players[i].pTop, MARGIN.place),
      fairPct: +(players[i].pTop * 100).toFixed(1),
    }));
  const spoon = byLast.map((i) => ({
    player: players[i].name,
    teams: players[i].teams,
    price: price(players[i].pLast, MARGIN.place),
    fairPct: +(players[i].pLast * 100).toFixed(1),
  }));

  // Top-shelf head-to-heads: the four strongest seats, priced pairwise with
  // ties as half-wins (dead heat = stakes returned).
  const shelf = [...players.keys()].sort((x, y) => players[y].avg - players[x].avg).slice(0, 4);
  const h2h = [];
  for (let x = 0; x < shelf.length; x++) {
    for (let y = x + 1; y < shelf.length; y++) {
      const i = shelf[x];
      const j = shelf[y];
      const tie = (a.pairTie[Math.min(i, j) * np + Math.max(i, j)] ?? 0) / SIMS;
      const pi = a.pairWin[i * np + j] / SIMS + tie / 2;
      h2h.push({
        a: players[i].name,
        b: players[j].name,
        priceA: price(pi, MARGIN.twoWay),
        priceB: price(1 - pi, MARGIN.twoWay),
      });
    }
  }

  // Watch section: O/U ladder + points distribution for the featured seat.
  const wIdx = pool.players.findIndex((pl) => pl.name === cfg.watch.player);
  const wHist = a.hist[wIdx];
  const main = bestLine(wHist);
  const ladder = [];
  for (let line = Math.max(0.5, main - 3); line <= main + 5; line += 1) {
    const po = pOver(wHist, line);
    ladder.push({ line, over: price(po, MARGIN.twoWay), under: price(1 - po, MARGIN.twoWay) });
  }
  const watch = {
    player: cfg.watch.player,
    title: cfg.watch.title,
    teams: pool.players[wIdx].teams,
    median: players[wIdx].median,
    mainLine: main,
    ladder,
    hist: trimHist(wHist),
  };

  // Faction battle (if this pool has one): moneyline, spread ±1.5, team totals.
  let faction = null;
  if (cfg.faction) {
    const fh = a.factionHist;
    const sideAvg = (names) =>
      +names.reduce((s, nm) => s + players[pool.players.findIndex((pl) => pl.name === nm)].avg, 0).toFixed(1);
    const pAWin = pOver(fh, 32.5);
    const lineA = bestLine(fh);
    // Margin is always odd: +1.5 covers on any win or a 1-point loss (total ≥ 32).
    const pACoverPlus = pOver(fh, 31.5);
    const pBCoverMinus = 1 - pACoverPlus;
    const pBWin = 1 - pAWin;
    const pBCoverPlus = 1 - pOver(fh, 33.5);
    const pACoverMinus = pOver(fh, 33.5);
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
      a: mk(cfg.faction.a.name, cfg.faction.a.players, pAWin, pACoverPlus, pACoverMinus, lineA, pOver(fh, lineA)),
      // B's total mirrors A's (totB = 65 − totA), so B's over is A's under.
      b: mk(cfg.faction.b.name, cfg.faction.b.players, pBWin, pBCoverPlus, pBCoverMinus, 65 - lineA, 1 - pOver(fh, lineA)),
    };
  }

  const idxOf = (nm) => pool.players.findIndex((pl) => pl.name === nm);
  const pairPrice = (i, j) => {
    const tie = a.pairTie[Math.min(i, j) * np + Math.max(i, j)] / SIMS;
    return a.pairWin[i * np + j] / SIMS + tie / 2;
  };

  // Grudge matches: lore pairs priced like any other H2H, dead heat = push.
  let grudges = null;
  if (cfg.grudges) {
    grudges = {
      title: cfg.grudges.title,
      blurb: cfg.grudges.blurb,
      pairs: cfg.grudges.pairs.map(({ a: an, b: bn, note }) => {
        const pi = pairPrice(idxOf(an), idxOf(bn));
        return { a: an, b: bn, note, priceA: price(pi, MARGIN.twoWay), priceB: price(1 - pi, MARGIN.twoWay) };
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
        { label: "Shaya sweeps the beef — finishes above Jake AND Matt", price: price((a.sweep ?? 0) / SIMS, MARGIN.twoWay) },
        { label: "Kunal goes nuclear — Over 14.5 pts", price: price(pOver(kunalHist, 14.5), MARGIN.twoWay) },
        { label: "Rob bricks it — Under 4.5 pts with England AND France", price: price(1 - pOver(robHist, 4.5), MARGIN.twoWay) },
      ],
    };
  }

  // Rosters: every seat's teams with tournament probabilities and fair title odds.
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
          return c / SIMS;
        };
        return {
          name,
          group: GROUP_OF[name],
          makeKo: +(ge(1) * 100).toFixed(1),
          qf: +(ge(3) * 100).toFixed(1),
          winCup: +(ge(6) * 100).toFixed(1),
          expPts: +(ptsSum[t] / SIMS).toFixed(2),
          // The market's own number, not the sim's — sim-derived odds are pure
          // noise for +100000 longshots at 400k trials.
          titleOdds: `+${CONSENSUS_TITLE_ODDS[name]}`,
        };
      }),
    }));

  const book = {
    id: pool.id,
    name: pool.name,
    bookName: cfg.bookName,
    tagline: cfg.tagline,
    stakes: cfg.stakes,
    copy: cfg.copy,
    meta: {
      sims: SIMS,
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
  const out = join(ROOT, "public/data/books", `${pool.id}.json`);
  writeFileSync(out, JSON.stringify(book, null, 2) + "\n");
  console.log(`Wrote ${out}`);
}
