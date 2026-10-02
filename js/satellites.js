// satellites.js — TLE loading (CelesTrak live → localStorage cache → bundled snapshot)
// and 1 Hz SGP4 propagation via vendored satellite.js (UMD global `satellite`).
import { D2R, R2D, norm360 } from './astro.js';

const CACHE_KEY = 'skylens.tle.v1';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 h
const GROUPS = ['stations', 'visual'];
const CELESTRAK = (g) => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`;

let recs = [];          // [{name, rec}]
let meta = { source: 'none', fetchedAt: null, count: 0, bad: 0 };
export const satMeta = () => meta;
export const satTotal = () => recs.length;

export function parseTLE(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length + 1; i += 3) {
    const [n, l1, l2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (n && l1 && l2 && l1.startsWith('1 ') && l2.startsWith('2 ')) out.push({ name: n.trim(), l1, l2 });
  }
  return out;
}

function buildRecs(list) {
  const lib = window.satellite;
  const ok = [], seen = new Set();
  let bad = 0;
  for (const s of list) {
    const norad = s.l1.slice(2, 7);
    if (seen.has(norad)) continue;
    try {
      const rec = lib.twoline2satrec(s.l1, s.l2);
      if (rec && rec.no) { seen.add(norad); ok.push({ name: s.name, rec }); }
      else bad++;
    } catch { bad++; } // malformed TLE → quarantine (edge case E10)
  }
  return { ok, bad };
}

async function fetchText(url, timeoutMs = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.text();
  } finally { clearTimeout(t); }
}

export async function initSatellites() {
  await (window.__satReady || Promise.resolve()); // local-then-CDN loader
  if (!window.satellite) { meta = { source: 'none', fetchedAt: null, count: 0, bad: 0 }; return meta; }
  // 1) fresh cache
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && Date.now() - c.t < CACHE_TTL_MS && c.list?.length) {
      const { ok, bad } = buildRecs(c.list);
      if (ok.length) { recs = ok; meta = { source: 'cache', fetchedAt: c.t, count: ok.length, bad }; return meta; }
    }
  } catch { /* corrupt cache → refetch */ }
  // 2) live CelesTrak (CORS-verified)
  try {
    const texts = await Promise.allSettled(GROUPS.map((g) => fetchText(CELESTRAK(g))));
    const list = texts.flatMap((r) => (r.status === 'fulfilled' ? parseTLE(r.value) : []));
    const { ok, bad } = buildRecs(list);
    if (ok.length) {
      recs = ok;
      meta = { source: 'celestrak', fetchedAt: Date.now(), count: ok.length, bad };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), list })); } catch { /* quota */ }
      return meta;
    }
    throw new Error('empty');
  } catch {
    // 3) bundled snapshot fallback (edge case E11)
    try {
      const r = await fetch('data/tle-snapshot.json');
      const j = await r.json();
      const { ok, bad } = buildRecs(j.satellites.map((s) => ({ name: s.name, l1: s.l1, l2: s.l2 })));
      recs = ok;
      meta = { source: 'snapshot', fetchedAt: Date.parse(j.fetchedAt) || null, count: ok.length, bad, stale: true };
    } catch { meta = { source: 'none', fetchedAt: null, count: 0, bad: 0 }; }
    return meta;
  }
}

// Test/diagnostic hook: load a parsed TLE list directly (no network, no cache).
export function loadRecsFromList(list) {
  const { ok, bad } = buildRecs(list);
  recs = ok;
  meta = { source: 'direct', fetchedAt: Date.now(), count: ok.length, bad };
  return meta;
}

// Propagate all tracked satellites once (call at ~1 Hz). Returns those above minAlt.
export function propagateNow(date, latDeg, lonDeg, minAlt = 0) {
  const lib = window.satellite;
  const gmst = lib.gstime(date);
  const obsGd = { longitude: lonDeg * D2R, latitude: latDeg * D2R, height: 0 };
  const out = [];
  for (const { name, rec } of recs) {
    try {
      const pv = lib.propagate(rec, date);
      if (!pv || !pv.position) continue;                 // decayed / undefined (E9)
      const r = Math.hypot(pv.position.x, pv.position.y, pv.position.z);
      if (!(r > 6400 && r < 60000)) continue;            // physically implausible → skip
      const ecf = lib.eciToEcf(pv.position, gmst);
      const look = lib.ecfToLookAngles(obsGd, ecf);      // az rad CW from N, el rad
      const alt = look.elevation * R2D;
      if (alt < minAlt) continue;
      out.push({ name, alt, az: norm360(look.azimuth * R2D), rangeKm: look.rangeSat });
    } catch { /* per-satellite failure must not break the batch */ }
  }
  out.sort((a, b) => b.alt - a.alt);
  return out;
}
