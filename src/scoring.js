// Scoring: a team earns points for the furthest round it reaches. Stage is the
// source of truth (auditable, monotonic as the tournament runs); points are derived
// from this one map. A player's score is the sum of their four teams.

export { STAGE_POINTS, STAGE_LABEL, pointsForStage, computeStandings, slug } from "./scoring-core.js";

// --- Data access seam --------------------------------------------------------
// Today these read committed JSON. To go real-time later, swap the bodies for
// Supabase queries (same return shapes) and add a realtime subscription; nothing
// in the views changes.
const DATA = `${import.meta.env?.BASE_URL ?? "/"}data/`;

export const loadResults = () => fetch(`${DATA}results.json`).then((r) => r.json());
export const loadGroupsIndex = () => fetch(`${DATA}groups.json`).then((r) => r.json());
export const loadGroup = (id) => fetch(`${DATA}groups/${id}.json`).then((r) => r.json());
