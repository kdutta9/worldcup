import WorldCupLottoDraft from "./WorldCupLottoDraft";
import Scoreboard from "./Scoreboard";
import Masthead from "./Masthead";
import { decodeSnapshot } from "./snapshot";
import { css } from "./styles";

// Query-param routing (no router dep, refresh-safe on static hosting):
//   ?d=<payload>   → shared snapshot board
//   ?scores        → scoreboard landing
//   ?scores=<id>   → that group's standings
//   (none)         → draft tool
export default function App() {
  const params = new URLSearchParams(window.location.search);

  let view;
  if (params.has("d")) {
    const snapshot = decodeSnapshot(params.get("d"));
    view = snapshot ? (
      <WorldCupLottoDraft snapshot={snapshot} />
    ) : (
      <div className="root">
        <Masthead sub="" active="draft" />
        <p className="state-msg">That share link is invalid or corrupted.</p>
      </div>
    );
  } else if (params.has("scores")) {
    view = (
      <div className="root">
        <Masthead sub="LIVE STANDINGS" active="scores" />
        <Scoreboard groupId={params.get("scores")} />
      </div>
    );
  } else {
    view = <WorldCupLottoDraft />;
  }

  return (
    <>
      <style>{css}</style>
      {view}
    </>
  );
}
