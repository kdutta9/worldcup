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
