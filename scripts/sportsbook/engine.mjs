// Monte Carlo engine: one call = one full 2026 World Cup (72 group matches,
// best-eight thirds into the real FIFA bracket, knockouts to the final).
//
// Match model: bivariate-independent Poisson. A team's goal rate scales
// exponentially with the rating gap, so a single per-team rating drives both
// group results (with natural draw rates) and knockout win probability.
// Ratings carry no units of their own — they are calibrated until simulated
// championship probabilities match the devigged market consensus.

import { GROUPS, TEAM_NAMES, TEAM_INDEX, R32, R16, QF, SF, STAGE } from "./data.mjs";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_GOALS = 1.32; // avg goals per team per match at equal ratings
const SLOPE = 0.55; // rating gap → goal-rate multiplier exp(±SLOPE·Δ)

function poisson(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function goalRates(ra, rb) {
  const d = ra - rb;
  const la = Math.min(4.5, Math.max(0.15, BASE_GOALS * Math.exp(SLOPE * d)));
  const lb = Math.min(4.5, Math.max(0.15, BASE_GOALS * Math.exp(-SLOPE * d)));
  return [la, lb];
}

// Goals from the most recent koWinnerA call, for callers accumulating goal
// difference. A draw after 90 leaves these equal, so the shootout contributes
// nothing to GD — which is exactly the real convention.
let koGa = 0;
let koGb = 0;

// Knockout: 90 minutes by Poisson; a draw goes to the stronger-team-weighted
// coin (extra time + pens compress but don't erase the skill gap).
function koWinnerA(ra, rb, rng) {
  const [la, lb] = goalRates(ra, rb);
  const ga = poisson(la, rng);
  const gb = poisson(lb, rng);
  koGa = ga;
  koGb = gb;
  if (ga !== gb) return ga > gb;
  return rng() < la / (la + lb);
}

const GROUP_KEYS = Object.keys(GROUPS); // ["A".."L"]
const GROUP_TEAMS = GROUP_KEYS.map((g) => GROUPS[g].map((t) => TEAM_INDEX[t]));
export const PAIRS = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

// Third-place slots: bracket match index in R32 plus the FIFA-allowed source groups.
const THIRD_SLOTS = R32.filter((m) => m.b[0] === "T").map((m) => ({
  id: m.id,
  allowed: new Set(m.b[1].split("")),
}));

// Assign the 8 qualified thirds (by group letter) to the 8 bracket slots,
// respecting each slot's allowed groups. Most-constrained-slot-first backtracking;
// FIFA's allocation table guarantees a solution for every real combination.
function assignThirds(thirdGroups, rng) {
  const slots = THIRD_SLOTS.map((s) => ({
    id: s.id,
    cands: thirdGroups.filter((g) => s.allowed.has(g)),
  })).sort((x, y) => x.cands.length - y.cands.length);
  const used = new Set();
  const out = {};
  function place(i) {
    if (i === slots.length) return true;
    const s = slots[i];
    const start = Math.floor(rng() * s.cands.length);
    for (let k = 0; k < s.cands.length; k++) {
      const g = s.cands[(start + k) % s.cands.length];
      if (used.has(g)) continue;
      used.add(g);
      out[s.id] = g;
      if (place(i + 1)) return true;
      used.delete(g);
    }
    return false;
  }
  if (!place(0)) {
    // Theoretically unreachable for valid FIFA combinations; fall back to any order.
    const left = thirdGroups.filter((g) => !used.has(g));
    THIRD_SLOTS.forEach((s, i) => {
      if (!(s.id in out)) out[s.id] = left.pop();
    });
  }
  return out; // matchId → group letter
}

// Simulate one tournament. Writes each team's furthest stage (STAGE enum) into
// `stages` (Uint8Array(48)) and returns it.
//
// `cond` (optional, from state.mjs buildCondition) replays reality: played group
// matches arrive pre-accumulated with their pairs removed, completed groups carry
// a fixed final order, the real third-place allocation pins bracket slots, and
// decided KO matches have fixed participants and winners. Only the remainder is
// random. With cond=null the rng consumption is identical to the original
// unconditioned engine, so pre-tournament builds reproduce bit-for-bit.
//
// `gdOut` (optional, Float64Array(48)) collects each team's cumulative goal
// difference across the whole tournament: real matches arrive pre-loaded via
// `cond.gdBase`, simulated ones add their own margin. It reuses goals the engine
// already draws, so passing it consumes no extra rng and every prior build still
// reproduces bit-for-bit. Caveat: the third-place game is never simulated (it
// changes nobody's stage), so its margin is absent from simulated GD.
export function simulateTournament(ratings, rng, stages, cond = null, gdOut = null) {
  stages.fill(STAGE.GROUP);
  if (gdOut) {
    if (cond?.gdBase) gdOut.set(cond.gdBase);
    else gdOut.fill(0);
  }

  // Group stage. Rank on points, goal difference, goals for, then lots.
  const firsts = {};
  const seconds = {};
  const thirdRows = []; // { group, team, pts, gd, gf }
  for (let g = 0; g < 12; g++) {
    const teams = GROUP_TEAMS[g];
    const c = cond?.groups[g];
    const pts = c ? c.pts.slice() : [0, 0, 0, 0];
    const gd = c ? c.gd.slice() : [0, 0, 0, 0];
    const gf = c ? c.gf.slice() : [0, 0, 0, 0];
    for (const [x, y] of c ? c.remaining : PAIRS) {
      const [la, lb] = goalRates(ratings[teams[x]], ratings[teams[y]]);
      const ga = poisson(la, rng);
      const gb = poisson(lb, rng);
      gd[x] += ga - gb;
      gd[y] += gb - ga;
      gf[x] += ga;
      gf[y] += gb;
      if (gdOut) {
        gdOut[teams[x]] += ga - gb;
        gdOut[teams[y]] += gb - ga;
      }
      if (ga > gb) pts[x] += 3;
      else if (gb > ga) pts[y] += 3;
      else {
        pts[x] += 1;
        pts[y] += 1;
      }
    }
    const order =
      c?.order ??
      [0, 1, 2, 3]
        .map((i) => ({ i, key: pts[i] * 1e6 + gd[i] * 1e3 + gf[i] + rng() * 0.5 }))
        .sort((a, b) => b.key - a.key)
        .map((o) => o.i);
    const letter = GROUP_KEYS[g];
    firsts[letter] = teams[order[0]];
    seconds[letter] = teams[order[1]];
    const t = order[2];
    thirdRows.push({ group: letter, team: teams[t], key: pts[t] * 1e6 + gd[t] * 1e3 + gf[t] + rng() * 0.5 });
  }

  // Best eight thirds into their bracket slots (fixed once all groups are real).
  let thirdTeamByGroup;
  let slotAssign;
  if (cond?.thirds) {
    thirdTeamByGroup = {};
    for (const [letter, t] of Object.entries(cond.thirds.teamByGroup)) thirdTeamByGroup[letter] = t;
    slotAssign = cond.thirds.slotAssign;
  } else {
    thirdRows.sort((a, b) => b.key - a.key);
    const qualifiedThirds = thirdRows.slice(0, 8);
    thirdTeamByGroup = {};
    for (const r of qualifiedThirds) thirdTeamByGroup[r.group] = r.team;
    slotAssign = assignThirds(qualifiedThirds.map((r) => r.group), rng);
  }

  // Resolve one knockout: a fixed winner from `cond`, else 90 minutes of Poisson
  // with a draw falling to the weighted coin — which is the shootout, and adds
  // no goal difference.
  const koResolve = (k, a, b) => {
    if (k) return k.winner;
    const aWins = koWinnerA(ratings[a], ratings[b], rng);
    if (gdOut) {
      gdOut[a] += koGa - koGb;
      gdOut[b] += koGb - koGa;
    }
    return aWins ? a : b;
  };

  // Round of 32.
  const winners = {}; // matchId → team index
  for (const m of R32) {
    const k = cond?.ko[m.id];
    const pick = (spec) =>
      spec[0] === "W" ? firsts[spec[1]] : spec[0] === "R" ? seconds[spec[1]] : thirdTeamByGroup[slotAssign[m.id]];
    const a = k ? k.a : pick(m.a);
    const b = k ? k.b : pick(m.b);
    stages[a] = STAGE.R32;
    stages[b] = STAGE.R32;
    winners[m.id] = koResolve(k, a, b);
  }

  // R16 → QF → SF, all the same shape: winners advance a stage.
  for (const [round, stage] of [
    [R16, STAGE.R16],
    [QF, STAGE.QF],
    [SF, STAGE.SF],
  ]) {
    for (const m of round) {
      const k = cond?.ko[m.id];
      const a = k ? k.a : winners[m.a];
      const b = k ? k.b : winners[m.b];
      stages[a] = stage;
      stages[b] = stage;
      winners[m.id] = koResolve(k, a, b);
    }
  }

  // Final.
  const kf = cond?.ko[104];
  const fa = kf ? kf.a : winners[101];
  const fb = kf ? kf.b : winners[102];
  const champ = koResolve(kf, fa, fb);
  stages[champ] = STAGE.CHAMPION;
  stages[champ === fa ? fb : fa] = STAGE.RUNNER_UP;
  return stages;
}

export { TEAM_NAMES, TEAM_INDEX };
