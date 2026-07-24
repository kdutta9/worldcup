export const STAGE_POINTS = {
  GROUP: 0,
  R32: 1,
  R16: 2,
  QF: 3,
  SF: 4,
  FOURTH: 4,
  THIRD: 4,
  FINALIST: 5,
  RUNNER_UP: 5,
  CHAMPION: 8,
};

export const STAGE_LABEL = {
  GROUP: "Group stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  FOURTH: "4th Place",
  THIRD: "3rd Place",
  FINALIST: "Finalist",
  RUNNER_UP: "Runner-up",
  CHAMPION: "Champion",
};

export function pointsForStage(stage) {
  return STAGE_POINTS[stage] ?? 0;
}

export function computeStandings(group, stages, gd = {}, tiebreak = "gd") {
  const useGd = tiebreak === "gd";
  const rows = group.players.map((p) => {
    const teams = p.teams.map((name) => {
      const stage = stages[name] || "GROUP";
      return { name, stage, points: pointsForStage(stage), gd: gd[name] ?? 0 };
    });
    const total = teams.reduce((sum, t) => sum + t.points, 0);
    const totalGd = teams.reduce((sum, t) => sum + t.gd, 0);
    return { player: p.name, teams, total, gd: totalGd };
  });

  rows.sort((a, b) => b.total - a.total || (useGd ? b.gd - a.gd : 0));

  let lastTotal = null;
  let lastGd = null;
  let lastRank = 0;
  rows.forEach((row, i) => {
    if (row.total !== lastTotal || (useGd && row.gd !== lastGd)) {
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
