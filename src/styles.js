// One stylesheet for the whole app, injected once by App. Class names are shared
// across the draft tool, the snapshot board, and the scoreboard.
export const css = `
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

/* Top nav */
.topnav { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
.topnav a {
  color: #C9A24B; text-decoration: none; font-weight: 700; font-size: 12px;
  letter-spacing: 0.12em; text-transform: uppercase;
  border: 1px solid rgba(201,162,75,0.4); border-radius: 6px; padding: 7px 14px;
}
.topnav a:hover { background: rgba(201,162,75,0.12); }
.topnav a.active { background: linear-gradient(180deg, #E4C46A, #C9A24B); color: #07301E; border-color: transparent; }

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

.field-label { display: block; font-size: 11px; letter-spacing: 0.2em; color: #C9A24B; font-weight: 700; margin-bottom: 6px; }
.text-input {
  background: rgba(0,0,0,0.3); border: 1px solid rgba(201,162,75,0.4);
  border-radius: 6px; color: #F2EFE6; padding: 10px 12px;
  font-family: 'Archivo', sans-serif; font-size: 15px; width: 100%; max-width: 340px;
}
.text-input:focus-visible { outline: 2px solid #E4C46A; outline-offset: 2px; }

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
.btn-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

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
.board-group { text-align: center; font-family: 'Anton', sans-serif; color: #E4C46A; font-size: 20px; letter-spacing: 0.06em; margin-bottom: 14px; }

/* Shared-draft banner on a snapshot board */
.snap-banner {
  text-align: center; background: rgba(201,162,75,0.1);
  border: 1px solid rgba(201,162,75,0.3); border-radius: 8px;
  padding: 10px 14px; margin-bottom: 18px; font-size: 13px; color: rgba(242,239,230,0.8);
}

/* Copyable share / export box */
.copybox {
  display: flex; gap: 8px; align-items: center; justify-content: center;
  flex-wrap: wrap; margin: 16px auto 0; max-width: 640px;
}
.copybox code {
  flex: 1; min-width: 220px; background: rgba(0,0,0,0.3);
  border: 1px solid rgba(201,162,75,0.3); border-radius: 6px; padding: 9px 12px;
  font-family: ui-monospace, monospace; font-size: 12px; color: rgba(242,239,230,0.8);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Scoreboard */
.group-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.group-link {
  display: block; text-decoration: none; color: #F2EFE6;
  background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 20px; transition: border-color 0.15s, background 0.15s;
}
.group-link:hover { border-color: #C9A24B; background: rgba(201,162,75,0.08); }
.group-link .gl-name { font-family: 'Anton', sans-serif; font-size: 24px; color: #E4C46A; letter-spacing: 0.04em; }
.group-link .gl-meta { font-size: 12px; color: rgba(242,239,230,0.6); margin-top: 4px; }

.standings { display: flex; flex-direction: column; gap: 10px; }
.stand-row {
  background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 14px 16px;
}
.stand-row.lead { border-color: rgba(201,162,75,0.6); background: rgba(201,162,75,0.08); }
.stand-head { display: flex; align-items: center; gap: 12px; }
.stand-rank {
  font-family: 'Anton', sans-serif; font-size: 22px; color: rgba(242,239,230,0.5);
  width: 38px; text-align: center; flex-shrink: 0;
}
.stand-row.lead .stand-rank { color: #E4C46A; }
.stand-player { font-family: 'Anton', sans-serif; font-size: 20px; letter-spacing: 0.03em; color: #F2EFE6; flex: 1; }
.stand-total { font-family: 'Anton', sans-serif; font-size: 26px; color: #E4C46A; }
.stand-total small { font-family: 'Archivo', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; color: rgba(242,239,230,0.5); margin-left: 6px; }
.stand-teams { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.stand-team {
  display: flex; align-items: center; gap: 7px; font-size: 13px;
  background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px; padding: 5px 11px;
}
.stand-team.out { opacity: 0.45; }
.stand-team .st-flag { font-size: 15px; }
.stand-team .st-stage { color: rgba(242,239,230,0.55); font-size: 11px; }
.stand-team .st-pts { font-weight: 700; color: #E4C46A; }

.state-msg { text-align: center; color: rgba(242,239,230,0.6); padding: 40px 0; font-size: 15px; }

/* Sportsbook sheet — its own near-black casino look, distinct from the green felt */
.book-root {
  min-height: 100vh;
  background:
    radial-gradient(110% 70% at 50% 0%, rgba(201,162,75,0.08) 0%, rgba(201,162,75,0) 55%),
    #0B0B0E;
  color: #EDE8DA;
  font-family: 'Archivo', system-ui, sans-serif;
  padding: 36px 14px 64px;
}
.book-wrap { max-width: 980px; margin: 0 auto; }
.bk-head { text-align: center; }
.bk-eyebrow { letter-spacing: 0.55em; font-size: 10px; font-weight: 700; color: #C9A24B; margin: 0 0 10px; }
.bk-title {
  font-family: 'Anton', Impact, sans-serif;
  font-size: clamp(38px, 7vw, 64px);
  letter-spacing: 0.05em; margin: 0; color: #EDE8DA;
}
.bk-sub { color: rgba(237,232,218,0.55); font-size: 13px; margin: 8px 0 0; }
.bk-sub code { color: #C9A24B; font-size: 12px; }
.bk-chips { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.bk-chip {
  border: 1px solid rgba(201,162,75,0.35); border-radius: 999px;
  padding: 6px 14px; font-size: 12px; color: rgba(237,232,218,0.75);
}
.bk-chip b { color: #E4C46A; }
.bk-banner {
  width: fit-content; margin: 18px auto 0;
  background: linear-gradient(180deg, #E4C46A, #C9A24B); color: #14110A;
  letter-spacing: 0.22em; font-size: 11px; font-weight: 700;
  padding: 8px 18px; border-radius: 6px;
}
.bk-panel {
  background: #131318; border: 1px solid #26262E; border-radius: 12px;
  padding: 20px 22px; margin-top: 22px;
}
.bk-panel-title {
  font-size: 14px; font-weight: 700; letter-spacing: 0.32em;
  color: #C9A24B; margin: 0 0 6px;
  border-bottom: 1px solid rgba(201,162,75,0.25); padding-bottom: 10px;
}
.bk-blurb { color: rgba(237,232,218,0.55); font-size: 12.5px; line-height: 1.55; margin: 10px 0 6px; }
.bk-rows { display: flex; flex-direction: column; }
.bk-row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 10px 2px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.bk-row:last-child { border-bottom: none; }
.bk-row-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.bk-player { font-family: 'Anton', sans-serif; font-size: 17px; letter-spacing: 0.04em; }
.bk-teamline { color: rgba(237,232,218,0.6); font-size: 12px; line-height: 1.5; }
.bk-flags { font-size: 16px; letter-spacing: 2px; }
.bk-price {
  font-family: 'Anton', sans-serif; font-size: 17px; color: #E4C46A;
  background: rgba(201,162,75,0.08); border: 1px solid rgba(201,162,75,0.28);
  border-radius: 8px; padding: 6px 13px; min-width: 78px; text-align: center;
  flex-shrink: 0; white-space: nowrap;
}
.bk-price.sm { font-size: 13px; }
.bk-tag {
  font-family: 'Archivo', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em;
  border-radius: 4px; padding: 3px 7px; margin-left: 9px; vertical-align: 2px;
}
.bk-tag.fav { background: rgba(201,162,75,0.18); color: #E4C46A; }
.bk-tag.dog { background: rgba(232,128,107,0.15); color: #E8806B; }
.bk-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.bk-grid2 .bk-panel { margin-top: 22px; }
.bk-h2h-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
.bk-h2h {
  border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px;
  background: rgba(0,0,0,0.25);
}
.bk-h2h-side { display: flex; justify-content: space-between; align-items: center; font-family: 'Anton', sans-serif; font-size: 16px; padding: 4px 0; }
.bk-h2h-vs { text-align: center; color: rgba(237,232,218,0.35); font-size: 10px; letter-spacing: 0.3em; padding: 2px 0; }
.bk-vs-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 18px; align-items: start; margin-top: 12px; }
.bk-vs {
  align-self: center; font-family: 'Anton', sans-serif; font-size: 22px; color: rgba(201,162,75,0.7);
}
.bk-side { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px 16px; }
.bk-side-name { font-family: 'Anton', sans-serif; font-size: 19px; letter-spacing: 0.08em; color: #E4C46A; margin: 0 0 8px; }
.bk-side-player { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; color: rgba(237,232,218,0.85); }
.bk-side-lines { margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px; }
.bk-line { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
.bk-line.dim { color: rgba(237,232,218,0.5); }
.bk-mainline { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 10px; }
.bk-mainline .bk-line {
  flex: 1; min-width: 200px; border: 1px solid rgba(201,162,75,0.3); border-radius: 10px;
  padding: 10px 14px; background: rgba(201,162,75,0.05); font-size: 15px;
}
.bk-subhead { letter-spacing: 0.28em; font-size: 11px; color: rgba(237,232,218,0.5); margin: 22px 0 8px; }
.bk-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bk-table th {
  text-align: left; font-size: 10px; letter-spacing: 0.18em; color: rgba(201,162,75,0.8);
  padding: 6px 8px; border-bottom: 1px solid rgba(201,162,75,0.25);
}
.bk-table td { padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); color: rgba(237,232,218,0.85); }
.bk-table .bk-td-team { font-weight: 500; color: #EDE8DA; }
.bk-table.ladder { max-width: 420px; }
.bk-table.ladder tr.main td { color: #E4C46A; font-weight: 700; }
.bk-hist { display: flex; align-items: flex-end; gap: 3px; height: 130px; margin-top: 26px; }
.bk-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 0; }
.bk-bar { width: 100%; background: linear-gradient(180deg, #E4C46A, #8A6E2F); border-radius: 3px 3px 0 0; min-height: 1px; }
.bk-bar-pct { font-size: 9px; color: rgba(237,232,218,0.45); margin-bottom: 3px; }
.bk-bar-label { font-size: 10px; color: rgba(237,232,218,0.55); margin-top: 5px; }
.bk-hist-caption { text-align: center; color: rgba(237,232,218,0.45); font-size: 11px; margin-top: 10px; }
.bk-roster { margin-top: 18px; }
.bk-roster-head { font-family: 'Anton', sans-serif; font-size: 16px; letter-spacing: 0.04em; color: #E4C46A; margin: 0 0 8px; }
.bk-caleb-label { font-size: 13.5px; color: rgba(237,232,218,0.85); line-height: 1.4; }
.bk-fine-block { margin-top: 26px; }
.bk-fine { color: rgba(237,232,218,0.45); font-size: 11px; line-height: 1.65; margin: 10px 0; }
.bk-fine b { color: rgba(237,232,218,0.65); }
.bk-foot { text-align: center; letter-spacing: 0.3em; font-size: 10px; color: rgba(201,162,75,0.7); margin-top: 26px; }
.bk-foot-nav { text-align: center; font-size: 12px; margin-top: 10px; }
.bk-link { color: #C9A24B; }

/* Snapshot navigation (prev / date dropdown / next) */
.bk-nav { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px; }
.bk-nav-btn {
  background: transparent; color: #C9A24B; border: 1px solid rgba(201,162,75,0.5);
  border-radius: 6px; padding: 8px 14px; cursor: pointer;
  font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.12em;
}
.bk-nav-btn:hover:not(:disabled) { background: rgba(201,162,75,0.12); }
.bk-nav-btn:disabled { opacity: 0.35; cursor: default; }
.bk-nav-select {
  background: rgba(0,0,0,0.4); color: #E4C46A; border: 1px solid rgba(201,162,75,0.5);
  border-radius: 6px; padding: 8px 12px; cursor: pointer;
  font-family: 'Archivo', sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 0.1em;
}
.bk-nav-btn:focus-visible, .bk-nav-select:focus-visible { outline: 2px solid #E4C46A; outline-offset: 2px; }

/* Line movement vs the previous sheet */
.bk-move { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; margin-top: 2px; white-space: nowrap; }
.bk-move.up { color: #7FE3A8; }
.bk-move.down { color: #E8806B; }
.bk-line-right { display: inline-flex; align-items: center; gap: 9px; }
.bk-tick { font-size: 9px; }
.bk-tick.up { color: #7FE3A8; }
.bk-tick.down { color: #E8806B; }

/* Settled markets (clinched / eliminated) come off the board */
.bk-price.bk-settled { font-family: 'Archivo', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; }
.bk-settled.locked { color: #7FE3A8; border-color: rgba(127,227,168,0.35); background: rgba(127,227,168,0.08); }
.bk-settled.dead { color: rgba(237,232,218,0.4); border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); }

/* Line movement chart */
.bk-chart { width: 100%; height: auto; margin-top: 12px; display: block; }
.bk-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; }
.bk-leg { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: rgba(237,232,218,0.75); }
.bk-leg b { color: #E4C46A; font-weight: 700; }
.bk-leg-swatch { width: 10px; height: 3px; border-radius: 2px; display: inline-block; }

@media (max-width: 760px) {
  .bk-grid2 { grid-template-columns: 1fr; }
  .bk-h2h-grid { grid-template-columns: 1fr; }
  .bk-vs-grid { grid-template-columns: 1fr; }
  .bk-vs { justify-self: center; }
  .bk-bar-pct { display: none; }
  .bk-bar-label { font-size: 8px; }
  .bk-table { font-size: 11px; }
  .bk-table th, .bk-table td { padding: 5px 4px; }
}

@media (max-width: 540px) {
  .card { width: calc(50% - 8px); max-width: 160px; height: 196px; }
  .player-opt { padding: 12px 22px; }
}
@media (prefers-reduced-motion: reduce) {
  .card-inner { transition: none; }
  .gold-btn { transition: none; }
}
`;
