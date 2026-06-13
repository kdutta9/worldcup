// Snapshot the market's championship consensus for a date, from Kalshi's public
// API (series KXMENWORLDCUP, the 48-team "Men's World Cup Winner" event).
//
//   node scripts/sportsbook/fetch-consensus.mjs [date ...]   (default: today)
//
// Today's date reads live bid/ask mids in one call; past dates read each
// market's daily candlestick close. Prices are devigged by normalizing over
// alive teams; teams the event log says are eliminated are forced to 0 first.
// Output: scripts/sportsbook/consensus/<date>.json. A sibling
// <date>.overrides.json ({ "Team": rawProb }) patches bad/missing quotes
// before devigging — useful if a market is thin or Kalshi is down for a team.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TEAM_NAMES } from "./data.mjs";
import { deriveState, loadMatches, resolveTeam } from "./state.mjs";

const API = "https://api.elections.kalshi.com/trade-api/v2";
const SERIES = "KXMENWORLDCUP";
const EVENT = "KXMENWORLDCUP-26";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT_DIR = join(HERE, "consensus");
const TODAY = new Date().toISOString().slice(0, 10);

const dates = process.argv.slice(2).length ? process.argv.slice(2) : [TODAY];
for (const d of dates)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > TODAY) {
    console.error(`Bad date "${d}" — want YYYY-MM-DD, not in the future.`);
    process.exit(1);
  }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (path) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`);
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 6) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`Kalshi ${res.status} on ${path}`);
  }
};
const mid = (bid, ask, fallback) => {
  const b = Number(bid);
  const a = Number(ask);
  if (b > 0 && a > 0 && a < 1) return (a + b) / 2;
  return Number(fallback) || 0;
};

// One markets listing serves every date: live prices for today, the ticker ↔
// team mapping (and settlement states) for history.
const { markets } = await get(`/markets?event_ticker=${EVENT}&limit=100`);
if (!markets?.length) throw new Error(`No Kalshi markets for ${EVENT}`);
const teamOf = {};
for (const m of markets) {
  const team = resolveTeam(m.yes_sub_title);
  if (!team) console.warn(`⚠ Can't map Kalshi team "${m.yes_sub_title}" — skipping`);
  else teamOf[m.ticker] = team;
}

const state = deriveState(loadMatches(join(ROOT, "public/data/matches.json")));

async function rawPricesFor(date) {
  const raw = {};
  if (date === TODAY) {
    for (const m of markets) {
      const team = teamOf[m.ticker];
      if (!team) continue;
      raw[team] =
        m.result === "yes" ? 1 : m.result === "no" ? 0 : mid(m.yes_bid_dollars, m.yes_ask_dollars, m.last_price_dollars);
    }
    return { raw, mode: "live" };
  }
  // Daily candlestick close as of end of `date` (US Eastern).
  const endTs = Math.floor(new Date(`${date}T23:59:59-04:00`).getTime() / 1000);
  const startTs = endTs - 3 * 86400; // generous window; we take the last candle
  for (const m of markets) {
    const team = teamOf[m.ticker];
    if (!team) continue;
    const { candlesticks } = await get(
      `/series/${SERIES}/markets/${m.ticker}/candlesticks?start_ts=${startTs}&end_ts=${endTs}&period_interval=1440`
    );
    const c = candlesticks?.at(-1);
    raw[team] = c
      ? mid(c.yes_bid?.close_dollars, c.yes_ask?.close_dollars, c.price?.close_dollars ?? c.price?.previous_dollars)
      : 0;
    await sleep(350);
  }
  return { raw, mode: "history" };
}

mkdirSync(OUT_DIR, { recursive: true });
for (const date of dates) {
  const { raw, mode } = await rawPricesFor(date);

  const overridesPath = join(OUT_DIR, `${date}.overrides.json`);
  if (existsSync(overridesPath)) {
    for (const [name, p] of Object.entries(JSON.parse(readFileSync(overridesPath, "utf8")))) {
      const team = resolveTeam(name);
      if (!team) console.warn(`⚠ Unknown team "${name}" in ${date}.overrides.json`);
      else raw[team] = p;
    }
    console.log(`Applied overrides from ${overridesPath}`);
  }

  for (const team of state.eliminated) raw[team] = 0;
  const missing = TEAM_NAMES.filter((t) => !(t in raw));
  if (missing.length) console.warn(`⚠ No quote for: ${missing.join(", ")} (treated as 0)`);

  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  if (!(sum > 0)) throw new Error(`All prices zero for ${date} — refusing to write`);
  const probs = {};
  for (const t of TEAM_NAMES) probs[t] = +((raw[t] ?? 0) / sum).toFixed(6);

  const out = join(OUT_DIR, `${date}.json`);
  writeFileSync(
    out,
    JSON.stringify(
      { date, source: `kalshi:${EVENT}`, mode, fetchedAt: new Date().toISOString(), overround: +sum.toFixed(4), raw, probs },
      null,
      2
    ) + "\n"
  );
  const top = Object.entries(probs).sort((x, y) => y[1] - x[1]).slice(0, 5);
  console.log(`Wrote ${out} (${mode}; favorites: ${top.map(([t, p]) => `${t} ${(p * 100).toFixed(1)}%`).join(", ")})`);
}
