import { TEAM_BY_NAME } from "./draw";

// The house organ: hand-written editorial, one post per occasion. Numbers are
// copied from the committed book snapshots they cite (open and 2026-07-04) —
// history is immutable, so the copy carries its own facts rather than joining
// against data files at runtime. Rendered by Post.jsx via ?post=<id>.

const Panel = ({ title, blurb, children }) => (
  <section className="bk-panel">
    <h2 className="bk-panel-title">{title}</h2>
    {blurb && <p className="bk-blurb">{blurb}</p>}
    {children}
  </section>
);

const P = ({ children }) => <p className="post-p">{children}</p>;

const flag = (t) => TEAM_BY_NAME[t]?.flag ?? "🏳️";

// [pts, seat, alive-teams[]]
const Standings = ({ rows }) => (
  <table className="bk-table">
    <thead>
      <tr><th>PTS</th><th>SEAT</th><th>STILL ALIVE</th></tr>
    </thead>
    <tbody>
      {rows.map(([pts, name, alive]) => (
        <tr key={name}>
          <td>{pts}</td>
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
            {flag(a)} {a} <span className="post-vs">vs</span> {flag(b)} {b}
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

export const POSTS = [
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
