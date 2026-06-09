// Shared header + nav. `active` is "draft" or "scores"; links are relative so the
// base path (/worldcup/) is preserved on static hosting.
export default function Masthead({ sub, active }) {
  return (
    <header className="masthead">
      <div className="crest">⚽</div>
      <h1>WORLD CUP LOTTO '26</h1>
      {sub && <p className="sub">{sub}</p>}
      <nav className="topnav">
        <a className={active === "draft" ? "active" : ""} href="./">New Draft</a>
        <a className={active === "scores" ? "active" : ""} href="?scores">Scoreboards</a>
      </nav>
    </header>
  );
}
