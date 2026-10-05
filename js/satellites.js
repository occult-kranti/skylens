// satellites.js — TLE loading (CelesTrak live → localStorage cache → bundled snapshot)
// and 1 Hz SGP4 propagation via vendored satellite.js (UMD global `satellite`).
import { D2R, R2D, norm360 } from './astro.js';

const CACHE_KEY = 'skylens.tle.v1';
const ATTEMPT_KEY = 'skylens.tle.attempt.v1';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 h
export const MAX_ELEMENT_AGE_DAYS = 7; // display policy, not a promised positional accuracy
const GROUPS = ['stations', 'visual'];
const CELESTRAK = (g) => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`;

let recs = [];          // [{name, rec}]
let meta = { source: 'none', fetchedAt: null, count: 0, bad: 0 };
let memoryCache = null, memoryAttempt = null, inFlight = null, inFlightSignal = null;
export const satMeta = () => meta;
export const satTotal = () => recs.length;

export function tleEpoch(l1) {
  const yy = Number(l1?.slice(18, 20)), day = Number(l1?.slice(20, 32));
  if (!Number.isInteger(yy) || yy < 0 || yy > 99 || !(day >= 1 && day < 367)) return null;
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  if (day >= days + 1) return null;
  return Date.UTC(year, 0, 1) + (day - 1) * 86400000;
}

export function elementAgeDays(epoch, date = new Date()) {
  return Number.isFinite(epoch) ? Math.abs(date.getTime() - epoch) / 86400000 : Infinity;
}

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
    try {
      if (typeof s?.l1 !== 'string' || typeof s?.l2 !== 'string') { bad++; continue; }
      const norad = s.l1.slice(2, 7);
      if (seen.has(norad)) continue;
      const rec = lib.twoline2satrec(s.l1, s.l2);
      const epoch = tleEpoch(s.l1);
      if (rec && rec.no && epoch !== null) { seen.add(norad); ok.push({ id: `sat:${norad.trim()}`, name: s.name, rec, epoch }); }
      else bad++;
    } catch { bad++; } // malformed TLE → quarantine (edge case E10)
  }
  return { ok, bad };
}

async function fetchText(url, timeoutMs = 5000, signal) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const abort = () => ctl.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) ctl.abort();
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'error', credentials: 'omit' });
    if (r.status !== 200) throw new Error(`CelesTrak HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); signal?.removeEventListener('abort', abort); }
}

function readStored(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / quota: session memory remains */ }
}
function latestCache(now) {
  const candidates = [memoryCache, readStored(CACHE_KEY)].filter(c =>
    c && Number.isFinite(c.t) && c.t <= now && Array.isArray(c.list) && c.list.length).sort((a, b) => b.t - a.t);
  for (const cached of candidates) {
    const built = buildRecs(cached.list);
    if (built.ok.length) return { cached, built };
  }
  return null;
}
function latestAttempt(now) {
  return [memoryAttempt, readStored(ATTEMPT_KEY)].filter(a =>
    a && Number.isFinite(a.t) && a.t > 0 && a.t <= now).sort((a, b) => b.t - a.t)[0] || null;
}
function metadata(source, fetchedAt, built, attempt, extra = {}) {
  const now = Date.now();
  const cacheStale = fetchedAt === null || now - fetchedAt >= CACHE_TTL_MS;
  const refreshFrom = Math.max(attempt?.t || 0, source === 'cache' || source === 'celestrak' ? fetchedAt || 0 : 0);
  return { source, fetchedAt, count: built.ok.length, bad: built.bad,
    lastAttemptAt: attempt?.t || null,
    nextRefreshAt: refreshFrom ? refreshFrom + CACHE_TTL_MS : null,
    error: attempt?.error || null, partial: false, groupsLoaded: [], cacheStale,
    stale: cacheStale || source === 'snapshot', ...extra };
}

async function initialize({ signal } = {}) {
  await (window.__satReady || Promise.resolve()); // pinned local loader
  if (signal?.aborted) return meta;
  if (!window.satellite) {
    recs = []; meta = { source: 'none', fetchedAt: null, count: 0, bad: 0, error: 'Satellite propagation engine unavailable.' };
    return meta;
  }
  const now = Date.now(), available = latestCache(now);
  let attempt = latestAttempt(now);
  const freshCache = available && now - available.cached.t < CACHE_TTL_MS;
  const cooldown = attempt && now - attempt.t < CACHE_TTL_MS;
  // Both successful and failed requests have a two-hour cooldown. UI retries cannot bypass it.
  if (!freshCache && !cooldown) {
    attempt = { t: now, error: null, groupsLoaded: [] };
    memoryAttempt = attempt;
    store(ATTEMPT_KEY, attempt); // reserve the interval before starting any network work
    const list = [], groupsLoaded = [];
    // Stop at the first provider/network/parse failure, as required by CelesTrak usage policy.
    for (const group of GROUPS) {
      try {
        const text = await fetchText(CELESTRAK(group), 5000, signal);
        if (signal?.aborted) return meta;
        const items = parseTLE(text);
        if (!buildRecs(items).ok.length) throw new Error(`No valid orbital elements in ${group}`);
        list.push(...items); groupsLoaded.push(group);
      } catch (error) {
        if (signal?.aborted) return meta;
        attempt = { ...attempt, error: String(error.message || error), groupsLoaded };
        break;
      }
    }
    if (signal?.aborted) return meta;
    attempt = { ...attempt, groupsLoaded };
    memoryAttempt = attempt; store(ATTEMPT_KEY, attempt);
    const { ok, bad } = buildRecs(list);
    if (ok.length) {
      const partial = groupsLoaded.length < GROUPS.length;
      memoryCache = { t: Date.now(), list, groupsLoaded, partial };
      // Keep the last complete persisted cache when only one group succeeded.
      if (!partial) store(CACHE_KEY, memoryCache);
      recs = ok;
      meta = metadata('celestrak', memoryCache.t, { ok, bad }, attempt, { groupsLoaded, partial });
      return meta;
    }
  }
  // A previous successful cache remains preferable to the bundled snapshot even after two hours.
  if (available) {
    const { cached, built } = available;
    recs = built.ok;
    meta = metadata('cache', cached.t, built, attempt, {
      groupsLoaded: Array.isArray(cached.groupsLoaded) ? cached.groupsLoaded : [], partial: cached.partial === true,
    });
    return meta;
  }
  // Local fallback never counts as a fresh provider fetch. Abort after either await prevents late state writes.
  try {
    const r = await fetch('data/tle-snapshot.json', { signal });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    if (signal?.aborted) return meta;
    const built = buildRecs(Array.isArray(j.satellites) ? j.satellites : []);
    recs = built.ok;
    const timestamp = Date.parse(j.fetchedAt);
    meta = metadata('snapshot', Number.isFinite(timestamp) ? timestamp : null, built, attempt);
  } catch {
    if (signal?.aborted) return meta;
    recs = [];
    meta = metadata('none', null, { ok: [], bad: 0 }, attempt);
  }
  return meta;
}

export function initSatellites(options = {}) {
  if (options.signal?.aborted) return Promise.resolve(meta);
  // A new foreground session must not mistake a superseded aborted session for a completed load.
  if (inFlight && inFlightSignal?.aborted) return inFlight.then(() => initSatellites(options));
  if (inFlight) return inFlight; // simultaneous controls share one request sequence
  const request = initialize(options).finally(() => {
    if (inFlight === request) { inFlight = null; inFlightSignal = null; }
  });
  inFlightSignal = options.signal || null;
  inFlight = request;
  return request;
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
  if (!lib || !Number.isFinite(date?.getTime()) || !Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return [];
  const gmst = lib.gstime(date);
  const obsGd = { longitude: lonDeg * D2R, latitude: latDeg * D2R, height: 0 };
  const out = [];
  let suppressed = 0, oldestAgeDays = 0;
  for (const { id, name, rec, epoch } of recs) {
    const ageDays = elementAgeDays(epoch, date);
    oldestAgeDays = Math.max(oldestAgeDays, ageDays);
    if (ageDays > MAX_ELEMENT_AGE_DAYS) { suppressed++; continue; }
    try {
      const pv = lib.propagate(rec, date);
      if (!pv || !pv.position) continue;                 // decayed / undefined (E9)
      const r = Math.hypot(pv.position.x, pv.position.y, pv.position.z);
      if (!(r > 6400 && r < 60000)) continue;            // physically implausible → skip
      const ecf = lib.eciToEcf(pv.position, gmst);
      const look = lib.ecfToLookAngles(obsGd, ecf);      // az rad CW from N, el rad
      const alt = look.elevation * R2D;
      if (alt < minAlt) continue;
      out.push({ id, kind: 'satellite', name, alt, az: norm360(look.azimuth * R2D), rangeKm: look.rangeSat, epoch: new Date(epoch).toISOString(), ageDays });
    } catch { /* per-satellite failure must not break the batch */ }
  }
  out.sort((a, b) => b.alt - a.alt);
  Object.assign(meta, { suppressed, oldestAgeDays, stale: suppressed > 0 || meta.cacheStale || meta.source === 'snapshot' });
  return out;
}
