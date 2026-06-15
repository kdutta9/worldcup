// One-command nightly ship. Run after add-results + refresh-book:
//
//   npm run publish
//
// 1. Commits and pushes the source repo — the event log and every derived
//    snapshot/consensus file are the source of truth and must be versioned, not
//    just sitting in the working tree. The commit message lists the actual
//    results added since the last commit (diffed against HEAD's matches.json),
//    e.g. "June 14 results" + "June 14: Germany 7-1 Curaçao, …".
// 2. Runs `npm run deploy`, which builds and pushes the compiled site to the
//    host repo (the live kdutta.com/worldcup).
//
// deploy alone only touches the host repo; this is what keeps the two in sync.

import { execSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: "inherit" });
const capture = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();

const dateLabel = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
const fmtMatch = (m) => `${m.a} ${m.score[0]}-${m.score[1]} ${m.b}${m.pens ? ` (pens: ${m.pens})` : ""}`;

// Results added or corrected vs the committed log, so the message reflects the
// night's actual entries rather than a bare date.
function commitMessage() {
  const cur = JSON.parse(readFileSync(join(ROOT, "public/data/matches.json"), "utf8")).matches ?? [];
  let prev = [];
  try {
    prev = JSON.parse(capture("git show HEAD:public/data/matches.json")).matches ?? [];
  } catch {
    prev = [];
  }
  const prevById = new Map(prev.map((m) => [m.id, m]));
  const changed = cur
    .filter((m) => {
      const p = prevById.get(m.id);
      return !p || p.score[0] !== m.score[0] || p.score[1] !== m.score[1] || p.pens !== m.pens;
    })
    .sort((a, b) => a.id - b.id);

  if (changed.length === 0) return { subject: "Update worldcup data", body: "" };
  const dates = [...new Set(changed.map((m) => m.date))].sort();
  const subject = dates.length === 1 ? `${dateLabel(dates[0])} results` : `Results through ${dateLabel(dates.at(-1))}`;
  const body = dates
    .map((d) => `${dateLabel(d)}: ${changed.filter((m) => m.date === d).map(fmtMatch).join(", ")}.`)
    .join("\n");
  return { subject, body };
}

// 1. Commit + push the source repo, if anything changed.
if (capture("git status --porcelain")) {
  const { subject, body } = commitMessage();
  console.log(`\n→ Committing source data: "${subject}"`);
  if (body) console.log(body);
  run("git add -A");
  execFileSync("git", body ? ["commit", "-m", subject, "-m", body] : ["commit", "-m", subject], {
    cwd: ROOT,
    stdio: "inherit",
  });
  run("git push");
} else {
  console.log("→ Source repo clean — nothing to commit.");
}

// 2. Build + deploy the live site (host repo).
console.log("\n→ Building and deploying the live site…");
run("npm run deploy");

console.log("\n✓ Published — source committed and site deployed.");
