// Snapshot the market's championship consensus for a date.
//
//   node scripts/sportsbook/fetch-consensus.mjs [date ...]   (default: today)
//
// Live dates blend every source that answers; past dates are Kalshi-only
// (nobody else publishes history):
//
//   kalshi      — series KXMENWORLDCUP, live bid/ask mids today, daily
//                 candlestick closes for past dates. The backbone: a fetch
//                 failure here aborts the date.
//   polymarket  — the "world-cup-winner" event on the public gamma API, live
//                 bid/ask mids. No auth. Failure = warn and blend without it.
//   oddsapi     — The Odds API (the-odds-api.com) sportsbook outrights
//                 (DraftKings / FanDuel / BetMGM…), devigged per bookmaker
//                 then averaged. Needs ODDS_API_KEY in the environment;
//                 skipped with a note when absent.
//
// Each source is devigged independently (eliminated teams forced to 0, then
// normalized over alive teams); the blend is the plain mean of the available
// sources, renormalized. Output: scripts/sportsbook/consensus/<date>.json —
// `probs` is the blend, `sources` keeps every source's raw quotes so a weird
// number can be traced. A sibling <date>.overrides.json ({ "Team": prob })
// patches the blended prob before the final normalize — useful if one team's
// quote is bad everywhere.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TEAM_NAMES } from "./data.mjs";
import { deriveState, loadMatches, resolveTeam } from "./state.mjs";

const API = "https://api.elections.kalshi.com/trade-api/v2";
const SERIES = "KXMENWORLDCUP";
const EVENT = "KXMENWORLDCUP-26";
const POLYMARKET_API = "https://gamma-api.polymarket.com";
const POLYMARKET_SLUG = "world-cup-winner";
const ODDS_API = "https://api.the-odds-api.com/v4";
const ODDS_API_SPORT = "soccer_fifa_world_cup_winner";
// us + us2 + eu: DraftKings plus the Betfair exchange and William Hill — the
// only books currently posting World Cup outrights. 3 quota credits per fetch.
const ODDS_API_REGIONS = "us,us2,eu";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT_DIR = join(HERE, "consensus");
const TODAY = new Date().toISOString().slice(0, 10);

// The Odds API key lives in the environment or in the gitignored .env at the
// repo root (this node predates --env-file). Never commit it.
const ODDS_API_KEY =
  process.env.ODDS_API_KEY ??
  (() => {
    try {
      return readFileSync(join(ROOT, ".env"), "utf8").match(/^ODDS_API_KEY=(.+)$/m)?.[1].trim() ?? null;
    } catch {
      return null;
    }
  })();

// With explicit date args, fetch exactly those. With none, capture what the
// snapshots actually need: closing prices for every played matchday, plus
// today. A date is (re)fetched if its file is missing, is today (refresh live
// prices), or was only an intraday "live" capture now that the day is over and
// closing prices exist — so running this the morning after still gets the right
// closing line, not a stale fallback.
function defaultDates() {
  const matchDates = [...new Set(loadMatches(join(ROOT, "public/data/matches.json")).map((m) => m.date))];
  const needsFetch = (d) => {
    const f = join(OUT_DIR, `${d}.json`);
    if (!existsSync(f)) return true;
    if (d >= TODAY) return true;
    return JSON.parse(readFileSync(f, "utf8")).mode === "live";
  };
  return [...new Set([...matchDates, TODAY])].filter((d) => d <= TODAY && needsFetch(d)).sort();
}

const dates = process.argv.slice(2).length ? process.argv.slice(2) : defaultDates();
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

async function kalshiPrices(date) {
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

async function polymarketPrices() {
  const res = await fetch(`${POLYMARKET_API}/events?slug=${POLYMARKET_SLUG}`);
  if (!res.ok) throw new Error(`Polymarket ${res.status} on events?slug=${POLYMARKET_SLUG}`);
  const [event] = await res.json();
  if (!event?.markets?.length) throw new Error(`Polymarket event "${POLYMARKET_SLUG}" has no markets`);
  const raw = {};
  for (const m of event.markets) {
    const title = m.groupItemTitle ?? "";
    const team = resolveTeam(title);
    if (!team) {
      // The event carries placeholder markets ("Team AG", "Other") and settled
      // non-qualifiers; only an unexpected live market is worth a warning.
      const placeholder = /^team [a-z]{2}$/i.test(title) || /^other$/i.test(title);
      if (!m.closed && !placeholder) console.warn(`⚠ Can't map Polymarket team "${title}" — skipping`);
      continue;
    }
    if (m.closed) {
      const [yes] = JSON.parse(m.outcomePrices ?? '["0"]');
      raw[team] = Number(yes) >= 0.5 ? 1 : 0;
    } else {
      raw[team] = mid(m.bestBid, m.bestAsk, m.lastTradePrice);
    }
  }
  return raw;
}

// Sportsbook outrights via The Odds API. Overrounds differ wildly per book
// (a futures board can carry 30%+), so each bookmaker is devigged on its own
// before averaging — otherwise the juiciest book dominates the blend.
async function oddsApiPrices() {
  const res = await fetch(
    `${ODDS_API}/sports/${ODDS_API_SPORT}/odds?apiKey=${ODDS_API_KEY}&regions=${ODDS_API_REGIONS}&markets=outrights&oddsFormat=decimal`
  );
  if (!res.ok) throw new Error(`The Odds API ${res.status} on ${ODDS_API_SPORT} (key ok? sport key current?)`);
  const events = await res.json();
  const byBook = [];
  const bookmakers = [];
  for (const ev of Array.isArray(events) ? events : [])
    for (const bk of ev.bookmakers ?? []) {
      const outcomes = bk.markets?.find((m) => m.key === "outrights")?.outcomes;
      if (!outcomes?.length) continue;
      const probs = {};
      let sum = 0;
      for (const o of outcomes) {
        const team = resolveTeam(o.name);
        if (!team) {
          console.warn(`⚠ Can't map Odds API team "${o.name}" (${bk.key}) — skipping`);
          continue;
        }
        probs[team] = 1 / Number(o.price);
        sum += probs[team];
      }
      if (!(sum > 0)) continue;
      for (const t in probs) probs[t] /= sum;
      byBook.push(probs);
      bookmakers.push(bk.key);
    }
  if (!byBook.length) throw new Error(`The Odds API returned no priceable outright boards for ${ODDS_API_SPORT}`);
  const raw = {};
  for (const t of TEAM_NAMES) {
    const quotes = byBook.filter((b) => t in b);
    if (quotes.length) raw[t] = quotes.reduce((s, b) => s + b[t], 0) / quotes.length;
  }
  return { raw, bookmakers: bookmakers.sort() };
}

// Force eliminated teams to 0 and normalize over what's left.
function devig(raw) {
  const alive = {};
  for (const t of TEAM_NAMES) alive[t] = state.eliminated.has(t) ? 0 : (raw[t] ?? 0);
  const sum = Object.values(alive).reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  const probs = {};
  for (const t of TEAM_NAMES) probs[t] = alive[t] / sum;
  return probs;
}

// Gather every live source that answers. Kalshi is the backbone — its failure
// propagates; the others degrade to a warning so one flaky API never blocks
// the nightly refresh.
async function liveSources(kalshiRaw) {
  const sources = {
    kalshi: { id: `kalshi:${EVENT}`, raw: kalshiRaw, overround: +Object.values(kalshiRaw).reduce((a, b) => a + b, 0).toFixed(4) },
  };
  try {
    const raw = await polymarketPrices();
    sources.polymarket = {
      id: `polymarket:${POLYMARKET_SLUG}`,
      raw,
      overround: +Object.values(raw).reduce((a, b) => a + b, 0).toFixed(4),
    };
  } catch (e) {
    console.warn(`⚠ Polymarket unavailable (${e.message}) — blending without it`);
  }
  if (ODDS_API_KEY) {
    try {
      const { raw, bookmakers } = await oddsApiPrices();
      sources.oddsapi = { id: `oddsapi:${ODDS_API_SPORT}`, raw, bookmakers };
    } catch (e) {
      console.warn(`⚠ The Odds API unavailable (${e.message}) — blending without it`);
    }
  } else {
    console.log("No ODDS_API_KEY in env — skipping sportsbook consensus (Kalshi + Polymarket only)");
  }
  return sources;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const date of dates) {
  const { raw: kalshiRaw, mode } = await kalshiPrices(date);
  const sources = mode === "live" ? await liveSources(kalshiRaw) : null;

  // Blend: mean of each source's independently devigged probs. History mode
  // reduces to the old single-source path.
  const raw = {};
  if (sources) {
    const devigged = Object.entries(sources)
      .map(([name, s]) => [name, devig(s.raw)])
      .filter(([name, p]) => {
        if (!p) console.warn(`⚠ ${name} quotes sum to zero — dropping from blend`);
        return p;
      });
    for (const t of TEAM_NAMES) raw[t] = devigged.reduce((s, [, p]) => s + p[t], 0) / devigged.length;
  } else {
    Object.assign(raw, kalshiRaw);
  }

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

  const source = sources
    ? Object.values(sources).map((s) => s.id).join(" + ")
    : `kalshi:${EVENT}`;
  const out = join(OUT_DIR, `${date}.json`);
  writeFileSync(
    out,
    JSON.stringify(
      {
        date,
        source,
        mode,
        fetchedAt: new Date().toISOString(),
        ...(sources ? { sources } : { overround: +sum.toFixed(4) }),
        raw,
        probs,
      },
      null,
      2
    ) + "\n"
  );
  const top = Object.entries(probs).sort((x, y) => y[1] - x[1]).slice(0, 5);
  console.log(`Wrote ${out} (${mode}, ${source}; favorites: ${top.map(([t, p]) => `${t} ${(p * 100).toFixed(1)}%`).join(", ")})`);
}
