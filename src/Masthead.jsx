// Shared header + nav. `active` is "scores", "book", "post", or "draft"; links
// are relative so the base path (/worldcup/) is preserved on static hosting.
export default function Masthead({ sub, active }) {
  return (
    <header className="masthead">
      <div className="crest">⚽</div>
      <h1>WORLD CUP LOTTO '26</h1>
      {sub && <p className="sub">{sub}</p>}
      <nav className="topnav">
        <a className={active === "scores" ? "active" : ""} href="./">Scoreboards</a>
        <a className={active === "book" ? "active" : ""} href="?book">Sportsbook</a>
        <a className={active === "post" ? "active" : ""} href="?post">Posts</a>
        <a className={active === "draft" ? "active" : ""} href="?draft">New Draft</a>
      </nav>
    </header>
  );
}
