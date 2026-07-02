import { useState, useEffect } from "react";
import { TEAM_BY_NAME } from "./draw";
import { loadGroupsIndex } from "./scoring";

// `?book=<id>` → that group's sportsbook sheet. `?book` → list of books.
// Data is precomputed by scripts/sportsbook/build-books.mjs from 400k Monte
// Carlo tournaments calibrated to the market consensus; this view only renders
// the JSON. books/<id>/index.json lists the entries — "open" (the committed
// pre-tournament book at books/<id>.json) followed by one dated snapshot per
// matchday (books/<id>/<date>.json). No index file = a book with only the
// opening lines.

const DATA = `${import.meta.env?.BASE_URL ?? "/"}data/`;
const fetchJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject()));
const entryUrl = (id, key) => (key === "open" ? `${DATA}books/${id}.json` : `${DATA}books/${id}/${key}.json`);
const loadIndex = (id) =>
  fetch(`${DATA}books/${id}/index.json`)
    .then((r) => (r.ok ? r.json() : { entries: ["open"] }))
    .catch(() => ({ entries: ["open"] }));

// Snapshots are keyed by match date (the event-log key), but displayed as the
// next-morning line: the sheet you read on the 13th has absorbed the 12th's
// results. The fine print still cites the actual match/consensus dates.
const entryLabel = (key) => {
  if (key === "open") return "OPEN";
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
};

export default function Sportsbook({ bookId }) {
  const [state, setState] = useState({ status: "loading", entries: null, books: null, index: null });
  const [cur, setCur] = useState(0);
  useEffect(() => {
    let live = true;
    if (bookId) {
      loadIndex(bookId)
        .then(({ entries }) =>
          Promise.all(entries.map((key) => fetchJson(entryUrl(bookId, key)))).then((books) => ({ entries, books }))
        )
        .then(({ entries, books }) => {
          if (!live) return;
          setState({ status: "ok", entries, books, index: null });
          setCur(entries.length - 1); // newest snapshot by default
        })
        .catch(() => live && setState({ status: "error", entries: null, books: null, index: null }));
    } else {
      loadGroupsIndex()
        .then((index) => live && setState({ status: "ok", entries: null, books: null, index }))
        .catch(() => live && setState({ status: "error", entries: null, books: null, index: null }));
    }
    return () => {
      live = false;
    };
  }, [bookId]);

  return (
    <div className="book-root">
      <div className="book-wrap">
        {state.status === "loading" && <p className="state-msg">Opening the book…</p>}
        {state.status === "error" && (
          <p className="state-msg">No book posted for this group. <a className="bk-link" href="./">Back to the lobby</a></p>
        )}
        {state.status === "ok" && state.index && <BookList index={state.index} />}
        {state.status === "ok" && state.books && (
          <Book
            book={state.books[cur]}
            prev={cur > 0 ? state.books[cur - 1] : null}
            entries={state.entries}
            books={state.books}
            cur={cur}
            onNav={setCur}
          />
        )}
      </div>
    </div>
  );
}

function BookList({ index }) {
  useEffect(() => {
    document.title = "The Sportsbook · World Cup Lotto '26";
  }, []);
  return (
    <>
      <header className="bk-head">
        <p className="bk-eyebrow">THE HOUSE ALWAYS WINS</p>
        <h1 className="bk-title">THE SPORTSBOOK</h1>
        <p className="bk-sub">Pick your poison</p>
      </header>
      <div className="group-list" style={{ marginTop: 28 }}>
        {index.map((g) => (
          <a key={g.id} className="group-link" href={`?book=${g.id}`}>
            <div className="gl-name">{g.name}</div>
            <div className="gl-meta">Open the book →</div>
          </a>
        ))}
      </div>
    </>
  );
}

const Flags = ({ teams, big }) => (
  <span className={big ? "bk-flags big" : "bk-flags"}>
    {teams.map((t) => (
      <span key={t} title={t}>{TEAM_BY_NAME[t]?.flag ?? "🏳️"}</span>
    ))}
  </span>
);

function SnapNav({ entries, cur, onNav }) {
  return (
    <div className="bk-nav">
      <button className="bk-nav-btn" disabled={cur === 0} onClick={() => onNav(cur - 1)}>
        ‹ PREV
      </button>
      <select className="bk-nav-select" value={cur} onChange={(e) => onNav(Number(e.target.value))}>
        {entries.map((key, i) => (
          <option key={key} value={i}>
            {key === "open" ? "OPENING LINES" : entryLabel(key)}
          </option>
        ))}
      </select>
      <button className="bk-nav-btn" disabled={cur === entries.length - 1} onClick={() => onNav(cur + 1)}>
        NEXT ›
      </button>
    </div>
  );
}

function Book({ book, prev, entries, books, cur, onNav }) {
  const m = book.meta;
  useEffect(() => {
    document.title = `${book.name} Sportsbook · World Cup Lotto '26`;
  }, [book.name]);
  return (
    <>
      <header className="bk-head">
        <p className="bk-eyebrow">THE HOUSE ALWAYS WINS</p>
        <h1 className="bk-title">{book.bookName}</h1>
        <p className="bk-sub">
          {book.tagline} · World Cup Lotto '26{m.seed ? <> · Seed <code>{m.seed}</code></> : null}
        </p>
        {book.stakes && (
          <div className="bk-chips">
            <span className="bk-chip">Buy-in <b>{book.stakes.buyIn}</b></span>
            <span className="bk-chip">Pot <b>{book.stakes.pot}</b></span>
            {book.stakes.payouts.map((p) => (
              <span key={p} className="bk-chip">{p}</span>
            ))}
          </div>
        )}
        <div className="bk-banner">
          LINES BUILT FROM {m.sources}
          {m.date ? ` · ${entryLabel(m.date)} MORNING LINE` : " · OPENING SHEET"}
        </div>
        {entries.length > 1 && <SnapNav entries={entries} cur={cur} onNav={onNav} />}
      </header>

      {book.morningLine && <MorningLine ml={book.morningLine} prev={prev?.morningLine} />}

      {book.faction && <Faction f={book.faction} prev={prev?.faction} />}

      <Panel title="OUTRIGHT — TO WIN THE POOL" blurb={book.copy.outright}>
        <MarketRows rows={book.outright} prevRows={prev?.outright} kind="outright" tags />
      </Panel>

      {books.length > 1 && <LineMovement entries={entries} books={books} cur={cur} />}

      <div className="bk-grid2">
        <Panel title="TO CASH — TOP 3 FINISH" blurb={book.copy.toCash}>
          <MarketRows rows={book.toCash} prevRows={prev?.toCash} kind="toCash" compact />
        </Panel>
        <Panel title="THE WOODEN SPOON — LAST PLACE" blurb={book.copy.spoon}>
          <MarketRows rows={book.spoon} prevRows={prev?.spoon} kind="spoon" compact />
        </Panel>
      </div>

      <Panel title="HEAD-TO-HEAD — TOP SHELF MATCHUPS" blurb={book.copy.h2h}>
        <div className="bk-h2h-grid">
          {book.h2h.map((x) => (
            <H2H key={`${x.a}-${x.b}`} x={x} prev={matchPair(prev?.h2h, x)} />
          ))}
        </div>
      </Panel>

      {book.grudges && (
        <Panel title={book.grudges.title} blurb={book.grudges.blurb}>
          <div className="bk-h2h-grid">
            {book.grudges.pairs.map((x) => (
              <H2H key={`${x.a}-${x.b}`} x={x} prev={matchPair(prev?.grudges?.pairs, x)} vs={`— ${x.note} —`} />
            ))}
          </div>
        </Panel>
      )}

      {book.caleb && (
        <Panel title={book.caleb.title} blurb={book.caleb.blurb}>
          <div className="bk-rows">
            {book.caleb.bets.map((b) => {
              const was = prev?.caleb?.bets?.find((o) => o.label === b.label)?.price;
              return (
                <div key={b.label} className="bk-row">
                  <span className="bk-caleb-label">{b.label}</span>
                  <span className="bk-line-right">
                    <PriceMove now={b.price} was={was} />
                    <span className="bk-price">{b.price ?? "—"}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Watch w={book.watch} prevW={prev?.watch} blurb={book.copy.watch} />

      <Panel title="THE ROSTERS" blurb="Every seat's teams, with each team's chance of getting out of its group and expected pool points.">
        {book.rosters.map((r) => (
          <Roster key={r.player} r={r} />
        ))}
      </Panel>

      <footer className="bk-fine-block">
        <p className="bk-fine">
          <b>HOW THE SAUSAGE IS MADE.</b> Team strengths are calibrated so that simulated championship
          probabilities match the market consensus
          ({m.consensusDate ? `closing prices of ${m.consensusDate}` : `${m.sources.toLowerCase()}, June 2026`}, devigged).
          {m.matchesConditioned
            ? ` The ${m.matchesConditioned} matches played through ${m.date} are locked in as fact; the rest of the tournament`
            : " The full 2026 World Cup"}{" "}
          — real groups, real FIFA bracket, best-eight third-place advancement — was
          simulated {m.sims.toLocaleString()} times. Pool scoring per the official World Cup Lotto '26 rules:
          1 pt for making the Round of 32, 2 for the Round of 16, 3 for the quarters, 4 for the semis,
          5 for losing the final, 8 for the champion (each team counts once, at its furthest stage).
        </p>
        <p className="bk-fine">
          <b>HOUSE RULES.</b> All prices include the house's margin. Dead heats split stakes and payouts.
          {m.date
            ? ` Lines reprice overnight after each matchday — these are the ${entryLabel(m.date)} morning lines, reflecting all results through ${m.date}. Settled markets come off the board.`
            : " All lines subject to movement; the book closed at kickoff of the opener, June 11."}
        </p>
        <p className="bk-fine">
          <b>FOR ENTERTAINMENT ONLY.</b> Not real bets, no real money, no refunds.
          {m.seed ? ` Pool draw reproduced deterministically from seed ${m.seed} (xmur3 → mulberry32 → Fisher–Yates).` : ""} Lines
          generated {m.generated}.
        </p>
        <p className="bk-foot">{book.bookName} · EST. JUNE 2026 · NO REFUNDS</p>
        <p className="bk-foot-nav">
          <a className="bk-link" href={`?scores=${book.id}`}>Live standings</a> · <a className="bk-link" href="./">Draft lobby</a>
        </p>
      </footer>
    </>
  );
}

function MorningLine({ ml, prev }) {
  return (
    <details className="bk-panel bk-morning" open>
      <summary className="bk-morning-sum">
        <span className="bk-panel-title bk-morning-title">{ml.title}</span>
        <span className="bk-morning-caret" aria-hidden="true">▾</span>
      </summary>
      {ml.blurb && <p className="bk-blurb">{ml.blurb}</p>}
      <div className="bk-rows">
        {ml.bets.map((b) => {
          const was = prev?.bets?.find((o) => o.label === b.label)?.price;
          return (
            <div key={b.label} className="bk-row">
              <span className="bk-caleb-label">{b.label}</span>
              <span className="bk-line-right">
                <PriceMove now={b.price} was={was} />
                <span className="bk-price">{b.price ?? "—"}</span>
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function Panel({ title, blurb, children }) {
  return (
    <section className="bk-panel">
      <h2 className="bk-panel-title">{title}</h2>
      {blurb && <p className="bk-blurb">{blurb}</p>}
      {children}
    </section>
  );
}

// Settled-market badges per market kind ("locked" = certain, "dead" = impossible).
const SETTLED_LABEL = {
  outright: { locked: "CHAMP ✓", dead: "ELIMINATED" },
  toCash: { locked: "CASHED ✓", dead: "DEAD" },
  spoon: { locked: "SPOONED", dead: "SAFE" },
};

function Move({ row, prevRows }) {
  if (!prevRows || row.status) return null;
  const old = prevRows.find((r) => r.player === row.player);
  if (!old || old.status || old.price == null || row.price == null) return null;
  if (old.fairPct === row.fairPct || old.price === row.price) return null;
  const up = row.fairPct > old.fairPct; // probability up = price shortening
  return (
    <span className={`bk-move ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {old.price} → {row.price}
    </span>
  );
}

// American-odds string ("−160" / "+115") → implied probability, for markets
// that carry a price but no stored fairPct (faction lines).
function impliedProb(s) {
  if (!s) return null;
  const neg = s[0] === "−" || s[0] === "-";
  const n = Number(s.slice(1));
  if (!Number.isFinite(n)) return null;
  return neg ? n / (n + 100) : 100 / (n + 100);
}

// Movement of a single price between sheets. `was` is omitted when the prior
// line isn't comparable (e.g. the spread flipped sides), so nothing renders.
// `prefix` disambiguates when two prices share a row (e.g. "O " on a total).
function PriceMove({ now, was, prefix = "" }) {
  if (!now || !was || now === was) return null;
  const p0 = impliedProb(was);
  const p1 = impliedProb(now);
  if (p0 == null || p1 == null) return null;
  const up = p1 > p0; // probability up = price shortening
  return (
    <span className={`bk-move ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {prefix}{was} → {now}
    </span>
  );
}

// Find a pairwise market (h2h / grudge) for the same two players in a prior
// sheet, re-oriented to the current row's a/b order (the top-shelf shelf can
// reorder between sheets). Returns prices/settled keyed to the current row.
function matchPair(arr, x) {
  if (!arr) return null;
  const direct = arr.find((p) => p.a === x.a && p.b === x.b);
  if (direct) return direct;
  const swap = arr.find((p) => p.a === x.b && p.b === x.a);
  if (!swap) return null;
  const flip = (s) => (s === "a" ? "b" : s === "b" ? "a" : s);
  return { priceA: swap.priceB, priceB: swap.priceA, settled: flip(swap.settled) };
}

function MarketRows({ rows, prevRows, kind, tags, compact }) {
  return (
    <div className="bk-rows">
      {rows.map((r, i) => (
        <div key={r.player} className="bk-row">
          <div className="bk-row-main">
            <span className="bk-player">
              {r.player}
              {tags && i === 0 && !r.status && <span className="bk-tag fav">FAVORITE</span>}
              {tags && i === rows.length - 1 && !r.status && <span className="bk-tag dog">LONGSHOT</span>}
            </span>
            {compact ? (
              <Flags teams={r.teams} />
            ) : (
              <span className="bk-teamline">
                {r.teams.map((t, j) => (
                  <span key={t}>
                    {TEAM_BY_NAME[t]?.flag} {t}
                    {j < r.teams.length - 1 ? " · " : ""}
                  </span>
                ))}
              </span>
            )}
            <Move row={r} prevRows={prevRows} />
          </div>
          {r.status ? (
            <span className={`bk-price bk-settled ${r.status}`}>{SETTLED_LABEL[kind][r.status]}</span>
          ) : (
            <span className="bk-price">{r.price}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function H2H({ x, prev, vs = "— VS —" }) {
  return (
    <div className="bk-h2h">
      <div className="bk-h2h-side">
        <span>{x.a}{x.settled === "a" ? " ✓" : ""}</span>
        <span className="bk-line-right">
          <PriceMove now={x.priceA} was={prev?.priceA} />
          <span className="bk-price">{x.priceA ?? "—"}</span>
        </span>
      </div>
      <div className="bk-h2h-vs">{vs}</div>
      <div className="bk-h2h-side">
        <span>{x.b}{x.settled === "b" ? " ✓" : ""}</span>
        <span className="bk-line-right">
          <PriceMove now={x.priceB} was={prev?.priceB} />
          <span className="bk-price">{x.priceB ?? "—"}</span>
        </span>
      </div>
    </div>
  );
}

// Each seat's outright win probability across every posted sheet.
const CHART_COLORS = [
  "#E4C46A", "#7FB3FF", "#FF8A7A", "#7FE3A8", "#D9A0FF", "#FFD27F",
  "#7FE9E3", "#FF9FC6", "#B8E97F", "#9FA8FF", "#FFB37F", "#C9CDD6",
];

function LineMovement({ entries, books, cur }) {
  const latest = books[books.length - 1];
  const players = latest.outright.map((r) => r.player);
  const series = players.map((pl) =>
    books.map((b) => b.outright.find((r) => r.player === pl)).map((r) => (r ? r.fairPct : 0))
  );
  const maxY = Math.max(1, ...series.flat());
  const W = 720;
  const H = 250;
  const padL = 42;
  const padR = 14;
  const padT = 12;
  const padB = 30;
  const x = (i) => (entries.length === 1 ? padL : padL + (i * (W - padL - padR)) / (entries.length - 1));
  const y = (v) => padT + (1 - v / maxY) * (H - padT - padB);
  const gridVals = [0, maxY / 2, maxY];
  const labelEvery = Math.max(1, Math.ceil(entries.length / 9));
  return (
    <Panel
      title="LINE MOVEMENT — OUTRIGHT PRICE BY SHEET"
      blurb="Each seat's fair chance of winning the pool, sheet over sheet. Climbing = the market likes your tournament; sliding = your teams are letting you down."
    >
      <svg className="bk-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Outright win probability by sheet">
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="rgba(237,232,218,0.5)">
              {v.toFixed(0)}%
            </text>
          </g>
        ))}
        <line
          x1={x(cur)}
          y1={padT}
          x2={x(cur)}
          y2={H - padB}
          stroke="rgba(201,162,75,0.45)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {entries.map((key, i) =>
          i % labelEvery === 0 || i === entries.length - 1 ? (
            <text
              key={key}
              x={x(i)}
              y={H - padB + 14}
              textAnchor="middle"
              fontSize="9"
              fill={i === cur ? "#E4C46A" : "rgba(237,232,218,0.55)"}
            >
              {entryLabel(key)}
            </text>
          ) : null
        )}
        {series.map((vals, p) => (
          <g key={players[p]}>
            <polyline
              points={vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={CHART_COLORS[p % CHART_COLORS.length]}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {vals.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={i === cur ? 3 : 1.8} fill={CHART_COLORS[p % CHART_COLORS.length]}>
                <title>{`${players[p]} — ${entryLabel(entries[i])}: ${v}%`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <div className="bk-legend">
        {players.map((pl, p) => {
          const row = books[cur].outright.find((r) => r.player === pl);
          return (
            <span key={pl} className="bk-leg">
              <span className="bk-leg-swatch" style={{ background: CHART_COLORS[p % CHART_COLORS.length] }} />
              {pl} <b>{row?.status ? SETTLED_LABEL.outright[row.status] : row?.price ?? "—"}</b>
            </span>
          );
        })}
      </div>
    </Panel>
  );
}

function FactionLine({ label, now, was, sm }) {
  return (
    <div className="bk-line">
      <span>{label}</span>
      <span className="bk-line-right">
        <PriceMove now={now} was={was} />
        <span className={sm ? "bk-price sm" : "bk-price"}>{now ?? "—"}</span>
      </span>
    </div>
  );
}

function Faction({ f, prev }) {
  const Side = ({ s, ps }) => (
    <div className="bk-side">
      <h3 className="bk-side-name">{s.name}</h3>
      {s.players.map((p) => (
        <div key={p.name} className="bk-side-player">
          <span>{p.name}</span> <Flags teams={p.teams} />
        </div>
      ))}
      <div className="bk-side-lines">
        <FactionLine label="Moneyline" now={s.moneyline} was={ps?.moneyline} />
        <FactionLine
          label={`Spread ${s.spread.line}`}
          now={s.spread.price}
          was={ps?.spread?.line === s.spread.line ? ps.spread.price : undefined}
        />
        <div className="bk-line">
          <span>Team Total O/U {s.total.line}</span>
          <span className="bk-line-right">
            <PriceMove now={s.total.over} was={ps?.total?.line === s.total.line ? ps.total.over : undefined} prefix="O " />
            <span className="bk-price sm">O {s.total.over ?? "—"} · U {s.total.under ?? "—"}</span>
          </span>
        </div>
        <div className="bk-line dim"><span>Avg points</span><span>{s.avg}</span></div>
      </div>
    </div>
  );
  return (
    <Panel title={f.title} blurb={f.blurb}>
      <div className="bk-vs-grid">
        <Side s={f.a} ps={prev?.a} />
        <div className="bk-vs">VS</div>
        <Side s={f.b} ps={prev?.b} />
      </div>
    </Panel>
  );
}

// Compact directional tick for dense cells (alt-lines table) — direction only,
// no old→new text, so the table stays readable.
function tick(now, was) {
  if (!now || !was || now === was) return null;
  const p0 = impliedProb(was);
  const p1 = impliedProb(now);
  if (p0 == null || p1 == null) return null;
  const up = p1 > p0;
  return <span className={`bk-tick ${up ? "up" : "down"}`}>{up ? "▲" : "▼"}</span>;
}

function Watch({ w, prevW, blurb }) {
  const maxPct = Math.max(...w.hist.map((h) => h.pct));
  const main = w.ladder.find((l) => l.line === w.mainLine);
  const prevAt = (line) => prevW?.ladder?.find((l) => l.line === line);
  const mainPrev = main ? prevAt(main.line) : null;
  return (
    <Panel title={w.title} blurb={blurb}>
      {main && (
        <div className="bk-mainline">
          <div className="bk-line">
            <span>Over {main.line} pts</span>
            <span className="bk-line-right">
              <PriceMove now={main.over} was={mainPrev?.over} />
              <span className="bk-price">{main.over}</span>
            </span>
          </div>
          <div className="bk-line">
            <span>Under {main.line} pts</span>
            <span className="bk-line-right">
              <PriceMove now={main.under} was={mainPrev?.under} />
              <span className="bk-price">{main.under}</span>
            </span>
          </div>
        </div>
      )}
      {w.ladder.length > 0 && (
        <>
          <h4 className="bk-subhead">ALT LINES LADDER</h4>
          <table className="bk-table ladder">
            <thead>
              <tr><th>LINE</th><th>OVER</th><th>UNDER</th></tr>
            </thead>
            <tbody>
              {w.ladder.map((l) => {
                const pl = prevAt(l.line);
                return (
                  <tr key={l.line} className={l.line === w.mainLine ? "main" : ""}>
                    <td>{l.line}</td>
                    <td>{l.over} {tick(l.over, pl?.over)}</td>
                    <td>{l.under} {tick(l.under, pl?.under)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <div className="bk-hist">
        {w.hist.map((h) => (
          <div key={h.pts} className="bk-bar-col" title={`${h.pts} pts: ${h.pct}%`}>
            <span className="bk-bar-pct">{Math.round(h.pct)}%</span>
            <div className="bk-bar" style={{ height: `${(h.pct / maxPct) * 100}%` }} />
            <span className="bk-bar-label">{h.pts}</span>
          </div>
        ))}
      </div>
      <p className="bk-hist-caption">
        {w.player} points distribution across the simulated tournaments
      </p>
    </Panel>
  );
}

function Roster({ r }) {
  return (
    <div className="bk-roster">
      <h3 className="bk-roster-head">
        {r.player} — <Flags teams={r.teams.map((t) => t.name)} /> — avg {r.avg} pts
      </h3>
      <table className="bk-table">
        <thead>
          <tr><th>TEAM</th><th>GROUP</th><th>MAKE KO</th><th>QF</th><th>WIN CUP</th><th>EXP PTS</th><th>TITLE ODDS</th></tr>
        </thead>
        <tbody>
          {r.teams.map((t) => (
            <tr key={t.name}>
              <td className="bk-td-team">{TEAM_BY_NAME[t.name]?.flag} {t.name}</td>
              <td>{t.group}</td>
              <td>{t.makeKo}%</td>
              <td>{t.qf}%</td>
              <td>{t.winCup}%</td>
              <td>{t.expPts}</td>
              <td>{t.titleOdds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
