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

// --- Fixture schedule ---------------------------------------------------------
// The official June 2026 group-stage schedule (verified against ESPN's published
// fixture list). ids 1–72 are ours, assigned in date order; ids 73–104 below are
// FIFA's real match numbers, which the bracket above already uses.
export const GROUP_FIXTURES = [
  { id: 1, date: "2026-06-11", group: "A", a: "Mexico", b: "South Africa" },
  { id: 2, date: "2026-06-11", group: "A", a: "South Korea", b: "Czechia" },
  { id: 3, date: "2026-06-12", group: "B", a: "Canada", b: "Bosnia & Herzegovina" },
  { id: 4, date: "2026-06-12", group: "D", a: "United States", b: "Paraguay" },
  { id: 5, date: "2026-06-13", group: "B", a: "Qatar", b: "Switzerland" },
  { id: 6, date: "2026-06-13", group: "C", a: "Brazil", b: "Morocco" },
  { id: 7, date: "2026-06-13", group: "C", a: "Haiti", b: "Scotland" },
  { id: 8, date: "2026-06-13", group: "D", a: "Australia", b: "Türkiye" },
  { id: 9, date: "2026-06-14", group: "E", a: "Germany", b: "Curaçao" },
  { id: 10, date: "2026-06-14", group: "F", a: "Netherlands", b: "Japan" },
  { id: 11, date: "2026-06-14", group: "E", a: "Ivory Coast", b: "Ecuador" },
  { id: 12, date: "2026-06-14", group: "F", a: "Sweden", b: "Tunisia" },
  { id: 13, date: "2026-06-15", group: "H", a: "Spain", b: "Cape Verde" },
  { id: 14, date: "2026-06-15", group: "G", a: "Belgium", b: "Egypt" },
  { id: 15, date: "2026-06-15", group: "H", a: "Saudi Arabia", b: "Uruguay" },
  { id: 16, date: "2026-06-15", group: "G", a: "Iran", b: "New Zealand" },
  { id: 17, date: "2026-06-16", group: "I", a: "France", b: "Senegal" },
  { id: 18, date: "2026-06-16", group: "I", a: "Iraq", b: "Norway" },
  { id: 19, date: "2026-06-16", group: "J", a: "Argentina", b: "Algeria" },
  { id: 20, date: "2026-06-16", group: "J", a: "Austria", b: "Jordan" },
  { id: 21, date: "2026-06-17", group: "K", a: "Portugal", b: "DR Congo" },
  { id: 22, date: "2026-06-17", group: "L", a: "England", b: "Croatia" },
  { id: 23, date: "2026-06-17", group: "L", a: "Ghana", b: "Panama" },
  { id: 24, date: "2026-06-17", group: "K", a: "Uzbekistan", b: "Colombia" },
  { id: 25, date: "2026-06-18", group: "A", a: "Czechia", b: "South Africa" },
  { id: 26, date: "2026-06-18", group: "B", a: "Switzerland", b: "Bosnia & Herzegovina" },
  { id: 27, date: "2026-06-18", group: "B", a: "Canada", b: "Qatar" },
  { id: 28, date: "2026-06-18", group: "A", a: "Mexico", b: "South Korea" },
  { id: 29, date: "2026-06-19", group: "D", a: "United States", b: "Australia" },
  { id: 30, date: "2026-06-19", group: "C", a: "Scotland", b: "Morocco" },
  { id: 31, date: "2026-06-19", group: "C", a: "Brazil", b: "Haiti" },
  { id: 32, date: "2026-06-19", group: "D", a: "Türkiye", b: "Paraguay" },
  { id: 33, date: "2026-06-20", group: "F", a: "Netherlands", b: "Sweden" },
  { id: 34, date: "2026-06-20", group: "E", a: "Germany", b: "Ivory Coast" },
  { id: 35, date: "2026-06-20", group: "E", a: "Ecuador", b: "Curaçao" },
  { id: 36, date: "2026-06-20", group: "F", a: "Tunisia", b: "Japan" },
  { id: 37, date: "2026-06-21", group: "H", a: "Spain", b: "Saudi Arabia" },
  { id: 38, date: "2026-06-21", group: "G", a: "Belgium", b: "Iran" },
  { id: 39, date: "2026-06-21", group: "H", a: "Uruguay", b: "Cape Verde" },
  { id: 40, date: "2026-06-21", group: "G", a: "New Zealand", b: "Egypt" },
  { id: 41, date: "2026-06-22", group: "J", a: "Argentina", b: "Austria" },
  { id: 42, date: "2026-06-22", group: "I", a: "France", b: "Iraq" },
  { id: 43, date: "2026-06-22", group: "I", a: "Norway", b: "Senegal" },
  { id: 44, date: "2026-06-22", group: "J", a: "Jordan", b: "Algeria" },
  { id: 45, date: "2026-06-23", group: "K", a: "Portugal", b: "Uzbekistan" },
  { id: 46, date: "2026-06-23", group: "L", a: "England", b: "Ghana" },
  { id: 47, date: "2026-06-23", group: "L", a: "Panama", b: "Croatia" },
  { id: 48, date: "2026-06-23", group: "K", a: "Colombia", b: "DR Congo" },
  { id: 49, date: "2026-06-24", group: "B", a: "Switzerland", b: "Canada" },
  { id: 50, date: "2026-06-24", group: "B", a: "Bosnia & Herzegovina", b: "Qatar" },
  { id: 51, date: "2026-06-24", group: "C", a: "Scotland", b: "Brazil" },
  { id: 52, date: "2026-06-24", group: "C", a: "Morocco", b: "Haiti" },
  { id: 53, date: "2026-06-24", group: "A", a: "Czechia", b: "Mexico" },
  { id: 54, date: "2026-06-24", group: "A", a: "South Africa", b: "South Korea" },
  { id: 55, date: "2026-06-25", group: "E", a: "Ecuador", b: "Germany" },
  { id: 56, date: "2026-06-25", group: "E", a: "Curaçao", b: "Ivory Coast" },
  { id: 57, date: "2026-06-25", group: "F", a: "Japan", b: "Sweden" },
  { id: 58, date: "2026-06-25", group: "F", a: "Tunisia", b: "Netherlands" },
  { id: 59, date: "2026-06-25", group: "D", a: "Türkiye", b: "United States" },
  { id: 60, date: "2026-06-25", group: "D", a: "Paraguay", b: "Australia" },
  { id: 61, date: "2026-06-26", group: "I", a: "Norway", b: "France" },
  { id: 62, date: "2026-06-26", group: "I", a: "Senegal", b: "Iraq" },
  { id: 63, date: "2026-06-26", group: "H", a: "Cape Verde", b: "Saudi Arabia" },
  { id: 64, date: "2026-06-26", group: "H", a: "Uruguay", b: "Spain" },
  { id: 65, date: "2026-06-26", group: "G", a: "Egypt", b: "Iran" },
  { id: 66, date: "2026-06-26", group: "G", a: "New Zealand", b: "Belgium" },
  { id: 67, date: "2026-06-27", group: "L", a: "Panama", b: "England" },
  { id: 68, date: "2026-06-27", group: "L", a: "Croatia", b: "Ghana" },
  { id: 69, date: "2026-06-27", group: "K", a: "Colombia", b: "Portugal" },
  { id: 70, date: "2026-06-27", group: "K", a: "DR Congo", b: "Uzbekistan" },
  { id: 71, date: "2026-06-27", group: "J", a: "Algeria", b: "Austria" },
  { id: 72, date: "2026-06-27", group: "J", a: "Jordan", b: "Argentina" },
];

// Knockout match dates by FIFA match number (73–88 R32, 89–96 R16, 97–100 QF,
// 101–102 SF, 103 third place, 104 final). 103 is logged if entered but never
// simulated — both semifinal losers already hold SF points either way.
export const KO_DATES = {
  73: "2026-06-28",
  74: "2026-06-29",
  75: "2026-06-29",
  76: "2026-06-29",
  77: "2026-06-30",
  78: "2026-06-30",
  79: "2026-06-30",
  80: "2026-07-01",
  81: "2026-07-01",
  82: "2026-07-01",
  83: "2026-07-02",
  84: "2026-07-02",
  85: "2026-07-02",
  86: "2026-07-03",
  87: "2026-07-03",
  88: "2026-07-03",
  89: "2026-07-04",
  90: "2026-07-04",
  91: "2026-07-05",
  92: "2026-07-05",
  93: "2026-07-06",
  94: "2026-07-06",
  95: "2026-07-07",
  96: "2026-07-07",
  97: "2026-07-09",
  98: "2026-07-10",
  99: "2026-07-11",
  100: "2026-07-11",
  101: "2026-07-14",
  102: "2026-07-15",
  103: "2026-07-18",
  104: "2026-07-19",
};

export function koStageOf(id) {
  if (id <= 88) return STAGE.R32;
  if (id <= 96) return STAGE.R16;
  if (id <= 100) return STAGE.QF;
  if (id <= 102) return STAGE.SF;
  return STAGE.CHAMPION; // 104; 103 (third place) never reaches the engine
}
