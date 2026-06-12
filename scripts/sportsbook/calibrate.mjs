// Fit team ratings so that simulated championship probabilities reproduce the
// devigged market consensus. Multiplicative-weights update on log-probabilities:
//   R += η · (ln target − ln simulated)
// with the simulated probs smoothed so longshots with zero sampled titles still
// get a gradient. Writes ratings.json next to this script (committed, so book
// builds are reproducible without refitting).
//
// Usage: node scripts/sportsbook/calibrate.mjs [iterations] [simsPerIter]

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TEAM_NAMES, targetTitleProbs, STAGE } from "./data.mjs";
import { simulateTournament, mulberry32 } from "./engine.mjs";

const ITERS = Number(process.argv[2] ?? 30);
const SIMS = Number(process.argv[3] ?? 60000);

const target = targetTitleProbs();
const n = TEAM_NAMES.length;

// Warm start: ratings proportional to log-odds of the target spreads convergence.
let ratings = target.map((p) => 0.55 * Math.log(p / (1 / n)));
const mean = ratings.reduce((a, b) => a + b, 0) / n;
ratings = ratings.map((r) => r - mean);

const stages = new Uint8Array(n);

function simulatedTitleProbs(ratings, sims, seed) {
  const rng = mulberry32(seed);
  const titles = new Float64Array(n);
  for (let s = 0; s < sims; s++) {
    simulateTournament(ratings, rng, stages);
    for (let t = 0; t < n; t++) if (stages[t] === STAGE.CHAMPION) titles[t]++;
  }
  // Laplace smoothing keeps log-gradients finite for unsampled longshots.
  return Array.from(titles, (c) => (c + 0.5) / (sims + n * 0.5));
}

for (let it = 0; it < ITERS; it++) {
  const eta = it < 10 ? 0.5 : it < 20 ? 0.3 : 0.15;
  const sim = simulatedTitleProbs(ratings, SIMS, 1000 + it);
  let err = 0;
  for (let t = 0; t < n; t++) {
    const g = Math.log(target[t]) - Math.log(sim[t]);
    err += Math.abs(g) * target[t];
    ratings[t] += eta * g;
  }
  const m = ratings.reduce((a, b) => a + b, 0) / n;
  ratings = ratings.map((r) => r - m);
  console.log(`iter ${String(it + 1).padStart(2)}  weighted |Δlog| = ${err.toFixed(4)}`);
}

// Report fit quality on a bigger validation run.
const sim = simulatedTitleProbs(ratings, 200000, 777);
const rows = TEAM_NAMES.map((name, t) => ({ name, target: target[t], sim: sim[t], r: ratings[t] }))
  .sort((a, b) => b.target - a.target);
console.log("\n  team                      target     sim   rating");
for (const r of rows) {
  console.log(
    `  ${r.name.padEnd(24)} ${(r.target * 100).toFixed(2).padStart(6)}% ${(r.sim * 100)
      .toFixed(2)
      .padStart(6)}%  ${r.r.toFixed(3).padStart(7)}`
  );
}

const out = Object.fromEntries(TEAM_NAMES.map((name, t) => [name, Number(ratings[t].toFixed(4))]));
const path = join(dirname(fileURLToPath(import.meta.url)), "ratings.json");
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote ${path}`);
