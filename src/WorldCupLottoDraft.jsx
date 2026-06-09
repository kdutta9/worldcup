import { useState, useMemo, useRef, useEffect } from "react";

const TEAMS = [
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
function seededDraw(seedStr) {
  const rng = mulberry32(xmur3(seedStr)());
  const deck = [...TEAMS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function randomSeed() {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => n.toString(16).padStart(8, "0")).join("").slice(0, 12).toUpperCase();
}

const PLAYER_OPTIONS = [8, 12, 16];
// 8 → 6 teams each, 12 → 4 teams each, 16 → 3 teams each
const TEAMS_PER_PLAYER = { 8: 6, 12: 4, 16: 3 };

const CONF_COLOR = {
  UEFA: "#7FB4E0",
  CONMEBOL: "#F0C75E",
  CONCACAF: "#E8806B",
  AFC: "#9ED0A0",
  CAF: "#D9A3E0",
  OFC: "#8EE0D2",
};

// Kept at max capacity; sliced to playerCount on use so names survive mode switches
const MAX_PLAYERS = 16;
const DEFAULT_NAMES = Array.from({ length: MAX_PLAYERS }, (_, i) => `Player ${i + 1}`);

export default function WorldCupLottoDraft() {
  const [phase, setPhase] = useState("setup");
  const [playerCount, setPlayerCount] = useState(12);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [seed, setSeed] = useState(randomSeed);
  const [deck, setDeck] = useState(null);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const timers = useRef([]);

  const teamsPerPlayer = TEAMS_PER_PLAYER[playerCount];

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const assignments = useMemo(() => {
    if (!deck) return [];
    return names.slice(0, playerCount).map((n, i) => ({
      player: n.trim() || `Player ${i + 1}`,
      teams: deck.slice(i * teamsPerPlayer, (i + 1) * teamsPerPlayer),
    }));
  }, [deck, names, playerCount, teamsPerPlayer]);

  const startDraw = () => {
    setDeck(seededDraw(seed));
    setPlayerIdx(0);
    setRevealed(0);
    setPhase("draw");
  };

  const revealCards = () => {
    if (revealing || revealed > 0) return;
    setRevealing(true);
    Array.from({ length: teamsPerPlayer }, (_, k) => k).forEach((k) => {
      timers.current.push(
        setTimeout(() => {
          setRevealed(k + 1);
          if (k === teamsPerPlayer - 1) setRevealing(false);
        }, 350 + k * 750)
      );
    });
  };

  const nextPlayer = () => {
    if (playerIdx >= playerCount - 1) {
      setPhase("board");
    } else {
      setPlayerIdx((p) => p + 1);
      setRevealed(0);
    }
  };

  const copyResults = async () => {
    const text =
      `WORLD CUP LOTTO '26 — OFFICIAL DRAW\nSeed: ${seed}\n\n` +
      assignments.map((a) => `${a.player}: ${a.teams.map((t) => `${t.flag} ${t.name}`).join(", ")}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error(e);
    }
  };

  const current = assignments[playerIdx];

  return (
    <div className="root">
      <style>{css}</style>

      <header className="masthead">
        <div className="crest">⚽</div>
        <h1>WORLD CUP LOTTO '26</h1>
        {phase === "setup" ? (
          <p className="sub">48 TEAMS · ALL ASSIGNED · $20 ENTRY</p>
        ) : (
          <p className="sub">{playerCount} PLAYERS · 48 TEAMS · {teamsPerPlayer} EACH · $20 ENTRY</p>
        )}
      </header>

      {phase === "setup" && (
        <section className="panel">
          <h2 className="panel-title">NUMBER OF PLAYERS</h2>
          <div className="player-select">
            {PLAYER_OPTIONS.map((n) => (
              <button
                key={n}
                className={`player-opt ${playerCount === n ? "active" : ""}`}
                onClick={() => setPlayerCount(n)}
              >
                <span className="player-opt-num">{n}</span>
                <span className="player-opt-sub">{TEAMS_PER_PLAYER[n]} teams each</span>
              </button>
            ))}
          </div>

          <h2 className="panel-title" style={{ marginTop: 32 }}>ENTER THE {playerCount === 8 ? "EIGHT" : playerCount === 12 ? "TWELVE" : "SIXTEEN"}</h2>
          <div className="name-grid">
            {names.slice(0, playerCount).map((n, i) => (
              <label key={i} className="name-field">
                <span className="name-num">{String(i + 1).padStart(2, "0")}</span>
                <input
                  value={n}
                  onChange={(e) => setNames((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  onFocus={(e) => e.target.select()}
                  maxLength={24}
                />
              </label>
            ))}
          </div>

          <div className="seed-row">
            <label className="seed-label">
              DRAW SEED
              <input className="seed-input" value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} />
            </label>
            <button className="ghost-btn" onClick={() => setSeed(randomSeed())}>↻ New seed</button>
          </div>
          <p className="fine">
            The draw is a deterministic function of this seed (xmur3 → mulberry32 → Fisher–Yates).
            Same seed, same result, every time — run it yourself from the source to verify.
          </p>

          <button className="gold-btn" onClick={startDraw}>LOCK IN &amp; BEGIN THE DRAW</button>
        </section>
      )}

      {phase === "draw" && current && (
        <section className="panel draw-stage">
          <div className="draw-progress">DRAW {playerIdx + 1} OF {playerCount}</div>
          <h2 className="on-clock">{current.player}</h2>

          <div className={`cards cards-${teamsPerPlayer}`}>
            {current.teams.map((t, k) => (
              <div key={t.name} className={`card ${k < revealed ? "flipped" : ""}`}>
                <div className="card-inner">
                  <div className="card-face card-back">
                    <span className="back-mark">⚽</span>
                  </div>
                  <div className="card-face card-front">
                    <span className="card-flag">{t.flag}</span>
                    <span className="card-name">{t.name}</span>
                    <span className="card-conf" style={{ color: CONF_COLOR[t.conf] }}>{t.conf}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {revealed === 0 && (
            <button className="gold-btn" onClick={revealCards} disabled={revealing}>
              {revealing ? "DRAWING…" : "REVEAL TEAMS"}
            </button>
          )}
          {revealed === teamsPerPlayer && (
            <button className="gold-btn" onClick={nextPlayer}>
              {playerIdx === playerCount - 1 ? "VIEW FINAL BOARD" : "NEXT PLAYER →"}
            </button>
          )}

          {playerIdx > 0 && (
            <div className="ticker">
              {assignments.slice(0, playerIdx).map((a) => (
                <div key={a.player} className="ticker-row">
                  <span className="ticker-name">{a.player}</span>
                  <span className="ticker-teams">{a.teams.map((t) => t.flag).join(" ")}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {phase === "board" && (
        <section className="panel">
          <h2 className="panel-title">OFFICIAL DRAW RESULTS</h2>
          <div className="board">
            {assignments.map((a, i) => (
              <div key={i} className="board-card">
                <div className="board-player">{a.player}</div>
                {a.teams.map((t) => (
                  <div key={t.name} className="board-team">
                    <span className="bt-flag">{t.flag}</span>
                    <span className="bt-name">{t.name}</span>
                    <span className="bt-conf" style={{ color: CONF_COLOR[t.conf] }}>{t.conf}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="board-footer">
            <button className="ghost-btn" onClick={copyResults}>Copy results for the group chat</button>
            <p className="fine">
              Draw seed <strong>{seed}</strong> — this assignment is fully reproducible from the
              published source code and this seed. No re-draws. Good luck.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;700&display=swap');

.root {
  min-height: 100vh;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0 64px, rgba(255,255,255,0) 64px 128px),
    radial-gradient(120% 90% at 50% 0%, #0E4A30 0%, #07301E 55%, #041F13 100%);
  color: #F2EFE6;
  font-family: 'Archivo', system-ui, sans-serif;
  padding: 32px 16px 64px;
}
.masthead { text-align: center; margin-bottom: 28px; }
.crest { font-size: 28px; margin-bottom: 4px; }
.masthead h1 {
  font-family: 'Anton', Impact, sans-serif;
  font-size: clamp(34px, 7vw, 64px);
  letter-spacing: 0.04em;
  margin: 0;
  color: #F2EFE6;
  text-shadow: 0 2px 0 rgba(0,0,0,0.35);
}
.sub { color: #C9A24B; letter-spacing: 0.28em; font-size: 12px; font-weight: 700; margin-top: 8px; }

.panel { max-width: 960px; margin: 0 auto; }
.panel-title {
  font-family: 'Anton', Impact, sans-serif;
  letter-spacing: 0.08em;
  font-size: 22px;
  color: #C9A24B;
  border-bottom: 1px solid rgba(201,162,75,0.35);
  padding-bottom: 10px;
  margin-bottom: 20px;
}

/* Player count selector */
.player-select {
  display: flex;
  gap: 0;
  border: 1px solid rgba(201,162,75,0.4);
  border-radius: 10px;
  overflow: hidden;
  width: fit-content;
  margin: 0 auto 8px;
}
.player-opt {
  background: transparent;
  color: #C9A24B;
  border: none;
  padding: 14px 36px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  transition: background 0.15s;
}
.player-opt:not(:last-child) { border-right: 1px solid rgba(201,162,75,0.4); }
.player-opt.active { background: linear-gradient(180deg, #E4C46A, #C9A24B); color: #07301E; }
.player-opt:not(.active):hover { background: rgba(201,162,75,0.1); }
.player-opt-num { font-family: 'Anton', sans-serif; font-size: 28px; letter-spacing: 0.05em; line-height: 1; }
.player-opt-sub { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; opacity: 0.8; }

.name-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.name-field {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px; padding: 8px 12px;
}
.name-num { font-family: 'Anton', sans-serif; color: rgba(242,239,230,0.4); font-size: 14px; }
.name-field input {
  background: transparent; border: none; outline: none;
  color: #F2EFE6; font-family: 'Archivo', sans-serif; font-weight: 500;
  font-size: 15px; width: 100%;
}
.name-field:focus-within { border-color: #C9A24B; }

.seed-row { display: flex; align-items: flex-end; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
.seed-label { display: flex; flex-direction: column; gap: 6px; font-size: 11px; letter-spacing: 0.2em; color: #C9A24B; font-weight: 700; }
.seed-input {
  background: rgba(0,0,0,0.3); border: 1px solid rgba(201,162,75,0.4);
  border-radius: 6px; color: #F2EFE6; padding: 10px 12px;
  font-family: ui-monospace, monospace; font-size: 15px; letter-spacing: 0.1em; width: 230px;
}
.fine { color: rgba(242,239,230,0.55); font-size: 13px; line-height: 1.5; margin-top: 12px; max-width: 620px; }

.gold-btn {
  display: block; margin: 28px auto 0;
  font-family: 'Anton', Impact, sans-serif; font-size: 18px; letter-spacing: 0.1em;
  color: #07301E; background: linear-gradient(180deg, #E4C46A, #C9A24B);
  border: none; border-radius: 8px; padding: 14px 36px; cursor: pointer;
  box-shadow: 0 4px 18px rgba(201,162,75,0.35);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.gold-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(201,162,75,0.5); }
.gold-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
.gold-btn:focus-visible, .ghost-btn:focus-visible, .name-field input:focus-visible, .seed-input:focus-visible { outline: 2px solid #E4C46A; outline-offset: 2px; }
.ghost-btn {
  background: transparent; color: #C9A24B; border: 1px solid rgba(201,162,75,0.5);
  border-radius: 6px; padding: 9px 16px; cursor: pointer;
  font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 13px;
}
.ghost-btn:hover { background: rgba(201,162,75,0.12); }

.draw-stage { text-align: center; }
.draw-progress { letter-spacing: 0.3em; font-size: 11px; font-weight: 700; color: rgba(242,239,230,0.5); }
.on-clock {
  font-family: 'Anton', Impact, sans-serif;
  font-size: clamp(30px, 6vw, 52px);
  margin: 6px 0 26px; color: #E4C46A;
  text-shadow: 0 0 32px rgba(228,196,106,0.25);
}

/* Cards layout adapts to count: 3 in a row for 6 cards, 4 in a row for 4, 3 for 3 */
.cards { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; perspective: 1100px; }
.cards-6 { max-width: 540px; margin-left: auto; margin-right: auto; }

.card { width: 158px; height: 212px; }
.card-inner {
  position: relative; width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.65s cubic-bezier(0.4, 0.2, 0.2, 1);
}
.card.flipped .card-inner { transform: rotateY(180deg); }
.card-face {
  position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden;
  border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.card-back {
  background:
    radial-gradient(circle at 50% 42%, rgba(255,255,255,0.08), rgba(255,255,255,0) 55%),
    linear-gradient(160deg, #0B3A26, #062418);
  border: 1px solid rgba(201,162,75,0.55);
}
.back-mark { font-size: 44px; opacity: 0.9; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); }
.card-front {
  background: linear-gradient(180deg, #F7F4EC, #EAE5D6);
  border: 1px solid #C9A24B;
  transform: rotateY(180deg);
  color: #14281D; gap: 8px; padding: 12px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.35);
}
.card-flag { font-size: 52px; line-height: 1; }
.card-name {
  font-family: 'Anton', Impact, sans-serif; font-size: 17px; letter-spacing: 0.03em;
  text-align: center; line-height: 1.15;
}
.card-conf { font-size: 10px; font-weight: 700; letter-spacing: 0.24em; }

.ticker { margin-top: 34px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 14px; max-width: 560px; margin-left: auto; margin-right: auto; }
.ticker-row { display: flex; justify-content: space-between; padding: 5px 4px; font-size: 14px; }
.ticker-name { color: rgba(242,239,230,0.75); font-weight: 500; }
.ticker-teams { letter-spacing: 0.12em; }

.board { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }
.board-card {
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 14px 16px;
}
.board-player {
  font-family: 'Anton', Impact, sans-serif; font-size: 19px; letter-spacing: 0.04em;
  color: #E4C46A; margin-bottom: 10px;
  border-bottom: 1px solid rgba(201,162,75,0.3); padding-bottom: 8px;
}
.board-team { display: flex; align-items: center; gap: 9px; padding: 5px 0; font-size: 15px; }
.bt-flag { font-size: 19px; }
.bt-name { flex: 1; font-weight: 500; }
.bt-conf { font-size: 9px; font-weight: 700; letter-spacing: 0.2em; }
.board-footer { text-align: center; margin-top: 26px; }
.board-footer .fine { margin: 14px auto 0; }

@media (max-width: 540px) {
  .card { width: calc(50% - 8px); max-width: 160px; height: 196px; }
  .player-opt { padding: 12px 22px; }
}
@media (prefers-reduced-motion: reduce) {
  .card-inner { transition: none; }
  .gold-btn { transition: none; }
}
`;
