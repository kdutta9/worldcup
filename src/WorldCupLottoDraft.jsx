import { useState, useMemo, useRef, useEffect } from "react";
import {
  CONF_COLOR,
  PLAYER_OPTIONS,
  TEAMS_PER_PLAYER,
  MAX_PLAYERS,
  DEFAULT_NAMES,
  seededDraw,
  randomSeed,
} from "./draw";
import { snapshotUrl } from "./snapshot";
import Masthead from "./Masthead";

function padNames(ns) {
  return [...ns, ...DEFAULT_NAMES.slice(ns.length)].slice(0, MAX_PLAYERS);
}

// `snapshot` (decoded from ?d=) makes this a read-only shared board: same seed,
// same draw, jumped straight to the results.
export default function WorldCupLottoDraft({ snapshot = null }) {
  const isSnapshot = !!snapshot;
  const [phase, setPhase] = useState(isSnapshot ? "board" : "setup");
  const [playerCount, setPlayerCount] = useState(snapshot?.playerCount ?? 12);
  const [names, setNames] = useState(snapshot ? padNames(snapshot.names) : DEFAULT_NAMES);
  const [groupName, setGroupName] = useState(snapshot?.groupName ?? "");
  const [seed, setSeed] = useState(snapshot?.seed ?? randomSeed);
  const [deck, setDeck] = useState(() => (snapshot ? seededDraw(snapshot.seed) : null));
  const [playerIdx, setPlayerIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [toast, setToast] = useState("");
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

  const replayDraw = () => {
    setPlayerIdx(0);
    setRevealed(0);
    setPhase("draw");
  };

  const flashToast = (msg) => {
    setToast(msg);
    timers.current.push(setTimeout(() => setToast(""), 2200));
  };

  const copyText = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      flashToast(msg);
    } catch (e) {
      console.error(e);
      flashToast("Copy failed — check clipboard permissions");
    }
  };

  const groupLabel = groupName.trim();

  const copyResults = () =>
    copyText(
      `WORLD CUP LOTTO '26 — OFFICIAL DRAW${groupLabel ? ` (${groupLabel})` : ""}\nSeed: ${seed}\n\n` +
        assignments.map((a) => `${a.player}: ${a.teams.map((t) => `${t.flag} ${t.name}`).join(", ")}`).join("\n"),
      "Results copied"
    );

  const copyShareLink = () =>
    copyText(snapshotUrl({ seed, playerCount, groupName: groupLabel, names }), "Share link copied");

  const saveToScoreboard = () => {
    if (!groupLabel) {
      flashToast("Set a group name first");
      return;
    }
    const cmd = `npm run add-group -- "${snapshotUrl({ seed, playerCount, groupName: groupLabel, names })}"`;
    copyText(cmd, "Command copied — paste in your terminal to add this group");
  };

  const current = assignments[playerIdx];

  const sub =
    phase === "setup"
      ? "48 TEAMS · ALL ASSIGNED"
      : `${playerCount} PLAYERS · 48 TEAMS · ${teamsPerPlayer} EACH`;

  return (
    <div className="root">
      <Masthead sub={sub} active="draft" />

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

          <h2 className="panel-title" style={{ marginTop: 32 }}>GROUP NAME</h2>
          <input
            className="text-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. The Barden Bellas"
            maxLength={32}
          />

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
          {isSnapshot && (
            <div className="snap-banner">
              You're viewing a shared draft. It's reproduced from the seed below — verify it yourself from the source.
            </div>
          )}
          <h2 className="panel-title">OFFICIAL DRAW RESULTS</h2>
          {groupLabel && <div className="board-group">{groupLabel}</div>}
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
            <div className="btn-row">
              <button className="ghost-btn" onClick={copyResults}>Copy results</button>
              <button className="ghost-btn" onClick={copyShareLink}>Copy share link</button>
              {isSnapshot ? (
                <>
                  <button className="ghost-btn" onClick={replayDraw}>Replay the draw</button>
                  <a className="ghost-btn" href="./" style={{ textDecoration: "none" }}>Start your own</a>
                </>
              ) : (
                <button className="ghost-btn" onClick={saveToScoreboard}>Save to scoreboard</button>
              )}
            </div>
            {toast && <p className="fine" style={{ margin: "12px auto 0", color: "#E4C46A" }}>{toast}</p>}
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
