// One-command nightly ship. Run after add-results + refresh-book:
//
//   npm run publish
//
// 1. Commits and pushes the source repo — the event log and every derived
//    snapshot/consensus file are the source of truth and must be versioned, not
//    just sitting in the working tree. The commit message is derived from the
//    latest match date in the log ("Results through June 14").
// 2. Runs `npm run deploy`, which builds and pushes the compiled site to the
//    host repo (the live kdutta.com/worldcup).
//
// deploy alone only touches the host repo; this is what keeps the two in sync.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: "inherit" });
const capture = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();

// 1. Commit + push the source repo, if anything changed.
if (capture("git status --porcelain")) {
  const matches = JSON.parse(readFileSync(join(ROOT, "public/data/matches.json"), "utf8")).matches ?? [];
  const latest = matches.reduce((d, m) => (m.date > d ? m.date : d), "");
  const label = latest
    ? new Date(`${latest}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;
  const msg = label ? `Results through ${label}` : "Update worldcup data";
  console.log(`\n→ Committing source data: "${msg}"`);
  run("git add -A");
  run(`git commit -m ${JSON.stringify(msg)}`);
  run("git push");
} else {
  console.log("→ Source repo clean — nothing to commit.");
}

// 2. Build + deploy the live site (host repo).
console.log("\n→ Building and deploying the live site…");
run("npm run deploy");

console.log("\n✓ Published — source committed and site deployed.");
