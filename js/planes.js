// Optional location-sharing feed: start only after the user enables Aircraft.
// No automatic provider failover. readsb aircraft.json uses seconds; v2 uses ms.
// adsb.fi's official README, read 2026-10-05, states: "The endpoints and
// responses are compatible with ADSBexchange v2 API." Its /v3/lat/... endpoint
// replaces the differently formatted deprecated v2 nearby endpoint:
// https://github.com/adsbfi/opendata/blob/main/README.md
// This documents the parser, not browser availability: fi remains experimental.
import { projectAircraft, groundDistanceM, MAX_POSITION_AGE_MS } from './aircraft-geometry.js';

export const DEFAULT_AIRCRAFT_PROVIDER = 'avioadsb';
export const AIRCRAFT_PROVIDERS = Object.freeze({
  // Anonymous requests permit 100nm; the 250nm contributor tier is not used.
  avioadsb: Object.freeze({ id: 'avioadsb', name: 'AvioADSB', schema: 'readsb-v2', maxRangeNm: 100, intervalMs: 12000,
    homepage: 'https://avioadsb.org/', endpoint: 'https://avioadsb.org/v1/point', resetHeaderSeconds: true }),
  adsbfi: Object.freeze({ id: 'adsbfi', name: 'adsb.fi', schema: 'readsb-v2', maxRangeNm: 250, intervalMs: 5000,
    homepage: 'https://adsb.fi/', endpoint: 'https://opendata.adsb.fi/api/v3', resetHeaderSeconds: false }),
});
const MAX_INTERVAL_MS = 120000, FUTURE_TOLERANCE_MS = 5000;
const COOLDOWN_KEY = 'skylens.aircraft.cooldowns.v1', cooldowns = new Map();
const clean = (value, max = 100) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
function providerConfig(id) {
  if (typeof id !== 'string' || !Object.hasOwn(AIRCRAFT_PROVIDERS, id)) throw new RangeError('Choose a supported aircraft provider.');
  return AIRCRAFT_PROVIDERS[id];
}
function rangeValue(value, provider) {
  if (!Number.isFinite(value) || value < 1 || value > provider.maxRangeNm) throw new RangeError(`Aircraft range must be 1–${provider.maxRangeNm} nautical miles.`);
  return value;
}
function observerValid(loc) {
  return loc && Number.isFinite(loc.lat) && Math.abs(loc.lat) <= 90 && Number.isFinite(loc.lon) && Math.abs(loc.lon) <= 180 &&
    (loc.heightM == null || Number.isFinite(loc.heightM) && loc.heightM >= -2000 && loc.heightM <= 100000);
}
function endpoint(provider, loc, rangeNm) {
  const lat = loc.lat.toFixed(3), lon = loc.lon.toFixed(3);
  return provider.id === 'adsbfi' ? `${provider.endpoint}/lat/${lat}/lon/${lon}/dist/${rangeNm}` : `${provider.endpoint}/${lat}/${lon}/${rangeNm}`;
}
export function retryAfterTime(value, now = Date.now()) {
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const date = now + Number(value) * 1000;
    if (Number.isFinite(date) && date <= 8640000000000000) return date;
  }
  const parsed = typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && parsed > now ? parsed : now + 15 * 60000;
}
export function quotaResetTime(headers, now = Date.now(), providerId = DEFAULT_AIRCRAFT_PROVIDER) {
  const provider = providerConfig(providerId);
  // Avio defines its reset header as seconds, unlike some other services.
  const names = provider.resetHeaderSeconds ? ['Retry-After', 'X-RateLimit-Reset'] : ['Retry-After'];
  const values = names.map(name => headers?.get?.(name)).filter(value => value != null && value !== '');
  return Math.max(now + 1000, values.length ? Math.max(...values.map(value => retryAfterTime(value, now))) : now + 15 * 60000);
}
function loadCooldown(id) {
  let cached = cooldowns.get(id);
  try {
    const all = JSON.parse(globalThis.localStorage?.getItem(COOLDOWN_KEY) || '{}'), item = all[id];
    if (item && Number.isFinite(item.retryAt) && ['limited', 'unavailable'].includes(item.status) && [401, 403, 429].includes(item.httpStatus) && (!cached || item.retryAt > cached.retryAt)) cached = { retryAt: item.retryAt, status: item.status, httpStatus: item.httpStatus };
  } catch { /* Storage failure cannot remove the in-memory cooldown. */ }
  if (cached) cooldowns.set(id, cached);
  return cached;
}
function saveCooldown(id, value) {
  cooldowns.set(id, value);
  try { globalThis.localStorage?.setItem(COOLDOWN_KEY, JSON.stringify(Object.fromEntries(cooldowns))); } catch { /* No locations or payloads are ever stored. */ }
}

export function refreshAircraftPositions(planes, observer, now = Date.now()) {
  if (!observerValid(observer) || !Number.isFinite(now)) return [];
  return planes.map(plane => projectAircraft(plane, observer, now)).filter(plane => plane && plane.distKm <= plane.rangeNm * 1.852)
    .sort((a, b) => a.distKm - b.distKm);
}

// Pure bounded normalization. `schema` explicitly adapts a saved readsb
// aircraft.json; network polling always uses the selected provider's schema.
export function parseAircraftPayload(payload, observer, { provider: providerId = DEFAULT_AIRCRAFT_PROVIDER, rangeNm = 50, receivedAt, schema } = {}) {
  const provider = providerConfig(providerId); rangeValue(rangeNm, provider);
  if (!observerValid(observer) || !Number.isFinite(receivedAt)) throw new RangeError('Aircraft parsing needs a valid observer and receipt timestamp.');
  const format = schema ?? provider.schema;
  if (!['readsb-v2', 'readsb-aircraft-json'].includes(format)) throw new RangeError('Unsupported aircraft timestamp schema.');
  const rows = format === 'readsb-aircraft-json' ? payload?.aircraft : payload?.ac;
  if (!Array.isArray(rows) || rows.length > 20000 || !Number.isFinite(payload?.now)) throw new Error('Aircraft response lacks a bounded position array or timestamp.');
  const providerAt = payload.now * (format === 'readsb-aircraft-json' ? 1000 : 1), payloadAgeMs = receivedAt - providerAt;
  if (!Number.isFinite(providerAt) || payloadAgeMs > MAX_POSITION_AGE_MS || payloadAgeMs < -FUTURE_TOLERANCE_MS) throw new Error('Aircraft response timestamp is stale or inconsistent.');
  const seen = new Set(), reports = [];
  for (const row of rows) {
    if (!row || !Number.isFinite(row.lat) || Math.abs(row.lat) > 90 || !Number.isFinite(row.lon) || Math.abs(row.lon) > 180 ||
      !Number.isFinite(row.seen_pos) || row.seen_pos < 0 || row.seen_pos > 60) continue;
    const positionAt = providerAt - row.seen_pos * 1000, positionAge = receivedAt - positionAt;
    if (positionAge > MAX_POSITION_AGE_MS || positionAge < -FUTURE_TOLERANCE_MS || row.alt_baro === 'ground') continue;
    const geom = Number.isFinite(row.alt_geom) && row.alt_geom >= -2000 && row.alt_geom <= 100000;
    const baro = Number.isFinite(row.alt_baro) && row.alt_baro >= -2000 && row.alt_baro <= 100000;
    if (!geom && !baro) continue;
    const identity = clean(row.hex, 40) || clean(row.flight, 40);
    if (!identity || seen.has(identity)) continue;
    const distance = groundDistanceM(observer, row);
    if (!Number.isFinite(distance) || distance > rangeNm * 1852) continue;
    const altitudeKind = geom ? 'geometric-wgs84' : 'barometric-approximate', altFt = geom ? row.alt_geom : row.alt_baro;
    const rate = geom ? row.geom_rate : row.baro_rate;
    const gsKt = Number.isFinite(row.gs) && row.gs >= 0 && row.gs <= 1500 ? row.gs : null;
    const track = Number.isFinite(row.track) && row.track >= 0 && row.track < 360 ? row.track : null;
    const verticalRateFpm = Number.isFinite(rate) && Math.abs(rate) <= 12000 ? rate : null;
    const integrity = Object.fromEntries(['nic', 'nac_p', 'nac_v', 'sil', 'rc'].filter(k => Number.isFinite(row[k]) && row[k] >= 0).map(k => [k, row[k]]));
    reports.push({ id: `plane:${identity}`, flight: clean(row.flight) || identity, hex: clean(row.hex, 40), registration: clean(row.r), aircraftType: clean(row.t), type: clean(row.type),
      lat: row.lat, lon: row.lon, altM: altFt * .3048, altFt, altitudeKind, altitudeType: altitudeKind, gsKt, track, verticalRateFpm,
      velocity: { groundSpeedKt: gsKt, trueTrackDeg: track, verticalRateFpm, verticalRateKind: verticalRateFpm == null ? 'unknown-level-assumed' : geom ? 'geometric' : 'barometric' },
      positionAt, providerAt, receivedAt, source: provider.id, sourceName: provider.name, schema: format, rangeNm,
      mlat: Array.isArray(row.mlat) ? row.mlat.map(v => clean(v, 30)).filter(Boolean).slice(0, 20) : [],
      tisb: Array.isArray(row.tisb) ? row.tisb.map(v => clean(v, 30)).filter(Boolean).slice(0, 20) : [], integrity,
      altitudeNote: geom ? 'Reported geometric WGS84 ellipsoid altitude.' : 'Pressure altitude used as approximate ellipsoid height; weather and geoid differences are not corrected.' });
    seen.add(identity);
  }
  return { planes: refreshAircraftPositions(reports, observer, receivedAt), providerAt, receivedAt, source: provider.id, sourceName: provider.name,
    payloadAgeMs: Math.max(0, payloadAgeMs), clockSkewMs: Math.max(0, -payloadAgeMs), rangeNm };
}

export function startPlanes(getLoc, onUpdate, { provider: providerId = DEFAULT_AIRCRAFT_PROVIDER, rangeNm = 50 } = {}) {
  const provider = providerConfig(providerId); rangeValue(rangeNm, provider);
  if (typeof getLoc !== 'function' || typeof onUpdate !== 'function') throw new TypeError('Aircraft location and update callbacks are required.');
  const doc = globalThis.document;
  let timer = null, controller = null, timeout = null, interval = provider.intervalMs, stopped = false, quotaPaused = false, requestId = 0, inFlight = false;
  let lastSuccess = null;
  const hidden = () => doc?.hidden === true;
  function schedule(ms) { clearTimeout(timer); if (!stopped && !quotaPaused && !hidden()) timer = setTimeout(tick, ms); }
  function emit(update) { if (!stopped && !hidden()) onUpdate({ ageMs: lastSuccess, source: provider.id, sourceName: provider.name, rangeNm, ...update }); }
  async function tick() {
    if (stopped || inFlight || quotaPaused || hidden()) return;
    const cooldown = loadCooldown(provider.id);
    if (cooldown?.retryAt > Date.now()) { quotaPaused = true; emit({ ...cooldown, planes: [] }); return; }
    const token = ++requestId;
    const alive = () => !stopped && !hidden() && token === requestId;
    const valid = () => alive() && !controller?.signal.aborted;
    try {
      const selected = getLoc();
      if (!observerValid(selected)) { emit({ status: 'location-needed', planes: [] }); schedule(provider.intervalMs); return; }
      const loc = { lat: selected.lat, lon: selected.lon, ...(selected.heightM == null ? {} : { heightM: selected.heightM }) };
      inFlight = true; const requestController = controller = new AbortController();
      timeout = setTimeout(() => requestController.abort(), 10000);
      const response = await fetch(endpoint(provider, loc, rangeNm), { signal: requestController.signal, credentials: 'omit', redirect: 'error', cache: 'no-store' });
      if (!valid()) return;
      if ([401, 403, 429].includes(response.status)) {
        const value = { status: response.status === 429 ? 'limited' : 'unavailable', httpStatus: response.status, retryAt: quotaResetTime(response.headers, Date.now(), provider.id) };
        saveCooldown(provider.id, value); quotaPaused = true; emit({ ...value, planes: [] }); return;
      }
      if (!response.ok) throw new Error(`Aircraft HTTP ${response.status}`);
      const json = await response.json(); if (!valid()) return;
      const parsed = parseAircraftPayload(json, loc, { provider: provider.id, rangeNm, receivedAt: Date.now() });
      lastSuccess = parsed.receivedAt; interval = provider.intervalMs;
      const header = response.headers?.get?.('X-RateLimit-Remaining');
      const remaining = header != null && /^\d+$/.test(header) ? Number(header) : null;
      if (remaining === 0) {
        const value = { status: 'limited', httpStatus: 429, retryAt: quotaResetTime(response.headers, Date.now(), provider.id) };
        saveCooldown(provider.id, value); quotaPaused = true; emit({ ...parsed, ...value, planes: [], remaining });
      } else emit({ ...parsed, status: 'ok', remaining });
    } catch {
      if (alive()) { interval = Math.min(interval * 2, MAX_INTERVAL_MS); emit({ status: 'error', planes: [], error: 'Aircraft data could not be loaded or failed freshness checks.' }); }
    } finally {
      if (token === requestId) { clearTimeout(timeout); timeout = null; controller = null; inFlight = false; schedule(interval); }
    }
  }
  function interrupt() { requestId++; clearTimeout(timer); clearTimeout(timeout); timer = timeout = null; controller?.abort(); controller = null; inFlight = false; }
  function visibility() { if (hidden()) interrupt(); else if (!stopped && !quotaPaused) void tick(); }
  doc?.addEventListener?.('visibilitychange', visibility);
  void tick();
  return { stop() { if (stopped) return; stopped = true; interrupt(); doc?.removeEventListener?.('visibilitychange', visibility); } };
}
