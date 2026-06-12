// Tournament structure + market consensus for the sportsbook simulator.
//
// GROUPS is the real December 2025 draw (verified against the SOSK sheet and
// FIFA's published schedule). CONSENSUS_TITLE_ODDS is the devigged pre-tournament
// championship consensus (DraftKings · FanDuel · Kalshi · ESPN, June 9 2026) —
// spot-checked against the live market: Spain +475, France +475, England +700,
// Portugal +850, Brazil/Argentina +950.

export const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czechia"],
  B: ["Canada", "Switzerland", "Qatar", "Bosnia & Herzegovina"],
  C: ["Brazil", "Morocco", "Scotland", "Haiti"],
  D: ["United States", "Türkiye", "Paraguay", "Australia"],
  E: ["Germany", "Ecuador", "Ivory Coast", "Curaçao"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Uruguay", "Saudi Arabia", "Cape Verde"],
  I: ["France", "Norway", "Senegal", "Iraq"],
  J: ["Argentina", "Austria", "Algeria", "Jordan"],
  K: ["Portugal", "Colombia", "DR Congo", "Uzbekistan"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

export const TEAM_NAMES = Object.values(GROUPS).flat();
export const TEAM_INDEX = Object.fromEntries(TEAM_NAMES.map((n, i) => [n, i]));
export const GROUP_OF = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([g, teams]) => teams.map((t) => [t, g]))
);

// American odds → implied probability, normalized below to a proper distribution.
export const CONSENSUS_TITLE_ODDS = {
  Spain: 468,
  France: 485,
  England: 733,
  Portugal: 851,
  Brazil: 951,
  Argentina: 958,
  Germany: 1452,
  Netherlands: 2024,
  Norway: 3624,
  Belgium: 4120,
  Colombia: 4199,
  Morocco: 5517,
  Japan: 5756,
  "United States": 6037,
  Mexico: 6393,
  Uruguay: 6500,
  Switzerland: 7548,
  Ecuador: 8000,
  "Türkiye": 8594,
  Croatia: 9000,
  Senegal: 9000,
  Sweden: 12000,
  Austria: 15000,
  Scotland: 20000,
  Canada: 21177,
  Czechia: 25000,
  "Ivory Coast": 25000,
  Egypt: 30000,
  Paraguay: 30000,
  Ghana: 30000,
  Algeria: 35000,
  "South Korea": 40000,
  "Bosnia & Herzegovina": 50000,
  Tunisia: 50000,
  Australia: 60000,
  Iran: 70000,
  "Saudi Arabia": 100000,
  "Cape Verde": 100000,
  "DR Congo": 100000,
  "South Africa": 100000,
  Panama: 100000,
  Uzbekistan: 150000,
  "New Zealand": 150000,
  Qatar: 150000,
  Iraq: 150000,
  Jordan: 250000,
  Haiti: 250000,
  "Curaçao": 250000,
};

// Normalized target championship probabilities, indexed like TEAM_NAMES.
export function targetTitleProbs() {
  const implied = TEAM_NAMES.map((n) => {
    const odds = CONSENSUS_TITLE_ODDS[n];
    if (odds == null) throw new Error(`No consensus odds for ${n}`);
    return 100 / (odds + 100);
  });
  const sum = implied.reduce((a, b) => a + b, 0);
  return implied.map((p) => p / sum);
}

// --- FIFA knockout bracket (matches 73–104) ----------------------------------
// W = group winner, R = runner-up, T = best third (allowed source groups listed;
// FIFA's allocation guarantees no team meets its own group winner).
export const R32 = [
  { id: 73, a: ["R", "A"], b: ["R", "B"] },
  { id: 74, a: ["W", "E"], b: ["T", "ABCDF"] },
  { id: 75, a: ["W", "F"], b: ["R", "C"] },
  { id: 76, a: ["W", "C"], b: ["R", "F"] },
  { id: 77, a: ["W", "I"], b: ["T", "CDFGH"] },
  { id: 78, a: ["R", "E"], b: ["R", "I"] },
  { id: 79, a: ["W", "A"], b: ["T", "CEFHI"] },
  { id: 80, a: ["W", "L"], b: ["T", "EHIJK"] },
  { id: 81, a: ["W", "D"], b: ["T", "BEFIJ"] },
  { id: 82, a: ["W", "G"], b: ["T", "AEHIJ"] },
  { id: 83, a: ["R", "K"], b: ["R", "L"] },
  { id: 84, a: ["W", "H"], b: ["R", "J"] },
  { id: 85, a: ["W", "B"], b: ["T", "EFGIJ"] },
  { id: 86, a: ["W", "J"], b: ["R", "H"] },
  { id: 87, a: ["W", "K"], b: ["T", "DEIJL"] },
  { id: 88, a: ["R", "D"], b: ["R", "G"] },
];

// Round of 16 onward, by feeder match id. Winners advance left-to-right:
// R16 → QF (97–100) → SF (101–102) → Final.
export const R16 = [
  { id: 89, a: 74, b: 77 },
  { id: 90, a: 73, b: 75 },
  { id: 91, a: 76, b: 78 },
  { id: 92, a: 79, b: 80 },
  { id: 93, a: 83, b: 84 },
  { id: 94, a: 81, b: 82 },
  { id: 95, a: 86, b: 88 },
  { id: 96, a: 85, b: 87 },
];
export const QF = [
  { id: 97, a: 89, b: 90 },
  { id: 98, a: 93, b: 94 },
  { id: 99, a: 91, b: 92 },
  { id: 100, a: 95, b: 96 },
];
export const SF = [
  { id: 101, a: 97, b: 98 },
  { id: 102, a: 99, b: 100 },
];

// Stage encoding shared by the engine and the book builder.
export const STAGE = { GROUP: 0, R32: 1, R16: 2, QF: 3, SF: 4, RUNNER_UP: 5, CHAMPION: 6 };
export const STAGE_POINTS = [0, 1, 2, 3, 4, 5, 8];
