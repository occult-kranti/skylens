// CelesTrak GP OMM/JSON → local cache → legacy bundled TLE snapshot.
// SGP4 positions and approximate illumination are calculations, not detections.
import { D2R, R2D, norm360 } from './astro.js';

const CACHE_KEY = 'skylens.tle.v1';
const ATTEMPT_KEY = 'skylens.tle.attempt.v1';
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 h
export const MAX_ELEMENT_AGE_DAYS = 7; // display policy, not a promised positional accuracy
export const MAX_RECORDS = 1000; // bounded stations/visual catalogue, never an all-object feed
const GROUPS = ['stations', 'visual'];
const CELESTRAK = (g) => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=JSON`;

let recs = [];          // [{id, noradId, name, groups, rec, epoch}]
let meta = { source: 'none', fetchedAt: null, count: 0, bad: 0 };
let memoryCache = null, memoryAttempt = null, inFlight = null, inFlightSignal = null;
export const satMeta = () => refreshFreshness();
export const satTotal = () => recs.length;

function refreshFreshness() {
  const now = Date.now();
  meta.cacheStale = !Number.isFinite(meta.fetchedAt) || meta.fetchedAt > now || now - meta.fetchedAt >= CACHE_TTL_MS;
  meta.stale = meta.cacheStale || meta.source === 'snapshot' || (meta.suppressed || 0) > 0;
  return meta;
}

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
  if (typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length + 1; i += 3) {
    const [n, l1, l2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (n && l1 && l2 && l1.startsWith('1 ') && l2.startsWith('2 ')) out.push({ name: n.trim(), l1, l2 });
  }
  return out;
}

// CelesTrak JSON omits redundant OMM fields: EARTH, TEME, UTC, SGP4 are
// the documented defaults. If present, conflicting model metadata is rejected.
const numeric = value => (typeof value === 'number' || (typeof value === 'string' && value.trim()))
  && Number.isFinite(Number(value)) ? Number(value) : NaN;
const catalogueId = value => /^\d{1,9}$/.test(String(value)) && Number(value) > 0 ? String(Number(value)) : null;
const sourceGroups = value => Array.isArray(value) ? GROUPS.filter(g => value.includes(g)) : [];

export function ommEpoch(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z?$/.test(value)) return null;
  const utc = value.endsWith('Z') ? value : `${value}Z`;
  const epoch = Date.parse(utc), date = new Date(epoch);
  if (!Number.isFinite(epoch) || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100
    || date.toISOString().slice(0, 19) !== utc.slice(0, 19)) return null;
  return epoch;
}

function validOMM(omm) {
  if (!omm || typeof omm !== 'object' || Array.isArray(omm) || !catalogueId(omm.NORAD_CAT_ID)
    || ommEpoch(omm.EPOCH) === null) return false;
  for (const [key, expected] of Object.entries({ CENTER_NAME: 'EARTH', REF_FRAME: 'TEME', TIME_SYSTEM: 'UTC', MEAN_ELEMENT_THEORY: 'SGP4' })) {
    if (omm[key] != null && omm[key] !== expected) return false;
  }
  if (omm.EPHEMERIS_TYPE != null && numeric(omm.EPHEMERIS_TYPE) !== 0) return false;
  const e = numeric(omm.ECCENTRICITY), n = numeric(omm.MEAN_MOTION), i = numeric(omm.INCLINATION);
  return e >= 0 && e < 1 && n > 0 && n <= 20 && i >= 0 && i <= 180
    && ['RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY'].every(key => numeric(omm[key]) >= 0 && numeric(omm[key]) < 360)
    && ['BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT'].every(key => Number.isFinite(numeric(omm[key])));
}

export function parseOMM(text, group) {
  let payload;
  try { payload = typeof text === 'string' ? JSON.parse(text) : text; } catch { return []; }
  if (!Array.isArray(payload) || payload.length > MAX_RECORDS) return [];
  return payload.map(omm => ({ omm, groups: GROUPS.includes(group) ? [group] : [] }));
}

function validTLE(s) {
  if (typeof s?.l1 !== 'string' || typeof s?.l2 !== 'string' || s.l1.length !== 69 || s.l2.length !== 69
    || !s.l1.startsWith('1 ') || !s.l2.startsWith('2 ') || s.l1.slice(2, 7) !== s.l2.slice(2, 7)
    || !catalogueId(s.l1.slice(2, 7).trim()) || tleEpoch(s.l1) === null) return false;
  const checksum = line => /\d/.test(line[68]) && [...line.slice(0, 68)].reduce((n, c) => n + (/\d/.test(c) ? Number(c) : c === '-' ? 1 : 0), 0) % 10 === Number(line[68]);
  return checksum(s.l1) && checksum(s.l2) && (s.l1[62] === '0' || s.l1[62] === ' ');
}

function buildRecs(list) {
  const lib = window.satellite;
  const byId = new Map();
  let bad = 0;
  if (!Array.isArray(list) || list.length > MAX_RECORDS * GROUPS.length) return { ok: [], bad: 1 };
  for (const s of list) {
    try {
      const omm = s?.omm || (s?.NORAD_CAT_ID != null ? s : null);
      if (omm ? !validOMM(omm) : !validTLE(s)) { bad++; continue; }
      const noradId = catalogueId(omm ? omm.NORAD_CAT_ID : s.l1.slice(2, 7).trim());
      const epoch = omm ? ommEpoch(omm.EPOCH) : tleEpoch(s.l1);
      const rec = omm ? lib.json2satrec(omm) : lib.twoline2satrec(s.l1, s.l2);
      if (!rec || !Number.isFinite(rec.no) || rec.no <= 0 || (rec.error != null && rec.error !== 0)) { bad++; continue; }
      const rawName = omm ? omm.OBJECT_NAME : s.name;
      const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 100) : `NORAD ${noradId}`;
      const groups = sourceGroups(s.groups);
      const old = byId.get(noradId);
      const combined = GROUPS.filter(g => groups.includes(g) || old?.groups.includes(g));
      if (!old || epoch > old.epoch) byId.set(noradId, { id: `sat:${noradId.padStart(5, '0')}`, noradId, name, groups: combined, rec, epoch });
      else old.groups = combined;
    } catch { bad++; } // malformed elements → quarantine without breaking the catalogue
  }
  return { ok: [...byId.values()].slice(0, MAX_RECORDS), bad };
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
        const items = parseOMM(text, group);
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

// Test/diagnostic hook: parsed legacy TLE or OMM rows; no network or cache writes.
export function loadRecsFromList(list) {
  const { ok, bad } = buildRecs(list);
  recs = ok;
  meta = { source: 'direct', fetchedAt: Date.now(), count: ok.length, bad };
  return meta;
}

const KM_PER_AU = 149597870.7;
const finiteVector = vector => vector && [vector.x, vector.y, vector.z].every(Number.isFinite);

function observerInput(date, lat, lon, minAlt, height, step) {
  return Number.isFinite(date?.getTime()) && date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 2100
    && Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180
    && Number.isFinite(minAlt) && Math.abs(minAlt) <= 90
    && Number.isFinite(height) && height >= -500 && height <= 10000
    && Number.isFinite(step) && step >= 0 && step <= 5;
}

function lookAt(lib, rec, date, gmst, observer) {
  const pv = lib.propagate(rec, date, { communityDecayCheckEnabled: true });
  if (!finiteVector(pv?.position) || (rec.error != null && rec.error !== 0)) return null;
  // SGP4 reports decay; reject nonphysical/nonfinite states rather than imposing
  // an arbitrary upper orbital radius. This catalogue is still stations/visual.
  if (Math.hypot(pv.position.x, pv.position.y, pv.position.z) <= 6378.135) return null;
  const look = lib.ecfToLookAngles(observer, lib.eciToEcf(pv.position, gmst));
  if (![look.elevation, look.azimuth, look.rangeSat].every(Number.isFinite) || look.rangeSat <= 0) return null;
  return { position: pv.position, alt: look.elevation * R2D, az: norm360(look.azimuth * R2D), rangeKm: look.rangeSat };
}

function sunlightAt(lib, date, gmst, observer) {
  const year = date.getUTCFullYear();
  if (year < 1950 || year > 2050) return { sun: null, observerSunAlt: null, unavailable: 'Illumination estimate unavailable outside 1950–2050' };
  try {
    // Use the paired upstream approximate-of-date Sun + TEME shadow convention.
    // Do not feed Astronomy Engine's J2000 vector into this frame unrotated.
    const sun = lib.sunPos(lib.jday(date)).rsun;
    if (!finiteVector(sun)) throw new Error('Invalid Sun vector');
    const km = { x: sun.x * KM_PER_AU, y: sun.y * KM_PER_AU, z: sun.z * KM_PER_AU };
    const observerSunAlt = lib.ecfToLookAngles(observer, lib.eciToEcf(km, gmst)).elevation * R2D;
    if (!Number.isFinite(observerSunAlt)) throw new Error('Invalid Sun altitude');
    return { sun, observerSunAlt, unavailable: null };
  } catch { return { sun: null, observerSunAlt: null, unavailable: 'Illumination estimate unavailable' }; }
}

function illuminationAt(lib, sun, position) {
  if (!sun) return { shadowFraction: null, illumination: 'unavailable' };
  try {
    const fraction = lib.shadowFraction(sun, position);
    if (!Number.isFinite(fraction) || fraction < -1e-8 || fraction > 1 + 1e-8) throw new Error('Invalid shadow estimate');
    const shadowFraction = Math.min(1, Math.max(0, fraction));
    return { shadowFraction, illumination: shadowFraction <= 1e-8 ? 'sunlit' : shadowFraction >= 1 - 1e-8 ? 'umbra' : 'penumbra' };
  } catch { return { shadowFraction: null, illumination: 'unavailable' }; }
}

export function observingCandidate(alt, observerSunAlt, illumination, unavailable = 'Illumination estimate unavailable') {
  const reasons = [];
  if (!Number.isFinite(alt) || alt < 0) reasons.push('Below the geometric horizon');
  if (illumination === 'unavailable' || !Number.isFinite(observerSunAlt)) reasons.push(unavailable);
  else {
    if (observerSunAlt > -6) reasons.push('Sun is above −6° twilight threshold');
    if (illumination === 'umbra') reasons.push('In Earth’s shadow');
    else if (illumination === 'penumbra') reasons.push('Partly in Earth’s shadow');
    else if (illumination !== 'sunlit') reasons.push('Illumination estimate unavailable');
  }
  return { candidate: reasons.length === 0, reasons };
}

// Call at ~1 Hz. The optional second sample supports smooth direction-vector
// interpolation in the renderer; it does not extrapolate missing orbital data.
export function propagateNow(date, latDeg, lonDeg, minAlt = 0, { observerHeightM = 0, nextSampleSeconds = 1 } = {}) {
  const lib = window.satellite;
  refreshFreshness();
  if (!lib || !observerInput(date, latDeg, lonDeg, minAlt, observerHeightM, nextSampleSeconds)) return [];
  const gmst = lib.gstime(date);
  const observer = { longitude: lonDeg * D2R, latitude: latDeg * D2R, height: observerHeightM / 1000 };
  const solar = sunlightAt(lib, date, gmst, observer);
  const nextDate = nextSampleSeconds > 0 ? new Date(date.getTime() + nextSampleSeconds * 1000) : null;
  const nextGmst = nextDate ? lib.gstime(nextDate) : null;
  const sampleTimeISO = date.toISOString(), out = [];
  let suppressed = 0, failed = 0, oldestAgeDays = 0;
  for (const { id, noradId, name, groups, rec, epoch } of recs) {
    const ageDays = elementAgeDays(epoch, date);
    oldestAgeDays = Math.max(oldestAgeDays, ageDays);
    if (ageDays > MAX_ELEMENT_AGE_DAYS) { suppressed++; continue; }
    try {
      const look = lookAt(lib, rec, date, gmst, observer);
      if (!look) { failed++; continue; }
      if (look.alt < minAlt) continue;
      const light = illuminationAt(lib, solar.sun, look.position);
      const geodetic = lib.eciToGeodetic?.(look.position, gmst);
      const geo = geodetic && [geodetic.latitude, geodetic.longitude, geodetic.height].every(Number.isFinite)
        ? { lat: geodetic.latitude * R2D, lon: geodetic.longitude * R2D, heightKm: geodetic.height } : null;
      let next = null;
      if (nextDate && nextDate.getUTCFullYear() <= 2100 && elementAgeDays(epoch, nextDate) <= MAX_ELEMENT_AGE_DAYS) {
        // Failure of the future sample must not discard a valid current sample.
        try {
          const ahead = lookAt(lib, rec, nextDate, nextGmst, observer);
          if (ahead) next = { dateISO: nextDate.toISOString(), alt: ahead.alt, az: ahead.az, rangeKm: ahead.rangeKm };
        } catch { /* no interpolation across a failed propagation */ }
      }
      const epochISO = new Date(epoch).toISOString();
      out.push({ id, noradId, kind: 'satellite', name, groups: [...groups], alt: look.alt, az: look.az, rangeKm: look.rangeKm,
        geo, observerHeightM, sampleTimeISO, next, epoch: epochISO, epochISO, ageDays,
        epochAgeDays: (date.getTime() - epoch) / 86400000, source: meta.source,
        sourceRetrievedAtISO: Number.isFinite(meta.fetchedAt) ? new Date(meta.fetchedAt).toISOString() : null,
        ...light, observerSunAlt: solar.observerSunAlt,
        visibility: observingCandidate(look.alt, solar.observerSunAlt, light.illumination, solar.unavailable || undefined) });
    } catch { failed++; } // one record cannot break the batch
  }
  out.sort((a, b) => b.alt - a.alt || a.id.localeCompare(b.id));
  Object.assign(meta, { suppressed, failed, oldestAgeDays, sampleTimeISO, observerSunAlt: solar.observerSunAlt });
  refreshFreshness();
  return out;
}
