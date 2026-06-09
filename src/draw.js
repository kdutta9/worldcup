// Teams, the seeded shuffle, and the small constants shared by the draft tool,
// the snapshot board, and the scoreboard. Kept dependency-free.

export const TEAMS = [
  // UEFA (16)
  { name: "Spain", flag: "🇪🇸", conf: "UEFA" },
  { name: "France", flag: "🇫🇷", conf: "UEFA" },
  { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", conf: "UEFA" },
  { name: "Portugal", flag: "🇵🇹", conf: "UEFA" },
  { name: "Germany", flag: "🇩🇪", conf: "UEFA" },
  { name: "Netherlands", flag: "🇳🇱", conf: "UEFA" },
  { name: "Belgium", flag: "🇧🇪", conf: "UEFA" },
  { name: "Croatia", flag: "🇭🇷", conf: "UEFA" },
  { name: "Switzerland", flag: "🇨🇭", conf: "UEFA" },
  { name: "Austria", flag: "🇦🇹", conf: "UEFA" },
  { name: "Norway", flag: "🇳🇴", conf: "UEFA" },
  { name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", conf: "UEFA" },
  { name: "Türkiye", flag: "🇹🇷", conf: "UEFA" },
  { name: "Sweden", flag: "🇸🇪", conf: "UEFA" },
  { name: "Czechia", flag: "🇨🇿", conf: "UEFA" },
  { name: "Bosnia & Herzegovina", flag: "🇧🇦", conf: "UEFA" },
  // CONMEBOL (6)
  { name: "Argentina", flag: "🇦🇷", conf: "CONMEBOL" },
  { name: "Brazil", flag: "🇧🇷", conf: "CONMEBOL" },
  { name: "Uruguay", flag: "🇺🇾", conf: "CONMEBOL" },
  { name: "Colombia", flag: "🇨🇴", conf: "CONMEBOL" },
  { name: "Ecuador", flag: "🇪🇨", conf: "CONMEBOL" },
  { name: "Paraguay", flag: "🇵🇾", conf: "CONMEBOL" },
  // CONCACAF (6)
  { name: "United States", flag: "🇺🇸", conf: "CONCACAF" },
  { name: "Mexico", flag: "🇲🇽", conf: "CONCACAF" },
  { name: "Canada", flag: "🇨🇦", conf: "CONCACAF" },
  { name: "Panama", flag: "🇵🇦", conf: "CONCACAF" },
  { name: "Haiti", flag: "🇭🇹", conf: "CONCACAF" },
  { name: "Curaçao", flag: "🇨🇼", conf: "CONCACAF" },
  // AFC (9)
  { name: "Japan", flag: "🇯🇵", conf: "AFC" },
  { name: "South Korea", flag: "🇰🇷", conf: "AFC" },
  { name: "Iran", flag: "🇮🇷", conf: "AFC" },
  { name: "Australia", flag: "🇦🇺", conf: "AFC" },
  { name: "Saudi Arabia", flag: "🇸🇦", conf: "AFC" },
  { name: "Qatar", flag: "🇶🇦", conf: "AFC" },
  { name: "Uzbekistan", flag: "🇺🇿", conf: "AFC" },
  { name: "Jordan", flag: "🇯🇴", conf: "AFC" },
  { name: "Iraq", flag: "🇮🇶", conf: "AFC" },
  // CAF (10)
  { name: "Morocco", flag: "🇲🇦", conf: "CAF" },
  { name: "Senegal", flag: "🇸🇳", conf: "CAF" },
  { name: "Egypt", flag: "🇪🇬", conf: "CAF" },
  { name: "Algeria", flag: "🇩🇿", conf: "CAF" },
  { name: "Ivory Coast", flag: "🇨🇮", conf: "CAF" },
  { name: "Tunisia", flag: "🇹🇳", conf: "CAF" },
  { name: "Ghana", flag: "🇬🇭", conf: "CAF" },
  { name: "South Africa", flag: "🇿🇦", conf: "CAF" },
  { name: "Cape Verde", flag: "🇨🇻", conf: "CAF" },
  { name: "DR Congo", flag: "🇨🇩", conf: "CAF" },
  // OFC (1)
  { name: "New Zealand", flag: "🇳🇿", conf: "OFC" },
];

export const TEAM_BY_NAME = Object.fromEntries(TEAMS.map((t) => [t.name, t]));

export const CONF_COLOR = {
  UEFA: "#7FB4E0",
  CONMEBOL: "#F0C75E",
  CONCACAF: "#E8806B",
  AFC: "#9ED0A0",
  CAF: "#D9A3E0",
  OFC: "#8EE0D2",
};

export const PLAYER_OPTIONS = [8, 12, 16];
// 8 → 6 teams each, 12 → 4 teams each, 16 → 3 teams each
export const TEAMS_PER_PLAYER = { 8: 6, 12: 4, 16: 3 };
export const MAX_PLAYERS = 16;
export const DEFAULT_NAMES = Array.from({ length: MAX_PLAYERS }, (_, i) => `Player ${i + 1}`);

// xmur3 string hash → mulberry32 PRNG → Fisher–Yates.
// Same seed always produces the same draw — publish source + seed to verify.
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededDraw(seedStr) {
  const rng = mulberry32(xmur3(seedStr)());
  const deck = [...TEAMS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export function randomSeed() {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => n.toString(16).padStart(8, "0")).join("").slice(0, 12).toUpperCase();
}
