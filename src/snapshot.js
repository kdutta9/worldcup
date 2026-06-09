// A draft snapshot is the whole board encoded into one URL param. The board is a
// pure function of (seed, playerCount, names), so those three plus the group name
// are all we need. Payload → JSON → UTF-8 → base64url, decoded on load.

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const defaultName = (i) => `Player ${i + 1}`;

export function encodeSnapshot({ seed, playerCount, groupName, names }) {
  // Only custom names need to travel — blanks and "Player N" defaults are
  // reconstructed on decode. Trailing defaults are dropped entirely.
  const custom = names.slice(0, playerCount).map((n, i) => {
    const t = (n || "").trim();
    return t && t !== defaultName(i) ? t : "";
  });
  while (custom.length && custom[custom.length - 1] === "") custom.pop();

  const payload = { v: 1, s: seed, p: playerCount, g: groupName || "" };
  if (custom.length) payload.n = custom;
  return toBase64Url(JSON.stringify(payload));
}

// Returns { seed, playerCount, groupName, names } or null if the param is junk.
export function decodeSnapshot(param) {
  try {
    const p = JSON.parse(fromBase64Url(param));
    if (p.v !== 1 || !p.s || !p.p) return null;
    const custom = Array.isArray(p.n) ? p.n : [];
    const names = Array.from({ length: p.p }, (_, i) => {
      const t = (custom[i] || "").trim();
      return t || defaultName(i);
    });
    return { seed: p.s, playerCount: p.p, groupName: p.g || "", names };
  } catch {
    return null;
  }
}

// Builds the full shareable URL for the current page (base path preserved).
export function snapshotUrl(snapshot) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?d=${encodeSnapshot(snapshot)}`;
}
