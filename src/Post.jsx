import { useEffect } from "react";
import { POSTS } from "./posts";

// `?post=<id>` → one house-organ post, dressed like the sportsbook sheets.
// `?post` → the archive. Content lives in posts.jsx; this view only frames it.

export default function Post({ postId }) {
  const post = postId ? POSTS.find((p) => p.id === postId) : null;
  useEffect(() => {
    document.title = post ? `${post.title} · World Cup Lotto '26` : "The House Organ · World Cup Lotto '26";
  }, [post]);

  if (postId && !post)
    return (
      <div className="book-root">
        <div className="book-wrap">
          <p className="state-msg">
            No such post. <a className="bk-link" href="?post">Back to the archive</a>
          </p>
        </div>
      </div>
    );

  return (
    <div className="book-root">
      <div className="book-wrap post-wrap">{post ? <Article post={post} /> : <Archive />}</div>
    </div>
  );
}

function Archive() {
  return (
    <>
      <header className="bk-head">
        <p className="bk-eyebrow">THE HOUSE ORGAN</p>
        <h1 className="bk-title">FROM THE DESK OF THE BOOK</h1>
        <p className="bk-sub">All the lines that are fit to print</p>
      </header>
      <div className="group-list" style={{ marginTop: 28 }}>
        {POSTS.map((p) => (
          <a key={p.id} className="group-link" href={`?post=${p.id}`}>
            <div className="gl-name">{p.title}</div>
            <div className="gl-meta">
              {p.bookName} · {p.date} · Read →
            </div>
          </a>
        ))}
      </div>
    </>
  );
}

function Article({ post }) {
  return (
    <>
      <header className="bk-head">
        <p className="bk-eyebrow">{post.eyebrow}</p>
        <h1 className="bk-title">{post.title}</h1>
        <p className="bk-sub">
          {post.bookName} · From the desk of the book · {post.date}
        </p>
        <p className="post-deck">{post.deck}</p>
      </header>

      {post.body}

      <footer className="bk-fine-block">
        <p className="bk-fine">
          <b>SOURCING.</b> Every price quoted is from the committed book sheets — the June 11 opening lines and the
          July 4 morning line — generated from 400,000 simulated tournaments calibrated to the devigged title-market
          consensus. From tonight's repricing onward the consensus blends Kalshi, Polymarket, and the sportsbook
          boards (DraftKings et al.). Standings per the official World Cup Lotto '26 scoring. For entertainment only;
          no real bets, no real money, no refunds.
        </p>
        <p className="bk-foot">{post.bookName} · EST. JUNE 2026 · NO REFUNDS</p>
        <p className="bk-foot-nav">
          <a className="bk-link" href={`?book=${post.bookId}`}>The live book</a> ·{" "}
          <a className="bk-link" href={`?scores=${post.bookId}`}>Live standings</a> ·{" "}
          <a className="bk-link" href="?post">More from the desk</a>
        </p>
      </footer>
    </>
  );
}
