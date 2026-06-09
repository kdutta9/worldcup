#!/usr/bin/env node
// Add (or update) a scoreboard group from a draft snapshot link.
//
//   npm run add-group -- "<share-link or ?d= payload>"
//
// A snapshot encodes seed + playerCount + groupName + names, which is everything
// needed to reproduce the draw. This decodes it, re-runs the same seeded shuffle,
// writes public/data/groups/<id>.json, and upserts the row into groups.json — the
// browser can't touch repo files, so this is the file-writing half of "Save to
// scoreboard".

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { seededDraw, TEAMS_PER_PLAYER } from "../src/draw.js";
import { decodeSnapshot } from "../src/snapshot.js";
import { slug } from "../src/scoring.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "public", "data");

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) die('Usage: npm run add-group -- "<share-link>"');

// Accept a full URL, a "?d=..." query, or the bare payload.
const payload = arg.includes("d=") ? new URLSearchParams(arg.split("?").pop()).get("d") : arg;
const snap = payload && decodeSnapshot(payload);
if (!snap) die("Couldn't decode a draft snapshot from that argument.");

const name = snap.groupName.trim();
if (!name) die("This snapshot has no group name — re-share the draft with a group name set.");

const id = slug(name);
const teamsPerPlayer = TEAMS_PER_PLAYER[snap.playerCount];
const deck = seededDraw(snap.seed);
const players = snap.names.slice(0, snap.playerCount).map((n, i) => ({
  name: n.trim() || `Player ${i + 1}`,
  teams: deck.slice(i * teamsPerPlayer, (i + 1) * teamsPerPlayer).map((t) => t.name),
}));

const group = { id, name, teamsPerPlayer, seed: snap.seed, playerCount: snap.playerCount, players };

mkdirSync(join(DATA, "groups"), { recursive: true });
writeFileSync(join(DATA, "groups", `${id}.json`), JSON.stringify(group, null, 2) + "\n");

const indexPath = join(DATA, "groups.json");
const index = JSON.parse(readFileSync(indexPath, "utf8"));
const existing = index.find((g) => g.id === id);
if (existing) existing.name = name;
else index.push({ id, name });
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

console.log(`✓ ${existing ? "Updated" : "Added"} "${name}" → data/groups/${id}.json (${players.length} players)`);
console.log(`  View it at /worldcup/?scores=${id} after npm run deploy.`);
