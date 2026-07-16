// Scoring: a team earns points for the furthest round it reaches. Stage is the
// source of truth (auditable, monotonic as the tournament runs); points are derived
// from this one map. A player's score is the sum of their four teams.

export const STAGE_POINTS = {
  GROUP: 0, // exited the group stage (or still in it)
  R32: 1, // reached the Round of 32
  R16: 2, // reached the Round of 16
  QF: 3, // reached the Quarterfinal
  SF: 4, // reached the Semifinal
  FINALIST: 5, // won the Semifinal — guaranteed at least runner-up, scored as such provisionally
  RUNNER_UP: 5, // lost the Final
  CHAMPION: 8, // won it
};

export const STAGE_LABEL = {
  GROUP: "Group stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  FINALIST: "Finalist",
  RUNNER_UP: "Runner-up",
  CHAMPION: "Champion",
};

export function pointsForStage(stage) {
  return STAGE_POINTS[stage] ?? 0;
}

// group: { players: [{ name, teams: [teamName] }] }, stages: { teamName: STAGE },
// gd: { teamName: goalDifference }. Teams absent from `stages` default to GROUP
// (0) and from `gd` to 0. Returns rows sorted high→low with a competition rank.
//
// Ties break on cumulative goal difference — every team a seat owns, summed
// across every match of the tournament — so a rank is only shared when two seats
// match on points AND on goal difference.
export function computeStandings(group, stages, gd = {}) {
  const rows = group.players.map((p) => {
    const teams = p.teams.map((name) => {
      const stage = stages[name] || "GROUP";
      return { name, stage, points: pointsForStage(stage), gd: gd[name] ?? 0 };
    });
    const total = teams.reduce((sum, t) => sum + t.points, 0);
    const totalGd = teams.reduce((sum, t) => sum + t.gd, 0);
    return { player: p.name, teams, total, gd: totalGd };
  });

  rows.sort((a, b) => b.total - a.total || b.gd - a.gd);

  let lastTotal = null;
  let lastGd = null;
  let lastRank = 0;
  rows.forEach((row, i) => {
    if (row.total !== lastTotal || row.gd !== lastGd) {
      lastRank = i + 1;
      lastTotal = row.total;
      lastGd = row.gd;
    }
    row.rank = lastRank;
  });
  return rows;
}

export function slug(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// --- Data access seam --------------------------------------------------------
// Today these read committed JSON. To go real-time later, swap the bodies for
// Supabase queries (same return shapes) and add a realtime subscription; nothing
// in the views changes.
const DATA = `${import.meta.env?.BASE_URL ?? "/"}data/`;

export const loadResults = () => fetch(`${DATA}results.json`).then((r) => r.json());
export const loadGroupsIndex = () => fetch(`${DATA}groups.json`).then((r) => r.json());
export const loadGroup = (id) => fetch(`${DATA}groups/${id}.json`).then((r) => r.json());
