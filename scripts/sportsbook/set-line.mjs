// Pin a date's title consensus to a real sportsbook's posted odds.
//
//   node scripts/sportsbook/set-line.mjs 2026-07-16 "Spain -165" "Argentina +130"
//
// Writes scripts/sportsbook/consensus/<date>.overrides.json. fetch-consensus
// applies that file to the blend before its final normalize, so the vig in the
// prices you paste is removed for you and the numbers land as true probabilities
// (-165/+130 is a 105.7% book → Spain 58.9%, Argentina 41.1%).
//
// Why this exists: Kalshi is the consensus backbone and its daily-close history
// can lag reality — after a semifinal it may still be pricing a team that is
// already out, which drags the favorite far off the real market. When the board
// you actually trust disagrees, paste it in and move on.
//
// Scope: the odds you pass are treated as a complete market and normalized among
// themselves, so pass EVERY team still alive on that date. The script refuses if
// you miss one.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deriveState, loadMatches, resolveTeam } from "./state.mjs";
import { TEAM_NAMES } from "./data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(ROOT, "scripts/sportsbook/consensus");

const argv = process.argv.slice(2);
const [date, ...quotes] = argv;

const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || quotes.length === 0)
  die(`Usage: node scripts/sportsbook/set-line.mjs <YYYY-MM-DD> "Team -165" "Team +130" …`);

// American odds → implied probability. Accepts a typographic minus, since these
// get pasted straight off a book (or off our own sheet).
function implied(odds) {
  const n = Number(odds.replace("−", "-").replace("+", ""));
  if (!Number.isFinite(n) || n === 0) return null;
  return n < 0 ? -n / (-n + 100) : 100 / (n + 100);
}

const parsed = quotes.map((q) => {
  const m = q.trim().match(/^(.+?)\s+([−+-]?\d+)$/);
  if (!m) die(`Can't parse "${q}" — expected e.g. "Spain -165".`);
  const team = resolveTeam(m[1]);
  if (!team) die(`Unknown team "${m[1].trim()}" in "${q}".`);
  const p = implied(m[2]);
  if (p == null) die(`Bad odds "${m[2]}" in "${q}".`);
  return { team, odds: m[2], raw: p };
});

// Every alive team must be quoted, or normalizing among the ones given would
// silently hand the missing team's probability to the others.
const alive = TEAM_NAMES.filter((t) => {
  const st = deriveState(loadMatches(join(ROOT, "public/data/matches.json")).filter((m) => m.date <= date));
  return !st.eliminated.has(t);
});
const missing = alive.filter((t) => !parsed.some((p) => p.team === t));
if (missing.length)
  die(
    `Still alive on ${date} but not quoted: ${missing.join(", ")}.\n` +
      `  Pass every live team — this file is normalized as a complete market.`
  );

const book = parsed.reduce((s, p) => s + p.raw, 0);
const out = {};
for (const p of parsed) out[p.team] = +(p.raw / book).toFixed(6);

writeFileSync(join(OUT_DIR, `${date}.overrides.json`), JSON.stringify(out, null, 2) + "\n");

console.log(`Book as posted: ${(book * 100).toFixed(1)}% (the vig)`);
for (const p of parsed) console.log(`  ${p.team.padEnd(12)} ${p.odds.padStart(6)}  →  ${(out[p.team] * 100).toFixed(1)}%`);
console.log(`\nWrote ${join(OUT_DIR, `${date}.overrides.json`)}`);
console.log(`Next: node scripts/sportsbook/fetch-consensus.mjs ${date}`);
