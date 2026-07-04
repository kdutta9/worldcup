// Tournament state derived from the matches event log (public/data/matches.json).
// The log is the single source of truth: group tables, qualification, bracket
// fills, eliminations and furthest-stage are all pure functions of it, so a
// late entry, a skipped night, or a corrected score never corrupts anything —
// downstream artifacts just get rebuilt.

import { readFileSync, existsSync } from "node:fs";
import {
  GROUPS,
  GROUP_OF,
  TEAM_INDEX,
  TEAM_NAMES,
  R32,
  R16,
  QF,
  SF,
  GROUP_FIXTURES,
  KO_DATES,
  STAGE,
} from "./data.mjs";
import { PAIRS } from "./engine.mjs";

export const STAGE_KEYS = ["GROUP", "R32", "R16", "QF", "SF", "RUNNER_UP", "CHAMPION"];

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const FIXTURE_BY_PAIR = new Map(GROUP_FIXTURES.map((f) => [pairKey(f.a, f.b), f]));
const LETTERS = Object.keys(GROUPS);
const KO_ROUNDS = [...R32, ...R16, ...QF, ...SF, { id: 104, a: 101, b: 102 }];

export const ALL_MATCH_DATES = [...new Set([...GROUP_FIXTURES.map((f) => f.date), ...Object.values(KO_DATES)])].sort();

export function fixtureForPair(a, b) {
  return FIXTURE_BY_PAIR.get(pairKey(a, b)) ?? null;
}

// Everything scheduled on a calendar date: group fixtures + KO match ids.
export function scheduledOn(date) {
  return {
    fixtures: GROUP_FIXTURES.filter((f) => f.date === date),
    koIds: Object.keys(KO_DATES)
      .map(Number)
      .filter((id) => KO_DATES[id] === date),
  };
}

export function loadMatches(path) {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")).matches ?? [];
}

// FIFA group order: points, GD, GF, then head-to-head between the tied pair,
// then name. (FIFA continues with fair play and drawing of lots; if a group
// genuinely comes down to that, override by editing the log order — it has
// never mattered for this pool's stakes.)
function orderRows(rows, matchByPair) {
  return [...rows].sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.gd !== x.gd) return y.gd - x.gd;
    if (y.gf !== x.gf) return y.gf - x.gf;
    const m = matchByPair.get(pairKey(x.team, y.team));
    if (m && m.score[0] !== m.score[1]) {
      const winner = m.score[0] > m.score[1] ? m.a : m.b;
      return winner === x.team ? -1 : 1;
    }
    return x.team < y.team ? -1 : 1;
  });
}

// Third-place slot assignment: deterministic most-constrained-first backtracking
// over each slot's FIFA-allowed source groups, pre-pinning slots whose real R32
// result is already in the log (reality beats the model's guess).
const THIRD_SLOTS = R32.filter((m) => m.b[0] === "T").map((m) => ({ id: m.id, allowed: m.b[1].split("") }));

function assignThirdSlots(qualifiedGroups, teamByGroup, ko) {
  const out = {};
  const used = new Set();
  for (const s of THIRD_SLOTS) {
    const r = ko[s.id];
    if (!r) continue;
    for (const t of [r.a, r.b]) {
      const g = GROUP_OF[t];
      if (teamByGroup[g] === t) {
        out[s.id] = g;
        used.add(g);
      }
    }
  }
  const open = THIRD_SLOTS.filter((s) => !(s.id in out))
    .map((s) => ({ id: s.id, cands: s.allowed.filter((g) => qualifiedGroups.includes(g)) }))
    .sort((x, y) => x.cands.length - y.cands.length);
  (function place(i) {
    if (i === open.length) return true;
    const s = open[i];
    for (const g of s.cands) {
      if (used.has(g)) continue;
      used.add(g);
      out[s.id] = g;
      if (place(i + 1)) return true;
      used.delete(g);
      delete out[s.id];
    }
    return false;
  })(0);
  return out; // matchId → group letter
}

export function deriveState(matches) {
  matches = [...matches].sort((x, y) => x.id - y.id);

  // Group tables.
  const tables = {};
  const matchByPair = new Map();
  const playedPairs = {};
  for (const letter of LETTERS) {
    tables[letter] = GROUPS[letter].map((team) => ({ team, pts: 0, gd: 0, gf: 0, played: 0 }));
    playedPairs[letter] = new Set();
  }
  const rowOf = Object.fromEntries(LETTERS.flatMap((l) => tables[l].map((r) => [r.team, r])));

  for (const m of matches) {
    if (m.id > 72) continue;
    const [ga, gb] = m.score;
    const ra = rowOf[m.a];
    const rb = rowOf[m.b];
    ra.played++;
    rb.played++;
    ra.gf += ga;
    rb.gf += gb;
    ra.gd += ga - gb;
    rb.gd += gb - ga;
    if (ga > gb) ra.pts += 3;
    else if (gb > ga) rb.pts += 3;
    else {
      ra.pts++;
      rb.pts++;
    }
    matchByPair.set(pairKey(m.a, m.b), m);
    playedPairs[m.group].add(pairKey(m.a, m.b));
  }

  const complete = {};
  const order = {};
  for (const letter of LETTERS) {
    complete[letter] = tables[letter].every((r) => r.played === 3);
    order[letter] = orderRows(tables[letter], matchByPair);
  }
  const allGroupsComplete = LETTERS.every((l) => complete[l]);

  // KO results (103, the bronze game, is logged but affects nothing).
  const ko = {};
  for (const m of matches) {
    if (m.id < 73 || m.id === 103) continue;
    const [ga, gb] = m.score;
    ko[m.id] = { a: m.a, b: m.b, winner: ga > gb ? m.a : gb > ga ? m.b : m.pens };
  }

  // Best-eight thirds, only knowable once every group is done.
  let thirds = null;
  let slotAssign = null;
  if (allGroupsComplete) {
    const ranked = orderRows(
      LETTERS.map((l) => order[l][2]),
      matchByPair
    );
    const qualified = ranked.slice(0, 8);
    thirds = {
      qualifiedGroups: qualified.map((r) => GROUP_OF[r.team]),
      teamByGroup: Object.fromEntries(qualified.map((r) => [GROUP_OF[r.team], r.team])),
      out: ranked.slice(8).map((r) => r.team),
    };
    slotAssign = assignThirdSlots(thirds.qualifiedGroups, thirds.teamByGroup, ko);
  }

  // Resolvable teams per KO slot — what add-results matches an entered KO score
  // against, and what the scoreboard needs to call a team "through".
  const koTeams = {};
  for (const m of R32) {
    const resolve = (spec) => {
      if (spec[0] === "W") return complete[spec[1]] ? order[spec[1]][0].team : null;
      if (spec[0] === "R") return complete[spec[1]] ? order[spec[1]][1].team : null;
      const g = slotAssign?.[m.id];
      return g ? thirds.teamByGroup[g] : null;
    };
    koTeams[m.id] = ko[m.id] ? [ko[m.id].a, ko[m.id].b] : [resolve(m.a), resolve(m.b)];
  }
  for (const m of [...R16, ...QF, ...SF, { id: 104, a: 101, b: 102 }]) {
    koTeams[m.id] = ko[m.id] ? [ko[m.id].a, ko[m.id].b] : [ko[m.a]?.winner ?? null, ko[m.b]?.winner ?? null];
  }
  // Bronze game: the two semifinal losers.
  const loserOf = (id) => (ko[id] ? (ko[id].winner === ko[id].a ? ko[id].b : ko[id].a) : null);
  koTeams[103] = [loserOf(101), loserOf(102)];

  // Furthest stage reached (drives results.json / the scoreboard).
  const stageOf = {};
  const bump = (team, st) => {
    if (team != null && st > (stageOf[team] ?? STAGE.GROUP)) stageOf[team] = st;
  };
  for (const letter of LETTERS) {
    if (!complete[letter]) continue;
    bump(order[letter][0].team, STAGE.R32);
    bump(order[letter][1].team, STAGE.R32);
  }
  if (thirds) for (const t of Object.values(thirds.teamByGroup)) bump(t, STAGE.R32);
  const stageOfKo = (id) => (id <= 88 ? STAGE.R32 : id <= 96 ? STAGE.R16 : id <= 100 ? STAGE.QF : STAGE.SF);
  for (const [idStr, r] of Object.entries(ko)) {
    const id = Number(idStr);
    if (id === 104) {
      bump(r.winner, STAGE.CHAMPION);
      bump(r.winner === r.a ? r.b : r.a, STAGE.RUNNER_UP);
      continue;
    }
    const st = stageOfKo(id);
    bump(r.a, st);
    bump(r.b, st);
    // Winner has qualified for the next round; SF winners stay SF until the
    // final settles RUNNER_UP vs CHAMPION.
    if (id <= 100) bump(r.winner, st + 1);
  }

  // Out of title contention (→ consensus prob 0, ratings frozen).
  const eliminated = new Set();
  for (const letter of LETTERS) if (complete[letter]) eliminated.add(order[letter][3].team);
  if (thirds) for (const t of thirds.out) eliminated.add(t);
  for (const [idStr, r] of Object.entries(ko)) {
    if (Number(idStr) === 103) continue;
    eliminated.add(r.winner === r.a ? r.b : r.a);
  }

  return {
    matches,
    tables,
    complete,
    order,
    allGroupsComplete,
    thirds,
    slotAssign,
    ko,
    koTeams,
    stageOf,
    eliminated,
  };
}

// Numeric condition for simulateTournament: fixed group accumulations + final
// orders, fixed third allocation, fixed KO participants/winners. null = the
// unconditioned pre-tournament simulation.
export function buildCondition(state) {
  if (!state || state.matches.length === 0) return null;
  const groups = LETTERS.map((letter) => {
    const teams = GROUPS[letter];
    const byPos = (team) => teams.indexOf(team);
    const pts = [0, 0, 0, 0];
    const gd = [0, 0, 0, 0];
    const gf = [0, 0, 0, 0];
    for (const r of state.tables[letter]) {
      const i = byPos(r.team);
      pts[i] = r.pts;
      gd[i] = r.gd;
      gf[i] = r.gf;
    }
    const played = state.matches.filter((m) => m.id <= 72 && m.group === letter);
    const playedSet = new Set(played.map((m) => pairKey(m.a, m.b)));
    const remaining = PAIRS.filter(([x, y]) => !playedSet.has(pairKey(teams[x], teams[y])));
    return {
      pts,
      gd,
      gf,
      remaining,
      order: state.complete[letter] ? state.order[letter].map((r) => byPos(r.team)) : null,
    };
  });
  const thirds = state.thirds
    ? {
        teamByGroup: Object.fromEntries(
          Object.entries(state.thirds.teamByGroup).map(([g, t]) => [g, TEAM_INDEX[t]])
        ),
        slotAssign: state.slotAssign,
      }
    : null;
  const ko = {};
  for (const [id, r] of Object.entries(state.ko))
    ko[id] = { a: TEAM_INDEX[r.a], b: TEAM_INDEX[r.b], winner: TEAM_INDEX[r.winner] };
  return { groups, thirds, ko, nMatches: state.matches.length };
}

// Team-name normalization for CLI input and external feeds (Kalshi).
const ALIASES = {
  usa: "United States",
  us: "United States",
  "united states of america": "United States",
  turkey: "Türkiye",
  curacao: "Curaçao",
  "congo dr": "DR Congo",
  "dr congo": "DR Congo",
  "congo": "DR Congo",
  "bosnia and herzegovina": "Bosnia & Herzegovina",
  "bosnia-herzegovina": "Bosnia & Herzegovina",
  bosnia: "Bosnia & Herzegovina",
  "czech republic": "Czechia",
  "korea republic": "South Korea",
  korea: "South Korea",
  "cote d'ivoire": "Ivory Coast",
  holland: "Netherlands",
};
const fold = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const CANONICAL = new Map(TEAM_NAMES.map((n) => [fold(n), n]));

export function resolveTeam(name) {
  const f = fold(name);
  return CANONICAL.get(f) ?? ALIASES[f] ?? null;
}
