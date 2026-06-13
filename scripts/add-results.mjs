// Enter match results into the event log (public/data/matches.json) and keep
// the scoreboard's results.json in sync.
//
//   npm run add-results -- "Mexico 2-0 South Africa" "South Korea 2-1 Czechia"
//   npm run add-results -- "Croatia 1-1 Denmark p:Croatia"     (knockout pens)
//
// No date flag: each result is resolved against the fixture schedule (group
// matches) or the bracket as decided by results already in the log (knockouts).
// Re-entering a matchup replaces that match's entry, so typo corrections are
// just a re-run. Nothing is written unless every argument resolves.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GROUP_OF, KO_DATES } from "./sportsbook/data.mjs";
import {
  deriveState,
  loadMatches,
  fixtureForPair,
  resolveTeam,
  scheduledOn,
  ALL_MATCH_DATES,
  STAGE_KEYS,
} from "./sportsbook/state.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MATCHES_PATH = join(ROOT, "public/data/matches.json");
const RESULTS_PATH = join(ROOT, "public/data/results.json");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npm run add-results -- "Team A 2-0 Team B" ["Team C 1-1 Team D p:Team C" ...]');
  process.exit(1);
}

const fail = (msg) => {
  console.error(`✗ ${msg}\n  Nothing was written.`);
  process.exit(1);
};

const matches = loadMatches(MATCHES_PATH);
const upsert = (entry) => {
  const i = matches.findIndex((m) => m.id === entry.id);
  const prev = i >= 0 ? matches[i] : null;
  if (i >= 0) matches[i] = entry;
  else matches.push(entry);
  return prev;
};

const KO_LABEL = (id) =>
  id <= 88 ? "R32" : id <= 96 ? "R16" : id <= 100 ? "QF" : id <= 102 ? "SF" : id === 103 ? "3RD PLACE" : "FINAL";

const report = [];
for (const raw of args) {
  const m = raw.match(/^(.+?)\s+(\d+)\s*[-–:]\s*(\d+)\s+(.+?)(?:\s+p:\s*(.+))?$/);
  if (!m) fail(`Can't parse "${raw}" — expected "Team A 2-0 Team B" (knockout draws: append "p:Winner").`);
  const [, rawA, gaStr, gbStr, rawB, rawPens] = m;
  const a = resolveTeam(rawA);
  const b = resolveTeam(rawB);
  if (!a) fail(`Unknown team "${rawA.trim()}" in "${raw}".`);
  if (!b) fail(`Unknown team "${rawB.trim()}" in "${raw}".`);
  let score = [Number(gaStr), Number(gbStr)];
  const pens = rawPens ? resolveTeam(rawPens) : null;
  if (rawPens && !pens) fail(`Unknown penalty winner "${rawPens.trim()}" in "${raw}".`);
  if (pens && pens !== a && pens !== b) fail(`Penalty winner ${pens} isn't playing in "${raw}".`);

  const fixture = GROUP_OF[a] === GROUP_OF[b] ? fixtureForPair(a, b) : null;
  let entry;
  if (fixture) {
    if (pens) fail(`"${raw}": group matches can't go to penalties.`);
    if (fixture.a !== a) score = [score[1], score[0]];
    entry = { id: fixture.id, date: fixture.date, group: fixture.group, a: fixture.a, b: fixture.b, score };
  } else {
    // Knockout: find the bracket slot whose teams — as decided by the results
    // entered so far — are exactly this pair.
    const state = deriveState(matches);
    const id = Object.keys(state.koTeams)
      .map(Number)
      .find((id) => {
        const [x, y] = state.koTeams[id];
        return (x === a && y === b) || (x === b && y === a);
      });
    if (!id)
      fail(
        `No scheduled match between ${a} and ${b}. They're in different groups, and no knockout slot ` +
          `resolves to that pair yet — are the prerequisite results in the log?`
      );
    if (score[0] === score[1] && !pens) fail(`"${raw}": knockout draws need a winner — append "p:${a}" or "p:${b}".`);
    if (score[0] !== score[1] && pens) fail(`"${raw}": ${score[0]}-${score[1]} isn't a draw — drop the p: part.`);
    const [slotA] = state.koTeams[id];
    if (slotA !== a) score = [score[1], score[0]];
    entry = { id, date: KO_DATES[id], round: KO_LABEL(id), a: slotA, b: slotA === a ? b : a, score };
    if (pens) entry.pens = pens;
  }
  const prev = upsert(entry);
  const tag = entry.group ? `Group ${entry.group}` : entry.round;
  const line = `#${entry.id} ${entry.date} ${tag}: ${entry.a} ${entry.score[0]}-${entry.score[1]} ${entry.b}${entry.pens ? ` (pens: ${entry.pens})` : ""}`;
  report.push(prev ? `↻ ${line}  [replaced ${prev.score[0]}-${prev.score[1]}${prev.pens ? ` p:${prev.pens}` : ""}]` : `+ ${line}`);
}

matches.sort((x, y) => x.id - y.id);

// --- Write the log -------------------------------------------------------------
writeFileSync(
  MATCHES_PATH,
  JSON.stringify(
    {
      _note:
        "Replayable event log of real match results, keyed by match date. Source of truth — results.json and every book snapshot are derived from it. Enter/correct via npm run add-results.",
      matches,
    },
    null,
    2
  ) + "\n"
);

// --- Derive results.json (furthest stage per team) so the scoreboard tracks -----
const state = deriveState(matches);
const stages = {};
for (const [team, st] of Object.entries(state.stageOf).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)))
  stages[team] = STAGE_KEYS[st];
const prevResults = existsSync(RESULTS_PATH) ? JSON.parse(readFileSync(RESULTS_PATH, "utf8")) : {};
writeFileSync(
  RESULTS_PATH,
  JSON.stringify(
    {
      updatedAt: new Date().toISOString().slice(0, 10),
      _note: prevResults._note ?? "Derived from matches.json by add-results — do not edit by hand.",
      stages,
    },
    null,
    2
  ) + "\n"
);

for (const line of report) console.log(line);
console.log(`\nLog: ${matches.length} matches → ${MATCHES_PATH}`);
console.log(`Scoreboard: ${Object.keys(stages).length} teams past the group stage → ${RESULTS_PATH}`);

// --- Completeness warnings -------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const latest = matches.reduce((d, m) => (m.date > d ? m.date : d), "");
const fmtDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
let clean = true;
for (const date of ALL_MATCH_DATES) {
  if (date >= today && date > latest) break;
  const { fixtures, koIds } = scheduledOn(date);
  const scheduled = fixtures.length + koIds.length;
  const entered = matches.filter((x) => x.date === date).length;
  if (entered < scheduled) {
    console.warn(`⚠ ${fmtDate(date)} has ${scheduled} match${scheduled === 1 ? "" : "es"}, ${entered} entered`);
    clean = false;
  }
}
if (!clean) console.warn("  (fine if those games are still in progress — rebuild snapshots after entering them)");
