import { useState, useEffect } from "react";
import { TEAM_BY_NAME } from "./draw";
import { loadGroupsIndex } from "./scoring";

// `?book=<id>` → that group's sportsbook sheet. `?book` → list of books.
// Data is precomputed by scripts/sportsbook/build-books.mjs from 400k Monte
// Carlo tournaments calibrated to the pre-tournament market consensus; this
// view only renders the JSON.

const DATA = `${import.meta.env?.BASE_URL ?? "/"}data/`;
const loadBook = (id) => fetch(`${DATA}books/${id}.json`).then((r) => (r.ok ? r.json() : Promise.reject()));

export default function Sportsbook({ bookId }) {
  const [state, setState] = useState({ status: "loading", book: null, index: null });
  useEffect(() => {
    let live = true;
    if (bookId) {
      loadBook(bookId)
        .then((book) => live && setState({ status: "ok", book, index: null }))
        .catch(() => live && setState({ status: "error", book: null, index: null }));
    } else {
      loadGroupsIndex()
        .then((index) => live && setState({ status: "ok", book: null, index }))
        .catch(() => live && setState({ status: "error", book: null, index: null }));
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
        {state.status === "ok" && state.book && <Book book={state.book} />}
      </div>
    </div>
  );
}

function BookList({ index }) {
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

function Book({ book }) {
  const m = book.meta;
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
        <div className="bk-banner">LINES BUILT FROM {m.sources}</div>
      </header>

      {book.faction && <Faction f={book.faction} />}

      <Panel title="OUTRIGHT — TO WIN THE POOL" blurb={book.copy.outright}>
        <MarketRows rows={book.outright} tags />
      </Panel>

      <div className="bk-grid2">
        <Panel title="TO CASH — TOP 3 FINISH" blurb={book.copy.toCash}>
          <MarketRows rows={book.toCash} compact />
        </Panel>
        <Panel title="THE WOODEN SPOON — LAST PLACE" blurb={book.copy.spoon}>
          <MarketRows rows={book.spoon} compact />
        </Panel>
      </div>

      <Panel title="HEAD-TO-HEAD — TOP SHELF MATCHUPS" blurb={book.copy.h2h}>
        <div className="bk-h2h-grid">
          {book.h2h.map((x) => (
            <div key={`${x.a}-${x.b}`} className="bk-h2h">
              <div className="bk-h2h-side"><span>{x.a}</span><span className="bk-price">{x.priceA}</span></div>
              <div className="bk-h2h-vs">— VS —</div>
              <div className="bk-h2h-side"><span>{x.b}</span><span className="bk-price">{x.priceB}</span></div>
            </div>
          ))}
        </div>
      </Panel>

      {book.grudges && (
        <Panel title={book.grudges.title} blurb={book.grudges.blurb}>
          <div className="bk-h2h-grid">
            {book.grudges.pairs.map((x) => (
              <div key={`${x.a}-${x.b}`} className="bk-h2h">
                <div className="bk-h2h-side"><span>{x.a}</span><span className="bk-price">{x.priceA}</span></div>
                <div className="bk-h2h-vs">— {x.note} —</div>
                <div className="bk-h2h-side"><span>{x.b}</span><span className="bk-price">{x.priceB}</span></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {book.caleb && (
        <Panel title={book.caleb.title} blurb={book.caleb.blurb}>
          <div className="bk-rows">
            {book.caleb.bets.map((b) => (
              <div key={b.label} className="bk-row">
                <span className="bk-caleb-label">{b.label}</span>
                <span className="bk-price">{b.price}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Watch w={book.watch} blurb={book.copy.watch} />

      <Panel title="THE ROSTERS" blurb="Every seat's teams, with each team's chance of getting out of its group and expected pool points.">
        {book.rosters.map((r) => (
          <Roster key={r.player} r={r} />
        ))}
      </Panel>

      <footer className="bk-fine-block">
        <p className="bk-fine">
          <b>HOW THE SAUSAGE IS MADE.</b> Team strengths are calibrated so that simulated championship
          probabilities match the consensus of real sportsbooks ({m.sources.toLowerCase()}, June 2026, devigged).
          The full 2026 World Cup — real groups, real FIFA bracket, best-eight third-place advancement — was
          simulated {m.sims.toLocaleString()} times. Pool scoring per the official World Cup Lotto '26 rules:
          1 pt for making the Round of 32, 2 for the Round of 16, 3 for the quarters, 4 for the semis,
          5 for losing the final, 8 for the champion (each team counts once, at its furthest stage).
        </p>
        <p className="bk-fine">
          <b>HOUSE RULES.</b> All prices include the house's margin. Dead heats split stakes and payouts.
          All lines subject to movement; the book closed at kickoff of the opener, June 11.
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

function Panel({ title, blurb, children }) {
  return (
    <section className="bk-panel">
      <h2 className="bk-panel-title">{title}</h2>
      {blurb && <p className="bk-blurb">{blurb}</p>}
      {children}
    </section>
  );
}

function MarketRows({ rows, tags, compact }) {
  return (
    <div className="bk-rows">
      {rows.map((r, i) => (
        <div key={r.player} className="bk-row">
          <div className="bk-row-main">
            <span className="bk-player">
              {r.player}
              {tags && i === 0 && <span className="bk-tag fav">FAVORITE</span>}
              {tags && i === rows.length - 1 && <span className="bk-tag dog">LONGSHOT</span>}
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
          </div>
          <span className="bk-price">{r.price}</span>
        </div>
      ))}
    </div>
  );
}

function Faction({ f }) {
  const Side = ({ s }) => (
    <div className="bk-side">
      <h3 className="bk-side-name">{s.name}</h3>
      {s.players.map((p) => (
        <div key={p.name} className="bk-side-player">
          <span>{p.name}</span> <Flags teams={p.teams} />
        </div>
      ))}
      <div className="bk-side-lines">
        <div className="bk-line"><span>Moneyline</span><span className="bk-price">{s.moneyline}</span></div>
        <div className="bk-line"><span>Spread {s.spread.line}</span><span className="bk-price">{s.spread.price}</span></div>
        <div className="bk-line">
          <span>Team Total O/U {s.total.line}</span>
          <span className="bk-price sm">O {s.total.over} · U {s.total.under}</span>
        </div>
        <div className="bk-line dim"><span>Avg points</span><span>{s.avg}</span></div>
      </div>
    </div>
  );
  return (
    <Panel title={f.title} blurb={f.blurb}>
      <div className="bk-vs-grid">
        <Side s={f.a} />
        <div className="bk-vs">VS</div>
        <Side s={f.b} />
      </div>
    </Panel>
  );
}

function Watch({ w, blurb }) {
  const maxPct = Math.max(...w.hist.map((h) => h.pct));
  const main = w.ladder.find((l) => l.line === w.mainLine);
  return (
    <Panel title={w.title} blurb={blurb}>
      {main && (
        <div className="bk-mainline">
          <div className="bk-line"><span>Over {main.line} pts</span><span className="bk-price">{main.over}</span></div>
          <div className="bk-line"><span>Under {main.line} pts</span><span className="bk-price">{main.under}</span></div>
        </div>
      )}
      <h4 className="bk-subhead">ALT LINES LADDER</h4>
      <table className="bk-table ladder">
        <thead>
          <tr><th>LINE</th><th>OVER</th><th>UNDER</th></tr>
        </thead>
        <tbody>
          {w.ladder.map((l) => (
            <tr key={l.line} className={l.line === w.mainLine ? "main" : ""}>
              <td>{l.line}</td>
              <td>{l.over}</td>
              <td>{l.under}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
