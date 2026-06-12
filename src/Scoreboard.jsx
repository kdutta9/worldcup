import { useState, useEffect } from "react";
import { TEAM_BY_NAME } from "./draw";
import { computeStandings, STAGE_LABEL, loadResults, loadGroup, loadGroupsIndex } from "./scoring";

// `?scores` → landing list of groups. `?scores=boofy` → that group's standings.
export default function Scoreboard({ groupId }) {
  if (groupId) return <GroupStandings groupId={groupId} />;
  return <GroupList />;
}

function useAsync(fn, deps) {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let live = true;
    setState({ status: "loading", data: null });
    fn()
      .then((data) => live && setState({ status: "ok", data }))
      .catch(() => live && setState({ status: "error", data: null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function GroupList() {
  const { status, data } = useAsync(loadGroupsIndex, []);

  return (
    <section className="panel">
      <h2 className="panel-title">SCOREBOARDS</h2>
      {status === "loading" && <p className="state-msg">Loading groups…</p>}
      {status === "error" && <p className="state-msg">Couldn't load groups.</p>}
      {status === "ok" && (
        <div className="group-list">
          {data.map((g) => (
            <a key={g.id} className="group-link" href={`?scores=${g.id}`}>
              <div className="gl-name">{g.name}</div>
              <div className="gl-meta">View standings →</div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function GroupStandings({ groupId }) {
  const { status, data } = useAsync(
    () => Promise.all([loadGroup(groupId), loadResults()]),
    [groupId]
  );

  if (status === "loading") return <Panel title="STANDINGS"><p className="state-msg">Loading standings…</p></Panel>;
  if (status === "error") return <Panel title="STANDINGS"><p className="state-msg">Couldn't load this group.</p></Panel>;

  const [group, results] = data;
  const stages = results.stages || {};
  const rows = computeStandings(group, stages);

  return (
    <Panel title={`${group.name.toUpperCase()} — STANDINGS`}>
      <div className="standings">
        {rows.map((row) => (
          <div key={row.player} className={`stand-row ${row.rank === 1 ? "lead" : ""}`}>
            <div className="stand-head">
              <span className="stand-rank">{row.rank}</span>
              <span className="stand-player">{row.player}</span>
              <span className="stand-total">
                {row.total}
                <small>PTS</small>
              </span>
            </div>
            <div className="stand-teams">
              {row.teams.map((t) => {
                const meta = TEAM_BY_NAME[t.name];
                return (
                  <span key={t.name} className={`stand-team ${t.stage === "GROUP" ? "out" : ""}`}>
                    <span className="st-flag">{meta ? meta.flag : "🏳️"}</span>
                    <span>{t.name}</span>
                    <span className="st-stage">{STAGE_LABEL[t.stage]}</span>
                    <span className="st-pts">{t.points}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="fine" style={{ margin: "20px auto 0" }}>
        Points are scored per team by furthest round reached: Round of 32 = 1, R16 = 2, QF = 3,
        SF = 4, Runner-up = 5, Champion = 8. Last updated {results.updatedAt || "—"}.
      </p>
      <div className="btn-row" style={{ marginTop: 18 }}>
        <a className="ghost-btn" href={`?book=${groupId}`}>Sportsbook: pre-tournament odds →</a>
      </div>
    </Panel>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      {children}
    </section>
  );
}
