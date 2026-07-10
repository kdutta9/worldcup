// Sticky "back to scoreboard" bar for the sportsbook/house-organ pages, which
// use their own near-black theme and skip the Masthead nav entirely.
export default function BackHome() {
  return (
    <div className="bk-backbar">
      <a className="bk-back" href="./">← Home</a>
    </div>
  );
}
