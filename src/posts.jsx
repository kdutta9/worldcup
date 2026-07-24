import { TEAM_BY_NAME } from "./draw";
import boofyRecap from "./data/books/boofy-recap.json";
import soskRecap from "./data/books/sons-of-steve-kerr-recap.json";

// The house organ: hand-written editorial, one post per occasion. Numbers are
// copied from the committed book snapshots they cite (open and 2026-07-04) —
// history is immutable, so the copy carries its own facts rather than joining
// against data files at runtime. Settlement posts (settle-boofy, settle-sosk)
// deviate: they import computed recap JSON for graded tables and superlatives
// because a full settlement is too many numbers to hand-verify. Rendered by
// Post.jsx via ?post=<id>.

const Panel = ({ title, blurb, children }) => (
  <section className="bk-panel">
    <h2 className="bk-panel-title">{title}</h2>
    {blurb && <p className="bk-blurb">{blurb}</p>}
    {children}
  </section>
);

const P = ({ children }) => <p className="post-p">{children}</p>;

const flag = (t) => TEAM_BY_NAME[t]?.flag ?? "🏳️";

// [pts, seat, alive-teams[], gd?] — the GD column is opt-in via `gd`. Only Boofy
// still runs the goal-difference tiebreak; SOSK repealed it for a penalty
// shootout, so its final table drops the column.
const Standings = ({ rows, gd = false }) => (
  <table className="bk-table">
    <thead>
      <tr><th>PTS</th>{gd && <th>GD</th>}<th>SEAT</th><th>STILL ALIVE</th></tr>
    </thead>
    <tbody>
      {rows.map(([pts, name, alive, gdv]) => (
        <tr key={name}>
          <td>{pts}</td>
          {gd && <td>{gdv > 0 ? `+${gdv}` : gdv < 0 ? `−${-gdv}` : "0"}</td>}
          <td className="bk-td-team">{name}</td>
          <td>{alive.length ? alive.map((t) => `${flag(t)} ${t}`).join(" · ") : "—"}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

// [seat, open, today, note?]
const Lines = ({ rows }) => (
  <table className="bk-table">
    <thead>
      <tr><th>SEAT</th><th>OPEN</th><th>TODAY</th><th>THE WHY</th></tr>
    </thead>
    <tbody>
      {rows.map(([name, open, now, note]) => (
        <tr key={name}>
          <td className="bk-td-team">{name}</td>
          <td>{open}</td>
          <td>{now}</td>
          <td className="post-note">{note ?? ""}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

// [date, teamA, seatA, teamB, seatB, note?]
const Fixtures = ({ rows }) => (
  <div className="bk-rows">
    {rows.map(([date, a, sa, b, sb, note]) => (
      <div key={`${a}-${b}`} className="bk-row">
        <div className="bk-row-main">
          <span className="bk-player">
            {TEAM_BY_NAME[a] ? `${flag(a)} ` : ""}{a} <span className="post-vs">vs</span> {TEAM_BY_NAME[b] ? `${flag(b)} ` : ""}{b}
          </span>
          <span className="bk-teamline">
            {date} · {a}: {sa} · {b}: {sb}
            {note ? <span className="post-fixture-note"> — {note}</span> : null}
          </span>
        </div>
      </div>
    ))}
  </div>
);

// [label, price]
const Slips = ({ bets }) => (
  <div className="bk-rows">
    {bets.map(([label, price]) => (
      <div key={label} className="bk-row">
        <span className="bk-caleb-label">{label}</span>
        <span className="bk-price">{price}</span>
      </div>
    ))}
  </div>
);

// ── Settlement recap components ──────────────────────────────────────────────
const MARKET_LABEL = {
  outright: "OUTRIGHT", toCash: "TO CASH", spoon: "WOODEN SPOON",
  h2h: "HEAD-TO-HEAD", grudge: "GRUDGE MATCH", watch: "WATCH",
  faction: "FACTION", special: "SPECIALS",
};

const Chip = ({ result }) => (
  <span className={`recap-chip ${result.toLowerCase()}`}>{result}</span>
);

const fmtRet = (r) => r.result === "LOST" ? "—" : `$${r.ret.toFixed(2)}`;

const RecapRows = ({ rows }) => (
  <div className="bk-rows">
    {rows.map((r, i) => (
      <div key={i} className="recap-row">
        <span className={`recap-label${r.result === "LOST" ? " lost" : ""}`}>
          {r.label}
          {r.since && r.since !== "open" && <span className="recap-since"> — {r.since}</span>}
        </span>
        <span className="recap-right">
          <span className={`recap-price${r.result === "WON" ? " won" : ""}`}>{r.price}</span>
          <Chip result={r.result} />
          <span className={`recap-ret ${r.result.toLowerCase()}`}>{fmtRet(r)}</span>
        </span>
      </div>
    ))}
  </div>
);

const RecapStandings = ({ rows, gd = false }) => (
  <table className="bk-table recap-standings">
    <thead>
      <tr><th>#</th><th>SEAT</th><th>PTS</th>{gd && <th>GD</th>}<th style={{textAlign:"right"}}>PAYOUT</th></tr>
    </thead>
    <tbody>
      {rows.map((r) => (
        <tr key={r.player}>
          <td>{r.rank}</td>
          <td className="bk-td-team">{r.player}</td>
          <td>{r.points}</td>
          {gd && <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>}
          <td className={`recap-payout ${r.payout !== "—" ? "has" : "none"}`}>{r.payout}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const HouseNight = ({ house }) => (
  <div className="house-box">
    <div className="house-big">${house.hold.toFixed(2)}</div>
    <div className="house-sub">HOUSE HOLD — {house.holdPct}% OF ${house.taken} HANDLE</div>
    <div className="house-breakdown">
      {Object.entries(house.byMarket).map(([k, v]) => (
        <div key={k} className="house-cell">
          <div className="house-cell-label">{MARKET_LABEL[k] ?? k.toUpperCase()}</div>
          <div className={`house-cell-val${v.hold < 0 ? " neg" : ""}`}>
            {v.hold < 0 ? `−$${Math.abs(v.hold).toFixed(2)}` : `$${v.hold.toFixed(2)}`}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TicketCard = ({ title, children }) => (
  <div className="recap-callout">
    <div className="recap-callout-title">{title}</div>
    <div className="recap-callout-body">{children}</div>
  </div>
);

export const POSTS = [
  // ── Settlement posts ───────────────────────────────────────────────────────
  {
    id: "settle-boofy",
    bookId: "boofy",
    bookName: "BOOFY SPORTSBOOK",
    date: "2026-07-20",
    eyebrow: "THE HOUSE ORGAN — THE BOOK CLOSES",
    title: "THE RECKONING",
    deck: `Nathan drew Argentina and Messi walked him to the title. Dante started 11th and finished 2nd on the back of a single team — his own Spain — that won the entire tournament. Rob had England and France, the two best squads behind the finalists, and finished 3rd because goal difference is a cruel tiebreaker. The house hung ${boofyRecap.house.nTickets} tickets across 37 sheets and six weeks of daily lines. What follows is every one of them, graded at the price it was posted, with a $10 win ticket on each. The reckoning is the point.`,
    sourcing: (
      <p className="bk-fine">
        <b>SOURCING.</b> Every price is the debut line from the committed book sheets — the June 11 opening
        book through the July 19 morning line. Standing markets (outright, to-cash, spoon, H2H, watch) are
        graded at their opening price; specials at their first-posted price. All grades computed from the
        final <code>results.json</code> via <code>settle.mjs</code> — not hand-copied. For entertainment only;
        no real bets, no real money, no refunds.
      </p>
    ),
    body: (
      <>
        <Panel title="FINAL STANDINGS" blurb="Points bank at the furthest round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. Ties broken by aggregate goal difference.">
          <RecapStandings rows={boofyRecap.standings} gd />
          <P>
            Nathan's Argentina reached the final and led him to the top of the podium. Dante's Spain won the whole
            thing (and paid him his money back). Rob's England took third and his France took fourth — the two best consolation prizes in
            the tournament, and they bought him exactly one spot below the man whose only team lifted the
            trophy. The GD tiebreaker separated them: Dante +4, Rob −2.
          </P>
        </Panel>

        <Panel title="OUTRIGHT — TO WIN THE POOL" blurb="Graded at the June 11 opening price. One $10 ticket on each seat.">
          <RecapRows rows={boofyRecap.markets.outright} />
          <P>
            Nathan opened at +780 and closed at −2400. The widest price swing the book ever posted belonged to
            the man who won the pool, which is either a credit to the market's ability to learn or an
            indictment of the opening line's ability to read. The house declines to say which.
          </P>
        </Panel>

        <Panel title="TO CASH — TOP 3" blurb="Three podium spots, twelve seats. Graded at the June 11 opening price.">
          <RecapRows rows={boofyRecap.markets.toCash} />
        </Panel>

        <Panel title="WOODEN SPOON" blurb="Last place. Matt held Panama, Uzbekistan, Curaçao, and Haiti — the four lowest-rated teams in the draw. Graded at the June 11 opening price.">
          <RecapRows rows={boofyRecap.markets.spoon} />
          <P>
            Matt opened as the −105 spoon favorite and closed as the spoon. The market was right from the
            first morning. Zero points. The only man in the pool without a single team past the group stage.
            Panama, Uzbekistan, Curaçao, and Haiti went a combined 0–12 with a goal difference of −27. The
            number speaks for itself.
          </P>
        </Panel>

        <Panel title="HEAD-TO-HEAD" blurb={`${boofyRecap.markets.h2h.length / 2} pairs, each graded at their debut price. The book added pairs as the top of the table crystallized.`}>
          <RecapRows rows={boofyRecap.markets.h2h} />
        </Panel>

        {boofyRecap.markets.grudges.length > 0 && (
          <Panel title="GRUDGE MATCHES" blurb="The beefs that predate the pool. Graded at the opening price.">
            <RecapRows rows={boofyRecap.markets.grudges} />
            <P>
              Shaya needed to finish above both Jake and Matt to sweep the beef. He finished above Matt
              (11th vs 12th) but below Jake (11th vs 7th). The sweep failed; the individual grudge against
              Jake failed; the one against Matt cashed. One out of three on the beef menu.
            </P>
          </Panel>
        )}

        <Panel title="THE WATCH" blurb={`${boofyRecap.markets.watch.length} O/U rungs across the watch panel, graded at their debut price. The watch tracked the seat the book found most interesting — it moved from Kunal to Rob to Dante as the tournament evolved.`}>
          <RecapRows rows={boofyRecap.markets.watch} />
        </Panel>

        <Panel title="SPECIALS — CALEB'S CORNER" blurb={`${boofyRecap.markets.specials.length} specials posted across ${new Set(boofyRecap.markets.specials.map(s => s.since)).size} boards. Each graded at its debut price.`}>
          <RecapRows rows={boofyRecap.markets.specials} />
          <P>
            The specials told the tournament's story better than the standings did. Dante cashing from 11th
            was the book's recurring obsession — the Inferno arc ran from July 3 to July 15, each board
            hanging a new version of the same bet at shorter and shorter odds. Every single one of them
            cashed. Nathan's pool-winning specials cashed. The Rob-goes-nuclear overs never hit. Matt's
            +43000 moonshot did exactly what +43000 moonshots do (Caleb bet on it btw).
          </P>
        </Panel>

        <Panel title="THE HOUSE'S NIGHT" blurb="One $10 win ticket on every posted selection. The vig makes the house whole — in theory.">
          <HouseNight house={boofyRecap.house} />
          <P>
            The house took ${boofyRecap.house.taken.toLocaleString()}, paid ${boofyRecap.house.paid.toFixed(2)},
            and held ${boofyRecap.house.hold.toFixed(2)} — a {boofyRecap.house.holdPct}% hold. For a book
            designed to entertain rather than to print money, that's a clean night. The specials bled — Dante's
            Inferno alone almost broken even with what the house took on the entire specials board — but the standing
            markets and the H2H pairs held serve. The house always wins.
          </P>
        </Panel>

        <Panel title="SUPERLATIVES" blurb="The best, the worst, and the ones that actually cashed.">
          {boofyRecap.superlatives.ticketOfTournament && (
            <TicketCard title="TICKET OF THE TOURNAMENT">
              <b>{boofyRecap.superlatives.ticketOfTournament.label}</b>
              {" "}({MARKET_LABEL[boofyRecap.superlatives.ticketOfTournament.market]}) at{" "}
              <span className="recap-callout-price">{boofyRecap.superlatives.ticketOfTournament.price}</span>
              {" → "}
              <span className="recap-callout-price">${boofyRecap.superlatives.ticketOfTournament.ret.toFixed(2)}</span> on $10.
              {" "}Nathan at +780 on opening day. He opened as the 5th favorite in a twelve-man field
              and won the whole thing. The $10 ticket returned $88. Nobody saw it coming in June;
              everybody saw it coming by July.
            </TicketCard>
          )}
          {boofyRecap.superlatives.badBeat && (
            <TicketCard title="WORST BAD BEAT">
              <b>{boofyRecap.superlatives.badBeat.label}</b> at{" "}
              <span className="recap-callout-price">{boofyRecap.superlatives.badBeat.price}</span>.
              {" "}Rob and Dante finished on identical points. The GD tiebreaker separated 2nd from 3rd. 
              Rob had the favorite at −155. He lost by zero points.
            </TicketCard>
          )}
          {boofyRecap.superlatives.specialsThatCashed.length > 0 && (
            <TicketCard title={`SPECIALS THAT CASHED — ${boofyRecap.superlatives.specialsThatCashed.length} OF ${boofyRecap.markets.specials.length}`}>
              {boofyRecap.superlatives.specialsThatCashed.map((s, i) => (
                <div key={i} style={{marginTop: i ? 4 : 0}}>
                  {s.label} — <span className="recap-callout-price">{s.price} → ${s.ret.toFixed(2)}</span>
                </div>
              ))}
            </TicketCard>
          )}
        </Panel>
      </>
    ),
  },
  {
    id: "settle-sosk",
    bookId: "sons-of-steve-kerr",
    bookName: "SOSK SPORTSBOOK",
    date: "2026-07-20",
    eyebrow: "THE HOUSE ORGAN — THE BOOK CLOSES",
    title: "THE RECKONING",
    deck: `Burnes bought Spain in June at +190, opened as the favorite, and closed as the champion. He is the only man in either pool whose opening-day price was the shortest on the board and who also won. J Call had Argentina and finished second on his actual birthday. Arnst froze on the podium when France died and could neither rise nor fall — the most expensive statue in pool history. The house hung ${soskRecap.house.nTickets} tickets across 37 sheets, a faction war, a tiebreaker amendment, and the threat of a penalty shootout that never happened. Every line, graded.`,
    sourcing: (
      <p className="bk-fine">
        <b>SOURCING.</b> Every price is the debut line from the committed book sheets — the June 11 opening
        book through the July 19 morning line. Standing markets (outright, to-cash, spoon, H2H, faction, watch)
        are graded at their opening price; specials at their first-posted price. All grades computed from the
        final <code>results.json</code> via <code>settle.mjs</code> — not hand-copied. For entertainment only;
        no real bets, no real money, no refunds.
      </p>
    ),
    body: (
      <>
        <Panel title="FINAL STANDINGS" blurb="Points bank at the furthest round reached. The pool voted to replace goal-difference tiebreaking with a penalty shootout — which was never needed, because nobody tied.">
          <RecapStandings rows={soskRecap.standings} />
          <P>
            Burnes won by a point. Spain's championship was worth 8 points on its own — more than half the pool
            scored across all six of their teams. Call's Argentina reached the final and gave him second place with 11. 
            Arnst's France dying in the semifinals froze him at 10, which was enough for third and
            too many for fourth and exactly right for a man who spent the last week unable to affect a
            single number on the board. Prozan finished last with 4 points.
          </P>
        </Panel>

        <Panel title="OUTRIGHT — TO WIN THE POOL" blurb="Graded at the June 11 opening price. One $10 ticket on each seat.">
          <RecapRows rows={soskRecap.markets.outright} />
          <P>
            Burnes was the +190 opening favorite and the −175 closing favorite. The book had him right from
            the first sheet. J Call opened at +460 and closed at +125 — the best mover on the board. Arnst
            opened at +220 and ended as a monument. The market priced this pool correctly from day one;
            the top three on the opening sheet are the top three on the final one.
          </P>
        </Panel>

        <Panel title="TO CASH — TOP 3" blurb="Three podium spots, eight seats. Graded at the June 11 opening price.">
          <RecapRows rows={soskRecap.markets.toCash} />
        </Panel>

        <Panel title="WOODEN SPOON" blurb="Last place. Prozan held Iran, Scotland, USA, Panama, New Zealand, and Brazil. Graded at the June 11 opening price.">
          <RecapRows rows={soskRecap.markets.spoon} />
          <P>
            Prozan opened with +470 odds to carry the spoon and finished last with 4 points. The parlay window
            never paid out. The Prozan special — USA and Brazil both reaching the quarters — died when
            both teams lost in the Round of 16. He would like you to know this was all part of the plan.
          </P>
        </Panel>

        <Panel title="HEAD-TO-HEAD" blurb={`${soskRecap.markets.h2h.length / 2} pairs, each graded at their debut price.`}>
          <RecapRows rows={soskRecap.markets.h2h} />
        </Panel>

        {soskRecap.markets.faction.length > 0 && (
          <Panel title="THE DKE CIVIL WAR — FACTION" blurb="OLD DKE (HG, Prozan, Arnst, Oanta) vs NEW DKE (Burnes, J Call, Kunal, Chris). Moneyline, spread, and totals — graded at the opening price.">
            <RecapRows rows={soskRecap.markets.faction} />
            <P>
              NEW DKE won {soskRecap.markets.faction.find(f => f.type === "ml")?.actualB}–{soskRecap.markets.faction.find(f => f.type === "ml")?.actualA}.
              {" "}It wasn't close. Burnes and J Call alone scored 23 of their side's 38 points. OLD DKE's best
              performer was Arnst at 10. The spread was −1.5 NEW DKE; the actual margin was 11. 
              The faction war ended the way faction wars usually end: the side with the better teams won, and the side with the better story lost.
            </P>
          </Panel>
        )}

        <Panel title="THE WATCH" blurb={`${soskRecap.markets.watch.length} O/U rungs across the watch panel, graded at their debut price.`}>
          <RecapRows rows={soskRecap.markets.watch} />
        </Panel>

        <Panel title="SPECIALS" blurb={`${soskRecap.markets.specials.length} specials posted across ${new Set(soskRecap.markets.specials.map(s => s.since)).size} boards. Each graded at its debut price.`}>
          <RecapRows rows={soskRecap.markets.specials} />
          <P>
            The leapfrog was the book's defining narrative. Burnes running down Chris appeared on five
            consecutive boards — the same structural bet repriced as the bracket moved — and cashed all five times. 
            Spain winning the tournament didn't just hand Burnes the pool; it retroactively validated every leapfrog slip the house ever hung.
          </P>
        </Panel>

        <Panel title="THE HOUSE'S NIGHT" blurb="One $10 win ticket on every posted selection.">
          <HouseNight house={soskRecap.house} />
          <P>
            The house took ${soskRecap.house.taken.toLocaleString()}, paid ${soskRecap.house.paid.toFixed(2)},
            and held ${soskRecap.house.hold.toFixed(2)} — a {soskRecap.house.holdPct}% hold. A third of the
            handle stayed in the drawer. The faction market helped: OLD DKE lost every line (except the under),
            and the house pocketed the moneyline and spread without breaking a sweat. The specials bled less
            than Boofy's did — the leapfrog cashed repeatedly, but nobody else's narrative survived.
          </P>
        </Panel>

        <Panel title="SUPERLATIVES" blurb="The best, the worst, and the ones that actually cashed.">
          {soskRecap.superlatives.ticketOfTournament && (
            <TicketCard title="TICKET OF THE TOURNAMENT">
              <b>{soskRecap.superlatives.ticketOfTournament.label}</b>
              {" "}({MARKET_LABEL[soskRecap.superlatives.ticketOfTournament.market]}) at{" "}
              <span className="recap-callout-price">{soskRecap.superlatives.ticketOfTournament.price}</span>
              {" → "}
              <span className="recap-callout-price">${soskRecap.superlatives.ticketOfTournament.ret.toFixed(2)}</span> on $10.
              {" "}The longest-odds winner in the SOSK book is the wooden spoon. Prozan finished last at +470
              and the $10 ticket returned $57. The cruelest symmetry the book produced: the man who asked for
              a sportsbook is the man whose most profitable ticket was proof that he lost.
            </TicketCard>
          )}
          {soskRecap.superlatives.badBeat && (
            <TicketCard title="WORST BAD BEAT">
              <b>{soskRecap.superlatives.badBeat.label}</b> at{" "}
              <span className="recap-callout-price">{soskRecap.superlatives.badBeat.price}</span>.
              {" "}HG scored exactly 6 points. The under was 5.5. He missed by half a point — the smallest
              margin the board's half-point lines allow. One fewer team past the group stage and the under
              cashes. The house sends its regards.
            </TicketCard>
          )}
          {soskRecap.superlatives.specialsThatCashed.length > 0 && (
            <TicketCard title={`SPECIALS THAT CASHED — ${soskRecap.superlatives.specialsThatCashed.length} OF ${soskRecap.markets.specials.length}`}>
              {soskRecap.superlatives.specialsThatCashed.map((s, i) => (
                <div key={i} style={{marginTop: i ? 4 : 0}}>
                  {s.label} — <span className="recap-callout-price">{s.price} → ${s.ret.toFixed(2)}</span>
                </div>
              ))}
            </TicketCard>
          )}
        </Panel>
      </>
    ),
  },
  // ── Pre-settlement posts ─────────────────────────────────────────────────
  {
    id: "final-sosk",
    bookId: "sons-of-steve-kerr",
    bookName: "SOSK SPORTSBOOK",
    date: "2026-07-15",
    linesLabel: "July 16",
    eyebrow: "THE HOUSE ORGAN — THE FINAL",
    title: "MANY HAPPY RETURNS",
    deck: "Argentina beat England 2–1 in Atlanta on two Messi assists in the last five minutes, and what's left of this pool is the cleanest thing a sportsbook ever gets to post: two live seats, two finalists, one match. Burnes bought Spain in June and is −175. J Call has Argentina and is +125. Whichever team lifts the Cup on Sunday, that man takes the $150 — there is no third road. The final is July 19. July 19 is Jacob Call's birthday. And underneath it all, the pool did the one thing a pool should never be allowed to do: it changed its own tiebreaker four days before the final. Goal difference is gone, handed back to the players by vote. If Argentina win, Burnes drops level with Chris on 9 points and the last $30 is settled the way the sport settles everything that matters — a five-kick shootout, each man keeping his own goal. Chris played high school soccer. Burnes was a DKE legend at goalkeeper. The house has a line on it.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            Tuchel decided to play six at the back against the best player who has ever lived, which is a bit like
            boarding up the windows and leaving the front door open. For sixty minutes it looked like tactics. Then
            Messi simply stopped being marked by anyone in particular and started roaming the space England had
            politely built for him, and in the 85th minute he put Argentina level, and in the 90+2 he put them in the
            final. Two assists, five minutes, one bus dismantled. He is still going strong at this tournament with 
            eight goals, four assists, and an undisputed GOAT claim.
          </P>
          <P>
            So the field is two men. Burnes drew Spain in June and has been quietly correct ever since: Spain have
            conceded <em>one goal</em> in seven matches — Belgium got it in the quarterfinal, and Belgium may be the
            best attacking side of the decade — and they beat the tournament favorite 2–0 in the semifinal without
            ever appearing to try. They are boring in the way a hydraulic press is boring. J Call has Argentina, who
            have conceded seven and scored nineteen and have Messi. The two of them are the only seats on this board
            with a pulse, and the beautiful part is that they are not racing each other through some tangle of
            scenarios. Spain win, Burnes wins. Argentina win, J Call wins. That's the whole document.
          </P>
          <P>
            Which leaves the cruelty for the people who can't do anything. Arnst is frozen on ten and locked onto the
            podium — France dying barred him from first forever, so his entire remaining interest is the size of his
            own check, and it is decided by Burnes's team. Chris has been a statue on nine since Belgium went home.
            And here the amended rule does something genuinely vicious: if Argentina win, Burnes falls to nine, level
            with Chris, and the pool no longer looks at a single number to separate them — it puts a ball on the spot.
            Five kicks each, every man his own goalkeeper, thirty dollars on the outcome. Chris, who has not owned a
            live team since Belgium died on July 10, gets to win it back the only way left to him: from twelve yards,
            against a man who used to play in goal.
          </P>
        </Panel>

        <Panel
          title="THE TABLE — 62 BANKED, 3 IN PLAY"
          blurb="Points bank at the furthest round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. Both finalists are scored as a provisional 5 until Sunday settles it, so only 3 points remain on the board all week — the gap between runner-up and champion. New this week: the pool tore up last week's goal-difference rule and voted to break a level finish from the penalty spot instead. So read the top of the table plainly — Burnes and Chris are the same number, and nothing but a shootout can tell them apart."
        >
          <Standings
            rows={[
              [11, "J Call", ["Argentina"]],
              [10, "Arnst", []],
              [9, "Burnes", ["Spain"]],
              [9, "Chris", []],
              [7, "Oanta", []],
              [6, "HG", []],
              [6, "Kunal", []],
              [4, "Prozan", []],
            ]}
          />
          <P>
            Two teams remain in this tournament, and for one glorious week the pool had a rule that turned the final's
            margin into a second currency — every goal Spain conceded or scored moved thirty dollars. Then the pool
            looked at what it had built, decided goal difference was too much like homework, and repealed it. A level
            finish now goes to penalties. Ninety minutes on Sunday decides the $150. If it also produces a nine-nine
            tie beneath it, the last $30 is decided by two men and a goalkeeper each, which happens to be the same man.
          </P>
        </Panel>

        <Panel
          title="OUTRIGHT — TO WIN THE POOL"
          blurb="The June 11 opening sheet against the July 16 morning line. Six obituaries and a two-horse race."
        >
          <Lines
            rows={[
              ["Burnes", "+190", "−175", "Opened the favorite of this entire pool and is closing as the favorite of this entire pool, which almost never happens and which he will absolutely never stop mentioning. He bought the most boring team in the world in June and it has conceded one goal since. Spain lift the Cup, he takes $150"],
              ["J Call", "+460", "+125", "The birthday boy. Argentina is his last live hand, it is in the final, and the final is on his actual birthday. Beat Spain and he has 14 points and the pool; lose and he's 11 and second. There is no number between those two"],
              ["Arnst", "+220", "OFF", "Was a −160 co-favorite as recently as Saturday and is now a monument. France's death froze him on ten: a champion always clears ten, so he is barred from first place and locked onto the podium. He cannot win, cannot miss the money, and cannot participate"],
              ["Chris", "+960", "OFF", "Dead for first since Belgium lost, but not dead — see below. He is the entire reason there is a shootout to price"],
              ["The other four", "—", "OFF", "Oanta hosted the best Saturday of the tournament and finishes fifth. HG, Kunal and Prozan are where they have been for a while"],
            ]}
          />
        </Panel>

        <Panel
          title="TO CASH — THE SHOOTOUT"
          blurb="Three podium spots. J Call and Arnst have clinched two of them. The third is no longer an argument about goals — it is a penalty shootout between a man with a team and a man without one, priced July 16."
        >
          <Slips
            bets={[
              ["J Call — CLINCHED top 3; he's playing purely for the $150 now", "LOCKED"],
              ["Arnst — CLINCHED top 3, barred from 1st; only the size of the check is live", "LOCKED"],
              ["Burnes cashes — Spain lift the Cup, or he wins the shootout", "−560"],
              ["Chris takes the last $30 — Argentina win, then he beats Burnes from the spot", "+340"],
              ["To the spot — Argentina win and the $30 goes to penalties at all", "+120"],
            ]}
          />
          <P>
            This is the best sequence on the board and it needs explaining. Burnes and Chris are both on nine points,
            and goal difference — the thing that separated them for exactly one week — no longer exists. So the two
            outcomes are clean. If Spain <em>win</em>, Burnes goes to twelve and cashes and none of this matters. If
            Spain <em>lose</em>, in ninety minutes or on penalties or any way at all, Burnes falls to nine, dead level
            with a man whose every team has been eliminated since July 10, and the pool does not consult a spreadsheet.
            It puts the two of them on the spot.
          </P>
          <P>
            Which is its own market, and the house is delighted to book it. Five kicks each, every man his own
            goalkeeper. Chris played high school soccer — a real credential, a taker's credential, and the taker
            always fancies himself. Burnes played goalkeeper for the DKE intramural side that won the Berkeley title —
            a championship, in goal, and a shootout is a goalkeeper's document. We make Burnes the man to beat.
          </P>
          <Slips
            bets={[
              ["Burnes wins the shootout — the Berkeley IM title-winning keeper", "−145"],
              ["Chris wins the shootout — high school soccer and a puncher's chance", "+105"],
            ]}
          />
          <P>
            So the entire remaining Burnes portfolio is one line: win the tournament, or win the kicks. There is no
            longer a version where he prays for a specific scoreline, and no longer a version where anyone splits
            anything — the thirty dollars goes to exactly one man, and Sunday, one way or another, tells us which.
          </P>
        </Panel>

        <Panel
          title="SUNDAY — AND THE GAME NOBODY ORDERED"
          blurb="One match decides the pool. The other one decides nothing, which is its whole charm."
        >
          <Fixtures
            rows={[
              ["Sun, Jul 19 · The Final", "Spain", "Burnes", "Argentina", "J Call", "The pool, in ninety minutes. Whoever's team lifts it takes $150 and the loser takes second. And if it's Argentina who lift it, the whistle doesn't end the day — it drops Burnes level with Chris on nine and sends the last $30 to a shootout of their own"],
              ["Sat, Jul 18 · Third Place", "France", "Arnst", "England", "Oanta", "The meme game, and for once genuinely a meme: Arnst is frozen at ten regardless and Oanta is fifth regardless. Not a dollar in this pool moves on it — and now that goal difference is buried, not even the scoreline pretends to matter. Play it in a car park"],
            ]}
          />
          <P>
            Four days of nothing, then everything. The book will reprice each morning until kickoff — the market moves,
            the sheet moves with it, and the story does not move at all, because the story is that two men own the two
            teams left and one of them is having a birthday.
          </P>
        </Panel>

        <Panel
          title="THE BIRTHDAY INVITATIONAL — JULY 19"
          blurb="Prozan's window has been shuttered since USA and Brazil went home. Hawaii West got its Saturday. The Oanta Invitational got its semifinal. The marquee now belongs to the man whose birthday is the World Cup final, priced July 16. Cash up front; the jukebox still doesn't take IOUs."
        >
          <Slips
            bets={[
              ["Burnes wins the pool — he bought Spain in June and Spain lifting the Cup is the entire $150", "−175"],
              ["The birthday boy takes it all — Argentina win on July 19", "+125"],
              ["Arnst's check is Burnes's problem — second if Spain lose, third if Spain win, and he cannot lift a finger either way", "+125"],
              ["To the spot — Argentina win, Burnes and Chris finish level on nine, and the last $30 goes to a shootout", "+120"],
              ["Burnes wins the shootout — the Berkeley IM title-winning keeper against a high-schooler", "−145"],
            ]}
          />
          <P>
            Consider Arnst's +125 for a moment. He has no live team, he cannot win the pool, he cannot miss the
            podium, and the only open question on his ticket — sixty dollars or thirty — is answered entirely by
            whether another man's Spain wins a football match he has no stake in. He is a spectator at his own
            payout. The house finds this funnier than it should and has posted the line accordingly.
          </P>
          <P>
            It gets better, because Arnst did his homework. A full hour of research, before a ball was kicked, and
            the hour terminated in the purchase of an Ivory Coast jersey. Arnst does not own Ivory Coast. Arnst has
            never owned Ivory Coast. Ivory Coast belongs to <em>Chris</em>, went out in the Round of 32 on June 30,
            and is worth exactly one point.
          </P>
          <P>
            And that one point is load-bearing, which is the part that should ruin somebody's week. Chris is on nine
            only because Ivory Coast is one of his; strip it out and he's on eight, never draws level with Burnes, and
            the shootout never happens — Burnes keeps the last $30 without kicking a ball. That single point is the
            whole of Chris's remaining hope. Now the beautiful part. Arnst did not buy the jersey for the point. He
            bought it, after a full hour of research, to work the <em>goal-difference</em> tiebreak — Ivory Coast's
            +1, he had decided, was the kind of edge a serious man finds. Four days later the pool voted goal
            difference out of existence and replaced it with penalties. The mechanism he researched is gone; the shirt
            remains; and its one surviving effect is to keep alive the man sitting directly beneath him on the podium,
            in a race Arnst is barred from winning and incapable of losing. The team he actually needed was France.
            France is dead.
          </P>
          <P>
            Many happy returns, Jacob. The house means that in the technical sense.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "final-boofy",
    bookId: "boofy",
    bookName: "BOOFY SPORTSBOOK",
    date: "2026-07-15",
    linesLabel: "July 16",
    eyebrow: "THE HOUSE ORGAN — THE FINAL",
    title: "THE WAKE AT NICK'S PLACE",
    deck: "Argentina beat England 2–1 and Nathan won the pool — not \"is winning,\" won. Nine points with three left on the board and nobody above eight: the $200 is engraved. So on Sunday, at the home of a man whose last team died in the quarterfinal, eleven eliminated seats will gather to watch a World Cup final that decides $40, $20, and nothing else. The pool's new goal-difference tiebreak settled most of even that in advance — Dante beats Rob by six goals if they tie on eight, Dino beats Max by seven on seven — which means Max, a dirty Brit whose Norway was knocked out by England, now cashes in exactly zero outcomes. Caleb will be in attendance. Caleb has never been in this pool.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            It ended on Wednesday. Rob's England took Messi's Argentina to the 85th minute with a six-man back line and a
            plan, and then the plan met the player, and two assists later Rob's summer was over and Nathan had
            mathematically won the Boofy pool. Nine points, three points left in the entire tournament, and the
            highest anyone else can reach is eight. There is no scenario, no shootout, no tiebreak. Nathan drew
            Argentina in a lottery and Argentina got Lionel Messi. Congratulations are boring but they're owed.
          </P>
          <P>
            Which is how we arrive at Sunday's arrangement: the final will be watched at Nick's place. 
            Caleb will be in attendance, in person, for the first time all year. 
            Caleb is not in the pool. Caleb has never been in the pool. Caleb has not paid
            for a drink since the group stage and will arrive with opinions about a goal-difference rule he had no
            vote on.
          </P>
          <P>
            And it is time somebody said why. This pool needed a twelfth man. The group asked Caleb, on the entirely
            sound reasoning that Caleb is a degenerate gambler — it is the whole reason his name is on these lines in
            the first place. Caleb passed. Didn't fancy it. The seat went to Nathan, who is to this day the twelfth
            name in the roster file, and on Sunday Nathan will collect two hundred dollars in Caleb's eyeline. The
            face of this sportsbook was offered the only bet that ever mattered and turned it down, then spent five
            weeks posting slips about everyone who didn't. He'll be in the kitchen. Bring it up early and often.
          </P>
          <P>
            And that rule is the story of what's left. The pool decided ties break on cumulative goal difference —
            every team you own, every match — and it walked in and immediately shot two people. Rob, on eight,
            can be caught by Dante's Spain on eight; Dante's goal difference is +4 and Rob's is −2, so the tie
            isn't a tie, it's a loss. Dino and Max are both frozen on seven; Dino is +12 and Max is +5, so the
            marriage everyone joked about for two rounds is annulled. Max does not split the last chair with Dino.
            Max does not get a chair. Max, whose Norway was knocked out of this tournament by England — his own
            country — now cashes in zero of the two possible futures, and there is nothing he can do about any of
            it because every team he owns has been dead for four days.
          </P>
        </Panel>

        <Panel
          title="THE TABLE — 62 BANKED, 3 IN PLAY"
          blurb="Points bank at the furthest round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. Both finalists are scored as a provisional 5 until Sunday, so the only 3 points left all week are the gap between runner-up and champion — and they belong to Nathan or Dante. New this round: ties settle on cumulative goal difference, every team a seat owns, every match of the tournament. The column below is now worth more than most of the points beside it."
        >
          <Standings
            gd
            rows={[
              [9, "Nathan", ["Argentina"], 10],
              [8, "Rob", [], -2],
              [7, "Dino", [], 12],
              [7, "Max", [], 5],
              [6, "Nick", [], 6],
              [5, "Dante", ["Spain"], 3],
              [5, "Jake", [], -3],
              [4, "Kunal", [], 17],
              [4, "Jack", [], 0],
              [4, "Adrian", [], -12],
              [3, "Shaya", [], -9],
              [0, "Matt", [], -27],
            ]}
          />
          <P>
            Read the GD column and enjoy the injustice. Kunal is +17 — the best goal difference in the entire pool by
            five clear goals, Germany and Brazil and the Netherlands all thumping people on their way out — and it is
            worth precisely nothing, because he's on four points in a three-place pool. Rob is −2, the worst number
            among the top six, because he owned Tunisia and Iraq and they were catastrophic in June. In a pool where
            ties now break on goal difference, the man who ran England and France to a −1350 favorite carries the
            weakest tiebreaker at the top of the table.
          </P>
        </Panel>

        <Panel
          title="OUTRIGHT — TO WIN THE POOL"
          blurb="The June 11 opening sheet against the July 16 morning line. One winner, eleven obituaries, and a note about a number that fooled everybody."
        >
          <Lines
            rows={[
              ["Nathan", "+780", "WON ✓", "Opened eighth-shortest in a twelve-man pool and won it outright. Argentina, South Africa, Croatia, Egypt — one of those four turned out to have the greatest player in history on it, and that was that. Nine points, nobody within reach, engraving done"],
              ["Rob", "+220", "OFF", "Opened the favorite, spent a month as the favorite, peaked at −1350, and finishes with nothing but a runner-up fight. He owned England AND France and both died in the semifinal round. About that −1350, see below"],
              ["Dante", "+410", "OFF", "Spain reached the final and it moved him from 11th to... 6th. His ceiling is eight, Nathan has nine, so he has been mathematically barred from winning this pool since Wednesday noon. His whole summer is now the $40 line below"],
              ["Dino", "+530", "OFF", "The Cinderella died July 9 and he hasn't moved a point since. And yet: +12 goal difference, frozen, waiting — the corpse with the best tiebreaker in the neighborhood"],
              ["The other eight", "—", "OFF", "Nick is hosting. Max is furious. The rest have been gone so long they've stopped checking"],
            ]}
          />
          <P>
            The −1350 deserves a word, because the chat has been misreading it for a week. Rob was never a 93% shot to
            win this pool. That price was the <em>house</em> number: the outright board charges a 35% margin across a
            full field, and the fair probability underneath −1350 was 69% (nice). The market didn't overrate France. The book
            took its vig, exactly as posted, and 69% (nice) is a number that loses roughly one time in three. It lost.
          </P>
          <P>
            Which exposes a second thing, and the house would rather say it out loud than get caught. A 35% margin is
            what a futures board charges across twelve runners. It is not what anybody charges on a coin flip. With
            this field down to two, that constant was quietly printing <em>both</em> finalists at negative odds — a
            135% book on a two-horse race, which isn't a market, it's a mugging. So from this sheet the vig scales
            with the live field: two runners left, two-way pricing, about 108%. It's why Dante is −175 to take second
            here and Burnes is −175 to win the entire SOSK pool. Those are the same coin — Spain lifting the Cup — and
            they should always have printed the same number.
          </P>
        </Panel>

        <Panel
          title="TO CASH — $40 AND $20, AND THAT'S THE LOT"
          blurb="Three podium spots. Nathan and Rob have clinched two of them. Everything still live is priced July 16 — and the tiebreak has already decided who's allowed to be in the conversation."
        >
          <Slips
            bets={[
              ["Nathan (not Caleb) — CLINCHED the pool. The $200 is engraved", "LOCKED"],
              ["Rob — CLINCHED top 3 the moment England lost; only 2nd vs 3rd is live", "LOCKED"],
              ["Dante takes second — Spain must lift the actual Cup, then he beats Rob on goal difference, +4 to −2", "−175"],
              ["Dino backs into third — Spain lose, and he beats Max to the chair by seven goals", "+125"],
              ["Max cashes anything at all", "OFF THE BOARD"],
            ]}
          />
          <P>
            Max's line is not a joke and it is not a slight — it is arithmetic, and it is the first real casualty of
            the new rule. Under the old dead-heat regime, Max and Dino were married: both frozen on seven, both
            splitting the last chair if Spain lost, +110 apiece going into the semifinals and +270 apiece yesterday. The pool
            changed the tiebreak and the marriage ended instantly. Seven points and +12 beats seven points and +5. So
            in the Spain-lose branch, Dino takes the $20 alone; in the Spain-win branch, Dante takes second and Rob
            takes third and Dino and Max both get nothing. There is no third branch. Max has been eliminated from the
            money by a rule, having already been eliminated from the tournament by England.
          </P>
        </Panel>

        <Panel
          title="SUNDAY — ONE REAL GAME, ONE PERFECT JOKE"
          blurb="A final that settles $60 total, and a third-place game that settles a rounding error."
        >
          <Fixtures
            rows={[
              ["Sun, Jul 19 · The Final", "Spain", "Dante", "Argentina", "Nathan", "Nathan's already won, so this is Dante's game and nobody else's. Spain lift it, he's on eight and beats Rob on goal difference for $40. Spain lose, he's on five, finishes sixth, and Dino takes the last chair"],
              ["Sat, Jul 18 · Third Place", "France", "Rob", "England", "Rob", "The perfect joke: Rob owns both of them. Whatever happens, one of his teams' goal difference goes up by exactly what the other's goes down. The meme game is, for the only man it could possibly affect, a literal wash"],
            ]}
          />
          <P>
            That third-place row is worth sitting with. In a pool that just made goal difference the thing that decides
            money, the one seat whose goal difference is at the top of the table and under threat — Rob, on −2, being
            hunted by Dante — owns <em>both teams in the only other match left</em>. France beats England 4–0 and Rob
            gains nothing. England beats France 4–0 and Rob loses nothing. He is hedged against himself, perfectly,
            by accident, in June, by a random number generator.
          </P>
          <P>
            Which leaves Saturday with exactly one thing still riding on it, and it isn't money: Jude Bellingham is, by
            unanimous panel vote, hot. That is the only market in this pool goal difference cannot touch, it is the
            only one the third-place game still settles, and Rob — who owns England — is long that too. Perfectly
            hedged on the scoreline and holding the sole asset in the fixture that appreciates. The house will not be
            posting a price. The house knows when it is beaten.
          </P>
        </Panel>

        <Panel
          title="CALEB'S CORNER — LIVE FROM NICK'S"
          blurb="Caleb is not in the pool. That has never once stopped him, and on Sunday it will not even slow him down, because he'll be standing in the host's kitchen. The July 16 card. Cash up front — he knows the drill."
        >
          <Slips
            bets={[
              ["Dante steals second — Spain lift the Cup, he ties Rob on 8, and takes it on goal difference, +4 to −2", "−175"],
              ["Rob salvages the $40 — Spain lose, Dante stalls on 5, and runner-up is the last thing England and France ever bought him", "+125"],
              ["Dino backs into the last chair — dead since the quarterfinal, beats Max by seven goals neither can touch", "+125"],
              ["Nathan wins the pool — the house is not taking this action and posts the number purely so it can be admired", "−2400"],
            ]}
          />
          <P>
            So: a dead man hosts, a man who isn't in the pool attends, the champion is decided, the runner-up is a
            referendum on Spain, the third seat belongs to a corpse with a good goal difference, and a dirty Brit sits
            in the corner having been knocked out by his own country and then knocked out of the money by a rule
            change. Somewhere in there is a football match. Kickoff is Sunday. Bring cash.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "sf2-boofy",
    bookId: "boofy",
    bookName: "BOOFY SPORTSBOOK",
    date: "2026-07-14",
    linesLabel: "July 15",
    eyebrow: "THE HOUSE ORGAN — SEMIFINAL SPECIAL, PART 2",
    title: "ONE GAME FOR THE POOL",
    deck: "Spain beat France 2–0 and the Rob-vs-Rob final everyone dreaded died on the spot. But look what it left behind: Rob still owns England, Nathan owns Argentina, and their two teams play each other at noon for a spot in the final — winner's owner banks a finalist, clears the frozen field, and takes the whole pool. Rob −250, Nathan −175, a coin flip for $200. Dante's Spain is in the final and he still can't win; his entire summer is the last chair on the podium, and it only comes if Spain lifts the actual Cup. Dino and Max, still married, still praying it doesn't.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            The final boss lost a life. France — Rob's crown jewel, the tournament favorite, the team that hadn't looked
            mortal in a month — walked into Spain's semifinal and lost 2–0. Spain has now scored two goals in a knockout
            round exactly once all tournament and it keeps being enough. France is out, and the England–France final that
            would have handed one man both the trophy and the runner-up is dead, buried, never to be spoken of again.
          </P>
          <P>
            And yet Rob has never been closer. He still owns England, and the bracket has arranged the kindest possible
            thing: England plays Nathan's Argentina in the second semifinal, and that one game <em>is</em> the
            pool. Whoever wins banks a finalist — five points, minimum — and instantly clears every frozen seat behind
            them. The winner's owner is the champion-elect; the loser's owner is runner-up in the pool. There is no third
            path. The house has Rob −250 and Nathan −175, which is a long way of saying: it's a coin flip for two hundred
            dollars.
          </P>
          <P>
            Underneath, the last cash seat is the same knife fight it's been for a week, only crueler. Dante's Spain
            reached the final and it did him almost no good: his ceiling is eight points, a three-way tie at best, so he
            cannot win the pool. His whole season is now the third podium chair — and he takes it only if Spain wins the
            entire tournament. If Spain loses the final, Dino and Max, both frozen on seven, split that chair between
            them. Same marriage as last round. Same coin. Higher stakes.
          </P>
        </Panel>

        <Panel
          title="THE TABLE — 61 BANKED, 4 STILL IN PLAY"
          blurb="Points bank at each round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. New this round: a semifinal winner is scored as a Finalist — a provisional 5 — until the final settles runner-up vs. champion, which is why Spain already shows five. Of the last 4 points, 1 goes to the July 15 winner for reaching the final and 3 go to whoever lifts the Cup."
        >
          <Standings
            rows={[
              [8, "Rob", ["England"]],
              [8, "Nathan", ["Argentina"]],
              [7, "Dino", []],
              [7, "Max", []],
              [6, "Nick", []],
              [5, "Dante", ["Spain"]],
              [5, "Jake", []],
              [4, "Jack", []],
              [4, "Adrian", []],
              [4, "Kunal", []],
              [3, "Shaya", []],
              [0, "Matt", []],
            ]}
          />
        </Panel>

        <Panel
          title="OUTRIGHT — TO WIN THE POOL"
          blurb="Outright (to win the pool), June 11 opening sheet against the July 15 morning line. Two live seats splitting one coin, ten obituaries."
        >
          <Lines
            rows={[
              ["Rob", "+220", "−250", "Opened the favorite and never left. France dying cost him the greedy all-Rob final but handed him a cleaner one: his England beats Argentina and it's simply over. He is also, quietly, favored — the market likes England in the semifinal"],
              ["Nathan", "+780", "−175", "Argentina is his only live hand and it's a good one. Beat Rob's England, with the Messi whistles the chat has fully convinced itself are coming, and the $200 is his. Lose and he's runner-up in the pool at eight"],
              ["Dante", "+410", "OFF", "Spain reached the final and Dante still cannot win — his ceiling is a tie at eight. The trophy Spain is chasing pays him nothing up here; his whole play moved to the cash market below"],
              ["The other nine", "—", "OFF", "Extinct. Nick, Dino, Max and the rest are frozen where they fell; the only question any of them has left is whether the podium's last chair comes to them"],
            ]}
          />
        </Panel>

        <Panel
          title="TO CASH — THE LAST SEAT ON THE PODIUM"
          blurb="Three podium spots, twelve seats. Rob and Nathan clinched two of them the moment France went home. The third is a referendum on the final, priced July 15 — and it's Dante against the two frozen men, winner-take-chair."
        >
          <Slips
            bets={[
              ["Rob — CLINCHED top 3, now playing only for the $200 and the bragging rights", "LOCKED"],
              ["Nathan — CLINCHED top 3; Argentina is purely about first place now", "LOCKED"],
              ["Dante takes the last chair — his Spain must lift the actual Cup; a runner-up leaves him a point short", "−250"],
              ["Dino and Max back into third — the two frozen sevens split the last seat if Spain LOSES the final", "+270"],
            ]}
          />
          <P>
            The board has finally made Dante the favorite for something — and it's the exact thing his whole summer now
            depends on. Spain is a heavy chalk to win the tournament, so Dante is −250 to grab the last chair, and the
            moment he does, Dino and Max die together. If Spain slips in the final, it inverts: Dante stalls on five, and
            the two frozen sevens dead-heat for third and split the twenty, +270 apiece, one coin deciding both. They
            were married last round when they were +110. They are still married. The dowry just went up.
          </P>
        </Panel>

        <Panel
          title="TONIGHT — THE WHOLE POOL IN NINETY MINUTES"
          blurb="One semifinal left, and it is the entire ballgame. Then a final that only Dante is still sweating."
        >
          <Fixtures
            rows={[
              ["Wed, Jul 15 · noon · SF2", "England", "Rob", "Argentina", "Nathan", "The pool, in one match. Winner banks a finalist and their owner takes it all; the loser's season ends at the semifinal. It's coming home, or it's coming to Messi"],
              ["The Final", "Spain", "Dante", "TBD Finalist", "Rob / Nathan", "Spain is already in and already the favorite. Dante needs them to win it for his podium chair — and whichever of Rob or Nathan gets here has clinched the pool no matter the result"],
            ]}
          />
          <P>
            There is no math to do beyond the scoreboard. Rob wins the pool if England wins; Nathan wins the pool
            if Argentina wins; the loser is runner-up and Dante is playing a separate game entirely, down at the cut line,
            hoping Spain finishes the job on Sunday. Twelve seats, and by the final whistle on July 15, exactly one of them
            will be champion-elect.
          </P>
        </Panel>

        <Panel
          title="CALEB'S CORNER — ONE GAME FOR THE POOL"
          blurb="Caleb is not in the pool. That has never once stopped him. The semifinal board is buried; this is the July 15 championship-week card. Cash up front — he knows the drill."
        >
          <Slips
            bets={[
              ["Rob wins the pool — his England beats Nathan's Argentina and it's over", "−250"],
              ["Nathan wins the pool — his Argentina beats Rob's England and the $200 is his", "−175"],
              ["Dante takes the last podium spot — only if his Spain wins the whole thing", "−250"],
              ["Dino and Max back into third — the two frozen sevens split the last seat if Spain loses the final", "+270"],
            ]}
          />
          <P>
            One line for the sharps. Rob is eight points today, and by Sunday he is eight, nine, or twelve — nothing in
            between. Lose on July 15, he stays eight. Win and lose the final, he's nine. Win it all, twelve. There is no ten
            and no eleven on his ticket, which is why the Rob Watch ladder has a hole in the middle of it: every rung
            above 8.5 pays the same, because the only way to clear any of them is England lifting the Cup. Caleb finds
            this beautiful. Caleb also has not paid for a drink since the group stage.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "sf2-sosk",
    bookId: "sons-of-steve-kerr",
    bookName: "SOSK SPORTSBOOK",
    date: "2026-07-14",
    linesLabel: "July 15",
    eyebrow: "THE HOUSE ORGAN — SEMIFINAL SPECIAL, PART 2",
    title: "THE FAVORITE IS FROZEN",
    deck: "Arnst opened this stretch a −160 co-favorite. Then Spain beat his France 2–0 in the semifinal and froze him solid on ten — locked onto the podium, and barred from first place forever, because a champion always clears ten. Burnes bought Spain and Spain is in the final: he's the new −340 chalk. The other seat in that final is the noon England–Argentina, Oanta vs J Call, and J Call is the strange one — a co-leader whose win price is the LONGEST on the board. Arnst's only live bet is the size of his own check. Chris is a statue at nine.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            Arnst bought the whole continent, and for one glorious month the continent's best team was France, and France
            was going to win him everything. Then Spain played them in the semifinal and won 2–0, and the most expensive
            roster in the pool discovered its ceiling the hard way. France is out. Arnst is frozen on ten points — and
            not just eliminated from contention, <em>mathematically barred from first place</em>. Whoever wins this
            tournament clears ten by themselves; there is no arrangement of results where Arnst finishes top of the pool.
            The co-favorite is now playing for second.
          </P>
          <P>
            The seat that inherited the top of the board is Burnes. He owns Spain, Spain is in the final, and the market
            makes Spain a heavy favorite to finish the job — so Burnes, +190 to win the pool back on opening day, is now
            −340. The whole thing sits in one result for him: Spain lifts the Cup, Burnes takes the $150. The other chair
            in that final is decided at noon, at Hawaii West, where Oanta's England plays J Call's Argentina — winner
            advances to face Spain, loser is done for the summer.
          </P>
          <P>
            And here is the wrinkle the house loves. J Call is a co-leader, tied with Arnst on ten, banked so deep he has
            already <em>clinched</em> a podium — and he's the +280 third choice to win, the longest price on the board.
            Oanta, four points behind him at seven, is the shorter number at +220. The reason is simple and cruel: to win
            the pool you have to win the tournament, and Argentina has two mountains left where England, in the market's
            eyes, has a slightly easier semifinal. J Call has the higher floor and the longer road. Both things, again,
            are true.
          </P>
        </Panel>

        <Panel
          title="THE TABLE — TWO CO-LEADERS, ONE OF THEM DONE MOVING"
          blurb="Points bank at each round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. New this round: a semifinal winner is scored as a Finalist — a provisional 5 — until the final settles it, which is why Burnes's Spain already shows nine. Arnst and Chris are frozen; every team they own is eliminated."
        >
          <Standings
            rows={[
              [10, "J Call", ["Argentina"]],
              [10, "Arnst", []],
              [9, "Burnes", ["Spain"]],
              [9, "Chris", []],
              [7, "Oanta", ["England"]],
              [6, "HG", []],
              [6, "Kunal", []],
              [4, "Prozan", []],
            ]}
          />
        </Panel>

        <Panel
          title="OUTRIGHT — TO WIN THE POOL"
          blurb="Outright (to win the pool), June 11 opening sheet against the July 15 morning line. The board flipped: the two June co-favorites are Burnes at the top and Arnst off it entirely."
        >
          <Lines
            rows={[
              ["Burnes", "+190", "−340", "Spain is in the final and the market's favorite to win it. That's the entire bet: Spain lifts the Cup, Burnes takes the pool. From +190 longshot to −340 chalk on one semifinal"],
              ["Oanta", "+460", "+220", "England has to beat Argentina, then dethrone Spain. It's a long road, but it's the SHORT price of the two challengers — the market likes England to win the semifinal"],
              ["J Call", "+460", "+280", "A co-leader on ten, already clinched for a podium, and still the longest win price on the board: Argentina has to beat England AND then beat Spain. Highest floor, tallest mountain"],
              ["Arnst", "+220", "OFF", "Opened a co-favorite. France died in the semifinal and took first place with it — frozen on ten, and a champion always clears ten. He is off the board up here for the rest of the tournament"],
            ]}
          />
        </Panel>

        <Panel
          title="THE ARNST QUESTION — SECOND OR THIRD, NOTHING ELSE"
          blurb="He can't win and he can't miss the podium. Everything Arnst has left is which check he cashes, priced July 15 — and it comes down to one very specific way the tournament can end."
        >
          <Slips
            bets={[
              ["Arnst holds second — frozen at 10, locked onto the podium, keeps at least a share of the $60 in every outcome but one", "−350"],
              ["Arnst slips to sole third — the lone exception: Argentina reaches the final AND Spain wins it, stacking two seats above him", "+240"],
              ["Head to head: J Call finishes above Arnst — the co-leader's upside against the frozen man", "−380"],
            ]}
          />
          <P>
            The arithmetic is clean. Arnst sits on ten, done. For anyone to pass him they have to clear ten themselves,
            and only two seats can: Burnes, if Spain wins the Cup (twelve), and J Call, if Argentina reaches the final
            (eleven). One of them above him and Arnst is still second. <em>Both</em> above him and he's sole third — and
            that needs one exact sequence: Argentina beats England, then Spain beats Argentina in the final. Any
            other ending and Arnst keeps at least a share of second. The house makes that specific parlay +240, and makes
            him −350 to hold. He bought a continent and is now sweating one game he isn't even in.
          </P>
        </Panel>

        <Panel
          title="TO CASH — THE PODIUM, AND CHRIS THE STATUE"
          blurb="Three cash seats. J Call and Arnst have clinched two. The third is Burnes's to lose, with Oanta and a frozen Chris hoping for chaos."
        >
          <Slips
            bets={[
              ["J Call — CLINCHED top 3, a floor of ten no result can crack", "LOCKED"],
              ["Arnst — CLINCHED top 3; only the size of the check is still live", "−2400"],
              ["Burnes cashes — Spain in the final makes this a formality", "−520"],
              ["Oanta cashes — needs England to win the whole tournament; his cash IS his win", "+250"],
              ["Chris steals a shared third — a statue on 9, every team dead, alive only if Argentina wins it all", "+720"],
            ]}
          />
          <P>
            Chris is the ghost at the edge of the podium. He's been frozen on nine for a week, every team he owns
            eliminated, and the board has him +720 to cash — up from +160 on opening day, a number that has quietly gotten
            longer every time the field firmed up around him. His one surviving path is narrow and specific: Argentina
            wins the entire tournament, which drops enough seats that his nine backs into a shared third. He cannot do a
            thing about it. He just needs Messi.
          </P>
        </Panel>

        <Panel
          title="THE OANTA INVITATIONAL — THE LAST SEMIFINAL"
          blurb="The bar Oanta organized on Saturday was, by unanimous panel vote, beast — so his name stays on the marquee through the final. Spain's in; the semifinal sets the other chair. Cash up front; the jukebox still doesn't take IOUs."
        >
          <Slips
            bets={[
              ["Burnes wins the pool — Spain lifts the Cup and the $150 is his; the board's favorite", "−340"],
              ["Oanta wins the pool — England beats Argentina, then dethrones Spain in the final", "+220"],
              ["J Call wins the pool — Argentina beats England, then dethrones Spain in the final", "+280"],
              ["Arnst holds second — frozen at 10, keeps at least a share of the $60 spot in every outcome but one", "−350"],
              ["Arnst slips to sole third — Argentina reaches the final AND Spain wins it, stacking two seats above him", "+240"],
              ["Chris steals a podium — frozen at 9, backs into a shared third only if Argentina wins the whole thing", "+720"],
            ]}
          />
          <P>
            A closing note on the man on the marquee. Oanta threw the Saturday everyone agreed was beast, and to actually
            cash his own party he has to win the whole tournament — his England, the +220 win ticket, is also, to the
            dollar, his only cash ticket. There is no safe version of Oanta's summer. He hosts, or he goes home. The house
            respects the commitment and is charging him full freight anyway.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "sf-boofy",
    bookId: "boofy",
    bookName: "BOOFY SPORTSBOOK",
    date: "2026-07-13",
    linesLabel: "July 14",
    eyebrow: "THE HOUSE ORGAN — SEMIFINAL SPECIAL",
    title: "ROB IS THE FINAL BOSS",
    deck: "Rob owns France AND England, drawn into opposite semifinals, so every live contender left in Boofy has to beat one of his teams to move. He's −1350 to win the pool. Nathan (+140) has to get past his England on Wednesday. And the last cash seat is a three-way knife fight where two of the men are the exact same bet. Plus: a eulogy for Max, killed by his own country.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            The quarterfinals left four teams standing and, for Boofy, two seats that still control their own fate.
            France beat Morocco 2–0 and hasn't looked mortal. Spain ground past Belgium 2–1 the way Spain grinds past
            everyone — quietly, joylessly, effectively. England beat Norway 2–1 on Saturday. And Argentina survived
            Switzerland 3–1 in extra time after the Swiss went down to ten men on a second yellow the group is still,
            three days later, describing as "a dive" — Messi is the greatest of all time and also, per the consensus of
            the chat, receiving FIFA's personal protection detail. Both things can be true.
          </P>
          <P>
            Here is the shape of it. Rob owns both France and England. They were drawn into opposite semifinals, which
            means Rob is personally the opponent every live challenger has to beat: his France meets Dante's Spain on
            Tuesday, his England meets Nathan's Argentina on Wednesday. Win both and it's an England–France final — one
            seat holding the champion AND the runner-up, the whole board on one man. The house has him −1350 to win the
            pool and the Rob Watch median at twelve points. He is the final boss, and the bracket handed him the
            controller.
          </P>
          <P>
            The subplot is underneath, at the cut line. Rob and Nathan have already <em>clinched</em> a cash finish —
            neither can fall past third no matter what happens on the pitch. That leaves exactly one podium seat and
            three men clawing for it, and the cruelest part is the arithmetic: Dino and Max, both frozen on seven, are
            not two bets. They are one bet, priced identically, living or dying on the same coin.
          </P>
        </Panel>

        <Panel
          title="THE TABLE — 4 TEAMS LEFT, 5 POINTS STILL IN PLAY"
          blurb="Points bank at each round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. Of the 65 points the tournament pays out, 60 are already banked below — the last 5 ride on the final: +4 to the champion, +1 to the runner-up, nothing to the two seats whose semifinal ends their season."
        >
          <Standings
            rows={[
              [8, "Rob", ["France", "England"]],
              [8, "Nathan", ["Argentina"]],
              [7, "Dino", []],
              [7, "Max", []],
              [6, "Nick", []],
              [5, "Jake", []],
              [4, "Dante", ["Spain"]],
              [4, "Jack", []],
              [4, "Adrian", []],
              [4, "Kunal", []],
              [3, "Shaya", []],
              [0, "Matt", []],
            ]}
          />
        </Panel>

        <Panel
          title="OUTRIGHT — TO WIN THE POOL"
          blurb="Outright (to win the pool), June 11 opening sheet against the July 14 morning line. Two live seats, one short price, ten obituaries."
        >
          <Lines
            rows={[
              ["Rob", "+220", "−1350", "Opened the favorite; after banking two semifinalists on opposite halves he's a formality. Only an England–France final gives one man the trophy and the runner-up both"],
              ["Nathan", "+780", "+140", "Argentina won its extra-time war down a man against Switzerland. The only thing between Nathan and the final is Rob's England on Wednesday — the two co-leaders, head to head, for a ticket"],
              ["Dante", "+410", "OFF", "Spain is alive and Dante still cannot win the pool — his ceiling is a three-way tie at eight. His whole summer now lives in the cash market below"],
              ["The other nine", "—", "OFF", "Mathematically extinct. Kunal, the opening second-favorite, dead since the Round of 16, has moved on to the real play — group intel says his new Hinge opener is 'my entire bracket died in one weekend, so emotionally I've never been more available'"],
            ]}
          />
        </Panel>

        <Panel
          title="TO CASH — THE LAST SEAT ON THE PODIUM"
          blurb="Three podium spots, twelve seats. Rob and Nathan have clinched two of them. The third is a knife fight priced July 14 — and exactly one of these three men walks away with nothing."
        >
          <Slips
            bets={[
              ["Rob — CLINCHED top 3, now playing only for the $200 and the group chat", "LOCKED"],
              ["Nathan — CLINCHED top 3; Argentina is purely about first place and burying Rob", "LOCKED"],
              ["Dino cashes — frozen on 7, every team eliminated; safe UNLESS Spain wins the whole thing", "+110"],
              ["Max cashes — the identical bet to Dino, to the decimal", "+110"],
              ["Dante's Inferno, last chamber — Spain must lift the actual trophy, and it buries both frozen men", "+250"],
            ]}
          />
          <P>
            Read the two elevens. Dino and Max are the same wager wearing different names: both frozen on seven, both
            with every team eliminated, both +110. If Dante's Spain does not win the tournament outright, the two of
            them dead-heat for third and split the twenty — the house priced their head-to-head at −115 each, a coin
            that lands on its edge. And if Spain <em>does</em> lift it, Dante vaults to eight and takes the seat, and
            Dino and Max die together, on the same afternoon, for the same reason. There is no world where one cashes
            and the other doesn't. They are married now.
          </P>
        </Panel>

        <Panel
          title="THE SEMIFINAL SLATE — WHO'S PLAYING FOR WHOM"
          blurb="Two matches, two days, and Rob is standing in both doorways."
        >
          <Fixtures
            rows={[
              ["Tue, Jul 14 · SF1", "France", "Rob", "Spain", "Dante", "The tournament favorite against the last pulse in the basement. France rolls; Spain has scored two goals in two knockout rounds, and Dante needs them to win two more of these"],
              ["Wed, Jul 15 · SF2", "England", "Rob", "Argentina", "Nathan", "The whole pool in one match. Rob's England — it's coming home, they keep singing — against Nathan's Argentina and a Messi the chat is convinced is getting the whistles. Winner plays for the Cup; the loser's summer ends on the spot"],
            ]}
          />
          <P>
            Read the middle column again: Rob is the away team in both semifinals. To win the pool, Dante has to beat
            him Tuesday and Nathan has to beat him Wednesday, and if neither manages it the tournament stages an
            England–France final for Rob's personal amusement and this becomes a coronation newsletter. Nathan is the
            only man with a live counter — beat Rob's England with Messi, and the pool is genuinely his. Everyone else
            is watching Rob's teams and doing math.
          </P>
        </Panel>

        <Panel
          title="IN MEMORIAM — MAX, KILLED BY HIS OWN COUNTRY"
          blurb="The house lowers its flags for a dirty Brit, felled at the quarterfinal by the nation on his own passport."
        >
          <P>
            Max drew Norway, and Norway was the whole plan. It beat Ivory Coast. It beat Brazil — the shot that killed
            Kunal, five-time champions gone in a knockout round. It reached the quarterfinal and banked seven points.
            And then the bracket did the cruelest thing it had available: it sent Norway to play England. Max is a
            British man. England is his country, the one he was raised to sing for — and it was suddenly the only thing
            standing between his lotto team and a semifinal.
          </P>
          <P>
            England won 2–1. Max's Norway is out, Max is frozen on seven for the rest of recorded history, and the
            instrument of his death was his own flag. The house has watched a lot of seats die — on penalties, at the
            Azteca, by French efficiency — but eliminated by the nation you were raised to root <em>for</em>, on a
            Saturday, is a new entry in the ledger. He is survived by a loveless dead-heat for third with Dino and a
            +110 ticket that pays only if Spain stays boring. Somewhere, England fans are singing. He is, technically,
            one of them.
          </P>
        </Panel>

        <Panel
          title="CALEB'S CORNER — THE FINAL BOSS"
          blurb="Caleb is not in the pool. That has never once stopped him. The Saturday board is buried; the semifinal board is live as of the July 14 morning line. Cash up front — he knows the drill."
        >
          <Slips
            bets={[
              ["The final is Rob vs Rob — England AND France both reach it, the trophy and the runner-up landing on one seat", "+220"],
              ["Rob laps the field — two live semifinalists on opposite halves, and he wins the pool", "−1350"],
              ["Nathan's only road runs through Rob — Argentina has to beat England on Wednesday, then the pool is his", "+140"],
              ["Dante's Inferno, last chamber — top 3 means Spain lifting the actual trophy, a final isn't enough", "+250"],
              ["Killed by his own country — Max, a dirty Brit, frozen at 7, still cashes if Spain stays boring", "+110"],
              ["Dead but not buried — Dino, every team eliminated, frozen on 7, cashes if the climbers stall", "+110"],
            ]}
          />
          <P>
            A note for the sharps who read last round's footnote. In the quarterfinals the house pointed out that "Rob
            over 12.5" and "England and France both reach the final" were the same bet in two hats. They have since
            divorced. Rob can now lap the field with a single finalist — one of his teams reaching the final is very
            likely enough — so "Rob wins the pool" is −1350 while the greedy all-Rob final, which needs <em>both</em>{" "}
            to survive, still pays +220. Same man, two very different prices. Caleb, naturally, took the +220. He has
            never once been interested in the safe number.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "sf-sosk",
    bookId: "sons-of-steve-kerr",
    bookName: "SOSK SPORTSBOOK",
    date: "2026-07-13",
    linesLabel: "July 14",
    eyebrow: "THE HOUSE ORGAN — SEMIFINAL SPECIAL",
    title: "WHO WANTS THE SMOKE",
    deck: "J Call and Arnst are tied at ten. The market makes Arnst −160, makes Burnes — two points BACK — the +220 second choice, and prices the co-leader J Call third at +290. Down the board, Chris is a statue at nine guarding the last cash seat from two live men, one of whom the board is now named after. Plus: Hawaii West on Saturday was, by unanimous panel vote, beast.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            Saturday's doubleheader did exactly what Saturdays at Hawaii West do: it clarified everything and settled
            nothing. J Call played himself — Argentina against Switzerland, both his — and Argentina survived 3–1 in
            extra time after Embolo saw a second yellow the entire bar agrees was a flop, which is rich coming from that
            bar. Norway and England went the other match; England came through, Oanta advanced, and Kunal went home —
            and has reportedly already repurposed the grief, opening Hinge with "had Norway to the final four and got
            left at the altar, want to trade heartbreaks?" When the smoke cleared — and there was a great deal of
            smoke — the four live seats in SOSK were exactly the four semifinalists, one owner apiece. No more men
            playing solitaire. Everybody has a real opponent now.
          </P>
          <P>
            Which brings us to the line of the sheet. J Call and Arnst are tied for the lead at ten points. The market
            does not treat them as equals — it doesn't treat them as <em>neighbors.</em> Arnst is −160 to win the pool
            because he holds France, the tournament favorite, unthreatened all month. J Call is +290, the <em>third</em>{" "}
            choice, because to win the pool his Argentina essentially has to lift the Cup, and it is France's tournament
            until proven otherwise. And wedged between the co-leaders sits Burnes — two points behind both of them, at
            +220 — because his Spain has a cleaner "win it and I win" lane than the man tied for first. Tied for the
            lead and priced third. Somewhere this is a lesson about ceilings.
          </P>
          <P>
            The consolation for J Call: he still beats Burnes where it's measured one-on-one. Head-to-head, J Call
            finishes above Burnes 79% of the time (−470) — his floor is miles higher. He just can't out-ceiling him,
            and the pool pays the ceiling. Below all of it, Chris is a statue at nine with every team eliminated,
            defending the last podium seat from Burnes and Oanta — and the board this week is named after Oanta.
          </P>
        </Panel>

        <Panel
          title="THE TABLE — 4 TEAMS LEFT, 5 POINTS STILL IN PLAY"
          blurb="Points bank at each round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. Of the 65 points the tournament pays out, 60 are already banked below — the last 5 ride on the final: +4 to the champion, +1 to the runner-up, nothing to the two seats whose semifinal ends their season."
        >
          <Standings
            rows={[
              [10, "J Call", ["Argentina"]],
              [10, "Arnst", ["France"]],
              [9, "Chris", []],
              [8, "Burnes", ["Spain"]],
              [7, "Oanta", ["England"]],
              [6, "HG", []],
              [6, "Kunal", []],
              [4, "Prozan", []],
            ]}
          />
        </Panel>

        <Panel
          title="OUTRIGHT — TO WIN THE POOL"
          blurb="Outright (to win the pool), June 11 opening sheet against the July 14 morning line. Two men tied for the lead, three men in the conversation, and the points leader isn't the favorite."
        >
          <Lines
            rows={[
              ["Arnst", "+220", "−160", "France is the favorite and has been all tournament. Co-leader at ten, and the only one of the two with the better horse. Plays Burnes's Spain on Tuesday for a finalist's ticket"],
              ["Burnes", "+190", "+220", "The opening favorite, left for dead twice, is somehow the SECOND choice again — from two points back. His whole case is Spain, and Spain has to get through Arnst's France to make it real"],
              ["J Call", "+460", "+290", "Tied for the lead, priced third. His Argentina essentially has to win the Cup outright, and it's competing with France for it. Head-to-head he still buries Burnes (−470) — he just can't match his ceiling"],
              ["Oanta", "+460", "+510", "England, it's-coming-home and all, into a semifinal with Argentina. Longest of the four live seats — but he threw the best party of the tournament, so we'll allow him the marquee"],
            ]}
          />
        </Panel>

        <Panel
          title="TO CASH — THE LAST SEAT ON THE PODIUM"
          blurb="J Call and Arnst have clinched two of the three cash seats. The third belongs to whoever survives — and exactly one of these three men gets it."
        >
          <Slips
            bets={[
              ["J Call — CLINCHED top 3, now purely about first place", "LOCKED"],
              ["Arnst — CLINCHED top 3, and favored for the whole thing", "LOCKED"],
              ["The statue holds — Chris, nine points, every team eliminated, cashes anyway; dead-heat rules split, so even a tie pays", "−230"],
              ["Burnes crashes it — Spain past France, then deep enough to run Chris down", "+190"],
              ["Oanta crashes it — England has to win the whole tournament, and he'd be cashing at his own event", "+380"],
            ]}
          />
          <P>
            The math is a closed room: Chris 55.8%, Burnes 27.6%, Oanta 16.6%, and they sum to a hundred because exactly
            one of them takes the seat. The statue is the favorite to be carried across the line by doing nothing at all
            — every team he owns is already dead, and dead-heat rules mean even a tie pays. Burnes has to take Spain
            <em> through</em> Arnst's France and keep going. Oanta has to win the actual World Cup to crash a podium at
            a party with his own name on the door. Nine points and a pulse of zero is, somehow, the safest hand on the
            board.
          </P>
        </Panel>

        <Panel
          title="THE SEMIFINAL SLATE — WHO'S PLAYING FOR WHOM"
          blurb="Two matches, two days, and both of them are old front lines. Every semifinal is a seat-vs-seat duel now."
        >
          <Fixtures
            rows={[
              ["Tue, Jul 14 · SF1", "France", "Arnst", "Spain", "Burnes", "The co-leader against the leapfrog, settled in person. Arnst is −470 to finish above Burnes on the season; this is the afternoon it's decided. France rolling, Spain boring their way through — 2–1 Belgium, 1–0 Portugal — and Burnes, ever the hockey man, calls their press 'forechecking'"],
              ["Wed, Jul 15 · SF2", "Argentina", "J Call", "England", "Oanta", "The co-leader against the host. J Call's Argentina, riding a Messi the whole bracket believes is getting FIFA's whistles, against Oanta's England and an entire nation singing the same song. Winner plays for the Cup"],
            ]}
          />
          <P>
            One dispatch from the war desk, for the record: the DKE Civil War moneyline is still off the board — New DKE
            clinched it the day the bracket set, Old DKE eliminated, as covered at length last round. But look at the
            draw. Both semifinals are cross-faction: Arnst (Old) versus Burnes (New) on Tuesday, Oanta (Old) versus J
            Call (New) on Wednesday. The battle that's mathematically over gets re-fought on the pitch anyway, twice.
            It was, as ever, an Old DKE production. New DKE won it regardless.
          </P>
        </Panel>

        <Panel
          title="THE OANTA INVITATIONAL — PRESENTED BY HAWAII WEST"
          blurb="Saturday at Hawaii West was, by unanimous panel vote, beast — two good TVs, a full ashtray, loosies a dollar a stick, the new Future album on the jukebox until someone begged, and Oanta the man who organized all of it. So the semifinal card carries his name. Cash up front; the jukebox still doesn't take IOUs."
        >
          <Slips
            bets={[
              ["J Call beats the host — Argentina past Oanta's England on Wednesday — and wins the pool", "+290"],
              ["Arnst answers the co-leader — France past Burnes's Spain on Tuesday, and he clears Over 12.5 points", "+125"],
              ["The co-leaders collide for the Cup — Argentina AND France both reach the final, J Call vs Arnst for everything", "+195"],
              ["The leapfrog, last leg — Burnes (Spain) runs down the frozen Chris, but only the trophy does it", "+195"],
              ["Oanta crashes his own party — the man who threw the Saturday needs England to win the whole thing to cash top 3", "+380"],
              ["The statue holds — Chris, every team eliminated, cashes top 3 anyway; dead-heat splits the cash", "−230"],
            ]}
          />
          <P>
            The featured slip is the co-leaders' final at +195 — Argentina and France sit on opposite halves, so "both
            reach the final" is exactly a J Call versus Arnst title match, the whole pool decided in a single ninety
            minutes neither man can influence. It is the SOSK answer to Boofy's Rob-vs-Rob final, and if it lands, two
            grown men will spend the rest of their lives each insisting he called it. The bar has already reserved the
            good TV. The jukebox, as always, does not take IOUs — though it will, apparently, play the new Future record
            until the room votes it out.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "qf-boofy",
    bookId: "boofy",
    bookName: "BOOFY SPORTSBOOK",
    date: "2026-07-08",
    linesLabel: "July 8",
    eyebrow: "THE HOUSE ORGAN — QUARTERFINAL SPECIAL",
    title: "SEVENS ACROSS THE BOARD",
    deck: "Dino, Max and Nathan are tied at seven with one team apiece. The guy in FOURTH is −280 to win the whole thing. The quarterfinals start tomorrow — the table, the carnage, a eulogy for Kunal, and a fresh board in Caleb's Corner.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            The Round of 16 killed eight teams and three seats. Adrian went first — Paraguay frightened France for an
            hour, lost 1–0, and took +48000 worth of dreams with them. Kunal went Sunday when Brazil lost to Norway,
            a sentence the house has now read eleven times and still doesn't believe (full eulogy below). And Jack
            went last night the cruelest way available: Colombia, 0–0 through 120 minutes, made three penalties.
            Switzerland made four.
          </P>
          <P>
            Which brings us to Jake, who watched his team win a knockout match without scoring a goal for two hours
            and immediately texted the group: <em>"One more closer to the money."</em> Jake has five points. The money
            is third place. The house has priced this journey at +3500 (see Caleb's Corner) and admires the spirit
            enormously.
          </P>
          <P>
            At the top it's a genuine logjam: Dino, Max and Nathan, seven points each, one live team each — Morocco,
            Norway, Argentina. Three men, three horses, no margin. And underneath them, at six, sits the problem the
            headline promised last time: Rob still has England AND France, they're on opposite halves of the bracket,
            and the market prices his seat like the tie at the top is a rounding error.
          </P>
        </Panel>

        <Panel title="THE TABLE — 8 TEAMS LEFT, 9 POINTS STILL IN PLAY" blurb="Points bank at each round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. Of the 65 points the tournament pays out, 56 are already banked below — the last 9 go to whoever's teams keep winning.">
          <Standings
            rows={[
              [7, "Dino", ["Morocco"]],
              [7, "Max", ["Norway"]],
              [7, "Nathan", ["Argentina"]],
              [6, "Rob", ["England", "France"]],
              [6, "Nick", ["Belgium"]],
              [5, "Jake", ["Switzerland"]],
              [4, "Kunal", []],
              [4, "Jack", []],
              [4, "Adrian", []],
              [3, "Dante", ["Spain"]],
              [3, "Shaya", []],
              [0, "Matt", []],
            ]}
          />
        </Panel>

        <Panel
          title="LINE MOVEMENT — OPENING DAY vs THIS MORNING"
          blurb="Outright (to win the pool), June 11 opening sheet against the July 8 morning line."
        >
          <Lines
            rows={[
              ["Rob", "+220", "−280", "Was −115 on R16 morning; two quarterfinalists later, the number got angrier. France +185 to win it all, England +580"],
              ["Nathan", "+780", "+175", "Won the all-Nathan derby (Argentina 3, Egypt 2) and the market noticed: Argentina is the second title choice at +440"],
              ["Max", "+1150", "+630", "Norway beat Brazil. In a knockout match. The house has read the result several times and it keeps saying that"],
              ["Dino", "+530", "+1750", "The guaranteed quarterfinalist arrived (Morocco), but Portugal and Canada died on the way — one Cinderella carries the seat"],
              ["Nick", "+1750", "+3100", "Belgium hung four on the USA and finally looked like Belgium. One team is still one team"],
              ["Dante", "+410", "+5900", "Spain won its civil war with Portugal. Dante has three points and a very good reason to keep watching"],
              ["Jake", "+2750", "+8300", "One more closer to the money"],
              ["Kunal", "+230", "OFF", "Opened second favorite. Now mathematically extinct. Eulogy below — dress appropriately"],
              ["Jack", "+1650", "OFF", "Colombia missed exactly one more penalty than Switzerland. Margins"],
              ["Adrian", "+7200", "OFF", "Paraguay went home with dignity, which is more than the +48000 slip can say"],
              ["Shaya", "+3200", "OFF", "Still holds the beef-ledger win over Matt. Banner year"],
              ["Matt", "+43000", "OFF", "See the spoon report at the bottom of the eulogy"],
            ]}
          />
        </Panel>

        <Panel
          title="THE QF SLATE — WHO'S PLAYING FOR WHOM"
          blurb="Four matches, three days — and the favorite is in two of them, playing two of the three co-leaders."
        >
          <Fixtures
            rows={[
              ["TOMORROW, Jul 9", "France", "Rob", "Morocco", "Dino", "Half of Rob's empire vs all of Dino's. Morocco +3000 to win the Cup; the house checked, they don't care"],
              ["Fri, Jul 10", "Spain", "Dante", "Belgium", "Nick", "Two one-team seats. Dante's at 3, Nick's at 6, and the loser starts drafting excuses for 2030"],
              ["Sat, Jul 11", "Norway", "Max", "England", "Rob", "Max — a Brit, and the house means this respectfully, a DIRTY Brit — sends Haaland to eliminate England"],
              ["Sat, Jul 11", "Argentina", "Nathan", "Switzerland", "Jake", "Nathan's title horse vs one more closer to the money"],
            ]}
          />
          <P>
            Read the middle column: Rob plays Dino on Thursday and Max on Saturday. Two of the three men tied at
            seven have to go through Rob's teams to stay there, and the third (Nathan) gets Jake. If England and
            France both win, Rob is at eight with two semifinalists and this becomes a coronation newsletter. If
            they both lose, Caleb's old slip rises from the grave to say it told us so.
          </P>
        </Panel>

        <Panel title="IN MEMORIAM — KUNAL (JUNE 11 – JULY 5)" blurb="The house lowers its flags. A seat that opened +230, the second favorite, is survived by four points.">
          <P>
            Kunal drew Germany, Brazil, South Korea and the Netherlands — a hand so loaded the opening sheet had him
            behind only Rob. The autopsy reads as follows. South Korea: never got out of the group. Germany: hung a
            7–1 on Curaçao, then lost to Ecuador, then died on penalties to Paraguay. The Netherlands: died on
            penalties the same night, two hours later, like a family pact. Brazil — five-time champions, unbeaten in
            the tournament — lost 2–1 to Norway in the Round of 16, which is the soccer equivalent of losing your
            queen to a knight fork you saw coming. Four points. None of them arriving after July 5. The bell tolls.
          </P>
          <P>
            And since we're at the cemetery anyway: Matt remains at peace. The Wooden Spoon market still reads
            LOCKED, the earliest clinch in Boofy history, and witnesses report he has started referring to it as
            "hardware." The house respects a man who knows what he's won.
          </P>
        </Panel>

        <Panel
          title="CALEB'S CORNER — THE NEW BOARD"
          blurb="Caleb is not in the pool. That has never once stopped him. The R16 board is in the ground — obituaries below — and the quarterfinal board is live as of this morning. Cash up front, as always."
        >
          <Slips
            bets={[
              ["“One more closer to the money” — Jake texts his way onto the podium, cashes top 3", "+3500"],
              ["The final is Rob vs Rob — England AND France both reach it", "+440"],
              ["Rob goes nuclear — Over 12.5 points", "+440"],
              ["Max, a dirty Brit, sends England home on Saturday and wins the whole pool", "+630"],
              ["Dante climbs from the basement — cashes top 3 on Spain alone", "+330"],
            ]}
          />
          <P>
            The obituaries. "Adrian wins the whole pool" (+48000) died at 4:52 PM on July 4, cause of death: France.
            "Paraguay reach the semifinal" (+2050) died in the same incident. "Hosts with the most — Mexico win it
            all" (+1350) died Sunday at the Azteca, 3–2, England. And the big one: "Rob bricks it — Under 4.5 points,"
            the slip Caleb texted the house about twice, is mathematically dead — Rob banked his fifth and sixth
            points inside 24 hours. Caleb has not texted since. The house is told he observed a moment of silence,
            then asked for the Rob-vs-Rob final at +440.
          </P>
          <P>
            A footnote for the sharps: yes, "Rob over 12.5" and "England and France both reach the final" are both
            +440, and yes, if you do the arithmetic, they are the same bet wearing two hats — thirteen points only
            exists via an all-Rob final. The house posted it twice anyway. Caleb bet it twice anyway. Everyone is
            happy.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "qf-sosk",
    bookId: "sons-of-steve-kerr",
    bookName: "SOSK SPORTSBOOK",
    date: "2026-07-08",
    linesLabel: "July 8",
    eyebrow: "THE HOUSE ORGAN — QUARTERFINAL SPECIAL",
    title: "THREE LEADERS, ONE FAVORITE",
    deck: "Chris, J Call and Arnst are tied at nine. The market believes exactly one of them — the guy who plays himself on Thursday. Plus: Burnes is somehow the second favorite again, the house closes the file on his citizenship, and a farewell to the greatest comeback that didn't happen.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            Nine, nine, nine. Chris, J Call and Arnst enter the quarterfinals in a dead heat at the top, and the
            resemblance ends there. Chris got to nine with three teams and has one left — Belgium, +4100 to win the
            Cup, which is the market's way of coughing politely. J Call and Arnst got there with two apiece, and
            here's the thing: <em>both of them play themselves this week.</em> Arnst owns France AND Morocco, who
            meet on Thursday. J Call owns Argentina AND Switzerland, who meet on Saturday. Two men have
            already banked a semifinalist in a round that hasn't started. The other six seats are gambling; these two
            are doing paperwork.
          </P>
          <P>
            Below the tie, the weirdest line on the sheet: Burnes is the second favorite. Again. The man opened +190,
            watched the Netherlands and Sweden die in one weekend, drifted to +540 like a shipwreck — and now Spain
            has quietly beaten Portugal, the market makes them +410 for the title, and Burnes is back at +280. The
            house would call it a dead-cat bounce, but out of respect for recent events in his life (see the
            citizenship file below), we'll allow "resilient."
          </P>
          <P>
            And Saturday's Norway–England match is the pool's only true duel: Kunal against Oanta, both seats stuck on six,
            winner ties Burnes at seven and takes the last live lane to the podium. Norway beat Ivory Coast, then
            beat Brazil. England hasn't trailed in a knockout match. Something honest is about to happen.
          </P>
        </Panel>

        <Panel title="THE TABLE — 8 TEAMS LEFT, 9 POINTS STILL IN PLAY" blurb="Points bank at each round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8. Of the 65 points the tournament pays out, 56 are already banked below — the last 9 go to whoever's teams keep winning.">
          <Standings
            rows={[
              [9, "J Call", ["Argentina", "Switzerland"]],
              [9, "Chris", ["Belgium"]],
              [9, "Arnst", ["Morocco", "France"]],
              [7, "Burnes", ["Spain"]],
              [6, "Oanta", ["England"]],
              [6, "Kunal", ["Norway"]],
              [6, "HG", []],
              [4, "Prozan", []],
            ]}
          />
        </Panel>

        <Panel
          title="LINE MOVEMENT — OPENING DAY vs THIS MORNING"
          blurb="Outright (to win the pool), June 11 opening sheet against the July 8 morning line."
        >
          <Lines
            rows={[
              ["Arnst", "+220", "−145", "Plays himself Thursday, so the semifinal berth is already in the vault. France +185 remains the title favorite"],
              ["Burnes", "+190", "+280", "The opening favorite, left for dead at +540 on R16 morning, resurrected by Spain. The house checked twice"],
              ["J Call", "+460", "+280", "Tied with Burnes to the tick — except J Call's semifinalist is already banked and Burnes's is a prayer named Spain"],
              ["Oanta", "+460", "+650", "England alone, +580 for the Cup, and a date with a Norwegian who has scored in every round"],
              ["Kunal", "+1150", "+1800", "Norway keeps winning knockout matches and the model keeps apologizing to Norway"],
              ["Chris", "+960", "+2000", "Tied for the points lead. Priced seventh-favorite money. One-team seats get no respect in this economy"],
              ["HG", "+2350", "OFF", "The comeback is over. The memorial is below. Hats off"],
              ["Prozan", "+680", "OFF", "SPOONED"],
            ]}
          />
        </Panel>

        <Panel
          title="THE QF SLATE — WHO'S PLAYING FOR WHOM"
          blurb="Four matches, three days, and two of them are men playing solitaire."
        >
          <Fixtures
            rows={[
              ["TOMORROW, Jul 9", "France", "Arnst", "Morocco", "Arnst", "Arnst vs Arnst. Somewhere Steve Kerr is diagramming a play where both teams run it"],
              ["Fri, Jul 10", "Spain", "Burnes", "Belgium", "Chris", "The leapfrog window: Burnes at 7 chasing Chris at 9, and their teams settle it in person"],
              ["Sat, Jul 11", "Norway", "Kunal", "England", "Oanta", "Six points each. Winner ties Burnes at seven. The pool's only honest fistfight"],
              ["Sat, Jul 11", "Argentina", "J Call", "Switzerland", "J Call", "J Call vs J Call. He has requested the group chat respect his privacy during this difficult win"],
            ]}
          />
          <P>
            Housekeeping from the war desk: the DKE Civil War moneyline is over. Old DKE's mathematical ceiling —
            every surviving team running the table in the friendliest possible order — is 32 points, and 33 wins the
            battle. NEW DKE has clinched. The moneyline is off the board, the −1.5 spread survives at −610 for the
            completists, and the panel notes, one final time, that this was an OLD DKE production.
          </P>
        </Panel>

        <Panel title="THE HUNTER MEMORIAL" blurb="A moment for HG, whose comeback died at the penalty spot last night.">
          <P>
            Remember where this started. HG drew Ghana, Colombia, Australia, Algeria, South Africa and South Korea —
            a hand so bleak the house built an entire section around it. The HUNTER WATCH opened with a median of six
            points and the outright at +2350, and the sheet's kindest sentence was "the model's median is 6." Then the
            man's teams just kept banking. Australia dragged Egypt to penalties. Colombia won a knockout match, then
            took Switzerland to the wall — 120 scoreless minutes from the quarterfinals, and as recently as Saturday
            the house had HG at +630 to CASH. From that draw. It died 4–3 from twelve yards, and the watch seat
            passes to J Call, but the flag flies at half-mast today. The worst hand in the pool outlived the opening
            favorite's entire portfolio. Respect.
          </P>
        </Panel>

        <Panel title="THE CITIZENSHIP FILE — CASE CLOSED" blurb="Canada lost 0–3 to Morocco on July 4. The compliance department has issued its final report.">
          <P>
            For three weeks this office investigated whether Burnes's Canadian enthusiasm — the "statement win, eh,"
            the unprompted "playoff hockey," the two apologies for winning — was opportunism. The finding is worse
            than we feared: <em>it was genuine.</em> That was real national pride,
            sincerely held, and Morocco put three past it on a Saturday afternoon while he watched with a Tim Hortons
            double-double going cold in his hand. The +33000 title slip is OFF. The file is closed. The house extends
            its condolences and notes, purely for the record, that he has already begun describing Spain's press as
            "forechecking."
          </P>
        </Panel>

        <Panel
          title="HAWAII WEST SPECIALS — THE SATURDAY WINDOW"
          blurb="Prozan's Parlay Window is retired — the spoon is LOCKED, the first statue in SOSK history, permanently installed at four points. The marquee passes to Hawaii West, the worst (best) bar in San Francisco, where Saturday's doubleheader will be watched as tradition demands. These are the bar's lines. Cash up front — the jukebox doesn't take IOUs."
        >
          <Slips
            bets={[
              ["J Call beats J Call (Argentina vs Switzerland, both his) and wins the pool", "+280"],
              ["Kunal (Norway) outscores Oanta (England) — settled on the pitch Saturday, adjudicated at the bar", "+135"],
              ["The leapfrog lives — Burnes (Spain) still runs down Chris (Belgium), Friday is the whole ballgame", "+250"],
              ["Arnst plays himself Thursday and his survivor reaches the final — Over 10.5 points", "−175"],
              ["The Hawaii West parlay — Norway AND Argentina both win Saturday, drinks on the doubters", "+200"],
            ]}
          />
          <P>
            From the old board: "HG crashes the podium" (+630) died at the penalty spot, see memorial above. The
            Burnes leapfrog carries over at a fatter +250 — Belgium looked terrifying against the USA and the gap is
            still two points. And the featured slip is the house special: both Saturday matches will be on the two
            good TVs at Hawaii West, and if Norway and Argentina both win — Kunal takes the duel, J Call banks his
            semifinalist the hard way — the bar pays +200 and hears about it until closing. The house has already
            reserved its stool.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "r16-boofy",
    bookId: "boofy",
    bookName: "BOOFY SPORTSBOOK",
    date: "2026-07-04",
    eyebrow: "THE HOUSE ORGAN — ROUND OF 16 SPECIAL",
    title: "ROB IS THE PROBLEM NOW",
    deck: "Three weeks ago this pool had a betting favorite named Kunal. Fate had other ideas. The Round of 16 starts today — here's where every seat stands, what moved the lines, and the new board in Caleb's Corner.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            The group stage gave us 72 matches, one 7–1, and a full reordering of the board. Germany hung seven on
            Curaçao on June 14 and looked like the tournament's freight train — then lost to Ecuador, drew Paraguay in
            the Round of 32, and went out on penalties to a team that conceded four to the USA in its opener. The
            Netherlands followed them out the door the same night, also on penalties, to Morocco. If you were holding
            German or Dutch stock (looking at you, Kunal), that was the whole portfolio in two hours.
          </P>
          <P>
            Meanwhile the two teams nobody needed to overthink — England and France — did exactly what the market said
            they would. England won its group without conceding a knockout goal yet (2–0 over DR Congo in the R32);
            France beat Norway 4–1, then handled Sweden 3–0. Both belong to Rob, who also rosters Tunisia and Iraq, a
            fact the house mentions purely for historical completeness.
          </P>
          <P>
            And pour one out for Matt. Panama, Uzbekistan, Curaçao, Haiti: zero wins, one draw, eleven losses, five
            goals scored, thirty-two conceded. Matt is the first seat in Boofy history to mathematically clinch the
            Wooden Spoon with three rounds still to play. The board has him LOCKED. Frame it.
          </P>
        </Panel>

        <Panel title="THE TABLE — 65 POINTS, 16 TEAMS LEFT" blurb="Points bank at each round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8.">
          <Standings
            rows={[
              [6, "Nathan", ["Argentina", "Egypt"]],
              [6, "Max", ["Norway", "United States"]],
              [6, "Dino", ["Portugal", "Canada", "Morocco"]],
              [5, "Nick", ["Belgium"]],
              [4, "Rob", ["England", "France"]],
              [4, "Kunal", ["Brazil"]],
              [4, "Jake", ["Switzerland", "Mexico"]],
              [4, "Jack", ["Colombia"]],
              [4, "Adrian", ["Paraguay"]],
              [3, "Shaya", []],
              [2, "Dante", ["Spain"]],
              [0, "Matt", []],
            ]}
          />
        </Panel>

        <Panel
          title="LINE MOVEMENT — OPENING DAY vs THIS MORNING"
          blurb="Outright (to win the pool), June 11 opening sheet against the July 4 morning line."
        >
          <Lines
            rows={[
              ["Rob", "+220", "−115", "England and France both cruising; the pool has a favorite priced in the minus for the first time"],
              ["Nathan", "+780", "+240", "Argentina and Egypt both alive — and they play each other (see below)"],
              ["Dino", "+530", "+470", "Three teams alive; steadiest line on the board"],
              ["Max", "+1150", "+900", "Norway and the USA both took care of business"],
              ["Jake", "+2750", "+1200", "Mexico looks real; the Azteca crowd agrees"],
              ["Kunal", "+230", "+1300", "Opened second favorite. Germany and the Netherlands both died on penalties in one night"],
              ["Dante", "+410", "+2500", "Scotland, Türkiye and Saudi Arabia all went home; Spain carries the whole seat"],
              ["Jack", "+1650", "+3700", "Colombia alone"],
              ["Nick", "+1750", "+5200", "Belgium alone, and Belgium needed five goals against New Zealand to look like Belgium"],
              ["Adrian", "+7200", "+48000", "One team left and it's Paraguay. Caleb has thoughts (see below)"],
              ["Shaya", "+3200", "OFF", "Eliminated. Did beat Matt in the grudge market, so the beef ledger shows a win"],
              ["Matt", "+43000", "OFF", "See obituary above"],
            ]}
          />
        </Panel>

        <Panel
          title="THE R16 SLATE — WHO'S PLAYING FOR WHOM"
          blurb="Eight matches, four days, and two seats that literally cannot lose their matchup."
        >
          <Fixtures
            rows={[
              ["TODAY, Jul 4", "Paraguay", "Adrian", "France", "Rob", "Adrian's entire tournament vs the favorite's engine room"],
              ["TODAY, Jul 4", "Canada", "Dino", "Morocco", "Dino", "Dino owns both sides — a guaranteed quarterfinalist"],
              ["Jul 5", "Brazil", "Kunal", "Norway", "Max", "Kunal's last horse vs one of Max's two"],
              ["Jul 5", "Mexico", "Jake", "England", "Rob", "The hosts vs the pool favorite. Jake needs this one badly"],
              ["Jul 6", "Portugal", "Dino", "Spain", "Dante", "Dante's season is 90 minutes at a time now"],
              ["Jul 6", "United States", "Max", "Belgium", "Nick", "Nick's whole tournament in one match"],
              ["Jul 7", "Argentina", "Nathan", "Egypt", "Nathan", "Nathan owns both sides too — the other guaranteed quarterfinalist"],
              ["Jul 7", "Switzerland", "Jake", "Colombia", "Jack", "Loser's seat drops to one team or none"],
            ]}
          />
          <P>
            Read that middle column again: Dino plays Dino today and Nathan plays Nathan on Tuesday. Two seats banked a
            quarterfinalist before a ball was kicked in this round. The other ten of you are gambling. Well — nine.
            Matt is at peace.
          </P>
        </Panel>

        <Panel
          title="CALEB'S CORNER — THE NEW BOARD"
          blurb="Caleb is not in the pool. That has never once stopped him. Three of the five opening slips died with Matt and Shaya's group-stage exits, so the house has posted a fresh board, effective this morning. Cash up front, as always."
        >
          <Slips
            bets={[
              ["Adrian wins the whole pool (Paraguay, and only Paraguay, remain)", "+48000"],
              ["Dante rises from 11th — cashes top 3 on Spain alone", "+620"],
              ["Rob bricks it — Under 4.5 pts with England AND France", "+1900"],
              ["Paraguay, slayers of Germany, reach the semifinal", "+2050"],
              ["Hosts with the most — Mexico win the whole thing", "+1350"],
            ]}
          />
          <P>
            An obituary for the old board: "Matt wins the whole pool" is survived by its price of +43000, which was,
            in hindsight, generous. "Kunal goes nuclear — Over 14.5" needed Germany, Brazil and the Netherlands to
            all run deep; Kunal's ceiling is now 12. And "Shaya sweeps the beef" fell when Jake banked point number
            four. The one survivor — Rob bricking it with England AND France — carries over at +1900, and Caleb has
            already texted about it twice.
          </P>
        </Panel>
      </>
    ),
  },
  {
    id: "r16-sosk",
    bookId: "sons-of-steve-kerr",
    bookName: "SOSK SPORTSBOOK",
    date: "2026-07-04",
    eyebrow: "THE HOUSE ORGAN — ROUND OF 16 SPECIAL",
    title: "ARNST BOUGHT THE WHOLE CONTINENT",
    deck: "The opening-day favorite was Burnes. Then his teams started playing soccer. The Round of 16 starts today — the standings, the line moves, a note on Burnes's citizenship status, and a brand-new window at the specials counter for the pool's most reliable customer.",
    body: (
      <>
        <Panel title="THE STORY SO FAR">
          <P>
            Sixteen teams left and Arnst rosters three of them — France, Morocco, and Portugal, which is to say the
            title favorite, the team that just knocked out the Netherlands on penalties, and the team that put five
            on Uzbekistan without breaking stride. The market has noticed: Arnst opened +220 and is now −220, the
            first minus-money favorite in SOSK history. The DKE Civil War panel notes this is an OLD DKE production.
          </P>
          <P>
            Chris leads the actual standings at 8 points and somehow still isn't the favorite — Belgium, Mexico and
            Paraguay are all alive, but the market keeps a polite cough ready for each of them. J Call sits one back
            at 7 with the quietest good draw in the pool: Argentina rolled through its group, Egypt survived
            Australia on penalties, and — hold this thought — they now play each other.
          </P>
          <P>
            The tragedy column belongs to Oanta and Kunal. Oanta's Germany went 7–1, 2–1, then lost to Ecuador and
            got penalty-ed out of the Round of 32 by Paraguay; England alone carries the seat now. Kunal's entire
            tournament is Norway, which sounds bad until you remember Norway just beat Ivory Coast in a knockout
            match, which is more than six of his other teams managed combined. And they have Erling Haaland.
          </P>
        </Panel>

        <Panel title="THE TABLE — 65 POINTS, 16 TEAMS LEFT" blurb="Points bank at each round reached: R32 = 1, R16 = 2, QF = 3, SF = 4, runner-up = 5, champion = 8.">
          <Standings
            rows={[
              [8, "Chris", ["Belgium", "Mexico", "Paraguay"]],
              [7, "J Call", ["Argentina", "Switzerland", "Egypt"]],
              [7, "Arnst", ["Morocco", "Portugal", "France"]],
              [6, "HG", ["Colombia"]],
              [6, "Burnes", ["Canada", "Spain"]],
              [5, "Oanta", ["England"]],
              [5, "Kunal", ["Norway"]],
              [4, "Prozan", ["United States", "Brazil"]],
            ]}
          />
        </Panel>

        <Panel
          title="LINE MOVEMENT — OPENING DAY vs THIS MORNING"
          blurb="Outright (to win the pool), June 11 opening sheet against the July 4 morning line."
        >
          <Lines
            rows={[
              ["Arnst", "+220", "−220", "France, Morocco and Portugal — a third of the remaining field"],
              ["J Call", "+460", "+320", "Three alive, and a guaranteed quarterfinalist (see the slate)"],
              ["Burnes", "+190", "+540", "The opening favorite. The Netherlands and Sweden died in one weekend; Canada and Spain keep the lights on"],
              ["Chris", "+960", "+700", "Leads the pool on points; the market respects it, cautiously"],
              ["Prozan", "+680", "+1500", "Two live teams, four teams that combined for zero knockout appearances"],
              ["Oanta", "+460", "+1950", "Germany's collapse in one line item"],
              ["HG", "+2350", "+4300", "Colombia alone"],
              ["Kunal", "+1150", "+9500", "Norway alone, gallantly"],
            ]}
          />
        </Panel>

        <Panel
          title="THE R16 SLATE — WHO'S PLAYING FOR WHOM"
          blurb="Eight matches, four days, one seat playing itself, and two head-to-head collisions between the same two guys."
        >
          <Fixtures
            rows={[
              ["TODAY, Jul 4", "Paraguay", "Chris", "France", "Arnst", "The pool leader's longshot vs the favorite's flagship"],
              ["TODAY, Jul 4", "Canada", "Burnes", "Morocco", "Arnst", "Burnes vs Arnst, round one"],
              ["Jul 5", "Brazil", "Prozan", "Norway", "Kunal", "Two one-horse... one two-horse seat vs a one-horse seat"],
              ["Jul 5", "Mexico", "Chris", "England", "Oanta", "Oanta's whole tournament vs the hosts"],
              ["Jul 6", "Portugal", "Arnst", "Spain", "Burnes", "Burnes vs Arnst, round two — twice in three days"],
              ["Jul 6", "United States", "Prozan", "Belgium", "Chris", "Prozan's other horse vs the leader's best team"],
              ["Jul 7", "Argentina", "J Call", "Egypt", "J Call", "J Call owns both sides — a guaranteed quarterfinalist"],
              ["Jul 7", "Switzerland", "J Call", "Colombia", "HG", "HG's season in one match"],
            ]}
          />
          <P>
            The schedule-maker has jokes: Burnes and Arnst play each other today (Canada–Morocco) and again on
            Monday (Spain–Portugal). Four teams, two men, six points of separation. Somewhere Steve Kerr is
            diagramming an elevator door play for this exact situation.
          </P>
        </Panel>

        <Panel title="A NOTE ON BURNES'S CITIZENSHIP" blurb="The compliance department was asked to investigate. This is their finding.">
          <P>
            Burnes drafted Canada and would like everyone to know it was random — which is technically true of the
            draw and technically irrelevant to everything since. When Canada put six past Qatar he called it "a
            statement win, eh." When they ground out 1–0 over South Africa in the Round of 32 he described it,
            unprompted, as "playoff hockey." He has apologized to the house twice for winning. The book now
            prices Canada to lift the trophy at +33000, and Burnes says he's "a lifelong Canadian soccer enthusiast." 
            The matter remains under review; today's Canada–Morocco result will be treated as material evidence.
          </P>
        </Panel>

        <Panel
          title="PROZAN'S PARLAY WINDOW — NOW OPEN"
          blurb="Prozan sits last at 4 points, holds two live teams, and has the unshakable conviction that this was all part of the plan. These are the slips he has actually asked for. The house posts them with gratitude. Cash up front — we know him."
        >
          <Slips
            bets={[
              ["Prozan wins the pool (the ladder out of the basement exists)", "+1500"],
              ["Prozan cashes top 3", "+550"],
              ["The Prozan special — USA AND Brazil both reach the quarters", "+160"],
              ["USA win the whole thing", "+2000"],
              ["Canada lift the trophy", "+33000"],
            ]}
          />
          <P>
            For the record: Prozan's USA already beat Paraguay 4–1 and his Brazil hasn't lost a match. There is a
            world where the parlay window pays out and the house has to hear about it until 2030. The house has
            priced that world at +160 and sleeps fine.
          </P>
        </Panel>
      </>
    ),
  },
];
