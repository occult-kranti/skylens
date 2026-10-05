// Map traffic is independent of the sky observer. No import, construction or
// parsing performs a request. Regional requests reuse the shared aircraft budget.
import { AIRCRAFT_PROVIDERS, startPlanes, retryAfterTime } from './planes.js';

export const TRAFFIC_LIMITS = Object.freeze({ responseBytes: 32 * 1024 * 1024, rows: 60000, positionAgeMs: 60000, markerAgeMs: 20000, futureClockMs: 5000, receiverIntervalMs: 15000 });
const SCHEMAS = ['readsb-aircraft-json', 'readsb-v2'];
const clean = (value, max = 100) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
const coordinate = p => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180;
const numberIn = (n, low, high) => Number.isFinite(n) && n >= low && n <= high ? n : null;
function schemaValue(value) { if (!SCHEMAS.includes(value)) throw new RangeError('Choose readsb aircraft.json (seconds) or v2 API (milliseconds).'); return value; }
function coverageValue(value) {
  const kind = ['regional', 'receiver', 'global', 'unknown'].includes(value?.kind) ? value.kind : 'unknown';
  const result = { kind, label: clean(value?.label, 200) || 'Source-defined coverage; completeness unverified.' };
  if (kind === 'regional') {
    if (!coordinate(value.center) || !Number.isFinite(value.rangeNm) || value.rangeNm <= 0 || value.rangeNm > 250) throw new RangeError('Regional coverage needs a valid query center and range.');
    result.center = { lat: value.center.lat, lon: value.center.lon }; result.rangeNm = value.rangeNm;
  }
  return result;
}
function sourceValue(source) {
  return typeof source === 'string' ? { id: clean(source, 80) || 'receiver', name: clean(source) || 'Receiver' }
    : { id: clean(source?.id, 80) || 'receiver', name: clean(source?.name) || 'Receiver' };
}
function currentReport(report, now) {
  if (!Number.isFinite(now) || !Number.isFinite(report?.positionAt) || !coordinate(report)) return null;
  const age = now - report.positionAt;
  if (age < -TRAFFIC_LIMITS.futureClockMs || age > TRAFFIC_LIMITS.positionAgeMs) return null;
  const positionAgeMs = Math.max(0, age);
  return { ...report, positionAgeMs, positionMode: 'reported', extrapolatedSeconds: 0,
    projectedLat: report.lat, projectedLon: report.lon, projectedAltitudeM: report.altM,
    markerEligible: positionAgeMs <= TRAFFIC_LIMITS.markerAgeMs, overlayEligible: positionAgeMs <= TRAFFIC_LIMITS.markerAgeMs && report.altM != null && !report.ground,
    freshness: positionAgeMs <= TRAFFIC_LIMITS.markerAgeMs ? 'recent' : 'ageing' };
}
export function refreshTrafficReports(reports, now = Date.now()) {
  if (!Array.isArray(reports) || reports.length > TRAFFIC_LIMITS.rows) throw new RangeError('Traffic report count exceeds the supported bound.');
  return reports.map(report => currentReport(report, now)).filter(Boolean);
}

// Absolute positions: no nearby, hemisphere, horizon or altitude clipping.
// Unknown altitude and ground reports remain usable on a2D map and are labelled.
// A globe tile's global_ac_count_withpos never means complete flight coverage;
// source-provided route/destination/lastPosition fields are not promoted.
export function normalizeTrafficPayload(payload, { schema, source, receivedAt, coverage } = {}) {
  schemaValue(schema);
  if (!Number.isFinite(receivedAt)) throw new RangeError('Traffic requires an explicit receipt timestamp.');
  const rows = schema === 'readsb-aircraft-json' ? payload?.aircraft : payload?.ac;
  if (!Array.isArray(rows) || rows.length > TRAFFIC_LIMITS.rows || !Number.isFinite(payload?.now)) throw new RangeError('Traffic response lacks a bounded aircraft array or timestamp.');
  const providerAt = payload.now * (schema === 'readsb-aircraft-json' ? 1000 : 1), age = receivedAt - providerAt;
  if (!Number.isFinite(providerAt) || age > TRAFFIC_LIMITS.positionAgeMs || age < -TRAFFIC_LIMITS.futureClockMs) throw new RangeError('Traffic provider timestamp is stale or inconsistent.');
  const declaredCoverage = coverageValue(coverage), provider = sourceValue(source), records = new Map();
  for (const row of rows) {
    if (!coordinate(row) || !Number.isFinite(row.seen_pos) || row.seen_pos < 0 || row.seen_pos > 60) continue;
    const positionAt = providerAt - row.seen_pos * 1000;
    if (receivedAt - positionAt > TRAFFIC_LIMITS.positionAgeMs || positionAt - receivedAt > TRAFFIC_LIMITS.futureClockMs) continue;
    const hex = clean(row.hex, 40).toLowerCase();
    if (!/^~?[0-9a-f]{6}$/.test(hex)) continue;
    const previous = records.get(hex);
    if (previous && previous.positionAt >= positionAt) continue;
    const geometricFt = numberIn(row.alt_geom, -2000, 100000), pressureFt = numberIn(row.alt_baro, -2000, 100000);
    const ground = row.alt_baro === 'ground', altFt = geometricFt ?? pressureFt;
    const altitudeKind = geometricFt != null ? 'geometric-wgs84' : pressureFt != null ? 'barometric-approximate' : 'unknown';
    const verticalRateFpm = numberIn(geometricFt != null ? row.geom_rate : row.baro_rate, -12000, 12000);
    const flight = clean(row.flight) || hex;
    records.set(hex, { id: `plane:${hex}`, kind: 'plane', name: flight, flight, hex, registration: clean(row.r), aircraftType: clean(row.t), type: clean(row.type),
      lat: row.lat, lon: row.lon, altFt, altM: altFt == null ? null : altFt * .3048, altitudeKind, altitudeType: altitudeKind, ground,
      gsKt: numberIn(row.gs, 0, 1500), track: numberIn(row.track, 0, 359.999999999), verticalRateFpm,
      positionAt, providerAt, receivedAt, source: provider.id, sourceName: provider.name, schema,
      mlat: Array.isArray(row.mlat) ? row.mlat.map(v => clean(v, 30)).filter(Boolean).slice(0, 20) : [],
      tisb: Array.isArray(row.tisb) ? row.tisb.map(v => clean(v, 30)).filter(Boolean).slice(0, 20) : [],
      integrity: Object.fromEntries(['nic', 'nac_p', 'nac_v', 'sil', 'rc'].filter(k => Number.isFinite(row[k]) && row[k] >= 0).map(k => [k, row[k]])),
      altitudeNote: altitudeKind === 'geometric-wgs84' ? 'Reported geometric WGS84 ellipsoid altitude.' : altitudeKind === 'barometric-approximate' ? 'Pressure altitude; not corrected to geometric height.' : 'Altitude was not reported.',
      motionNote: 'Reported geographic position. No flight plan, destination or future trajectory is inferred.' });
  }
  return { reports: refreshTrafficReports([...records.values()], receivedAt), providerAt, receivedAt, coverage: declaredCoverage,
    sourceName: provider.name, source: provider.id, inputCount: rows.length, retainedCount: records.size, excludedCount: rows.length - records.size,
    truncated: false, payloadAgeMs: Math.max(0, age), clockSkewMs: Math.max(0, -age) };
}

export function validateTrafficReceiverURL(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new RangeError('Enter a receiver HTTPS JSON URL, without credentials or query parameters.');
  let url; try { url = new URL(value); } catch { throw new RangeError('Enter a valid receiver HTTPS JSON URL.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) throw new RangeError('Receiver URLs must use HTTPS with no credentials, query parameters or fragment.');
  return url.href;
}
function configValue(config) {
  if (config?.kind === 'regional') {
    if (typeof config.provider !== 'string' || !Object.hasOwn(AIRCRAFT_PROVIDERS, config.provider)) throw new RangeError('Choose a supported regional provider.');
    const provider = AIRCRAFT_PROVIDERS[config.provider];
    if (!coordinate(config.center) || !Number.isFinite(config.rangeNm) || config.rangeNm < 1 || config.rangeNm > provider.maxRangeNm) throw new RangeError('Choose a valid map query center and provider range.');
    return { kind: 'regional', provider: config.provider, center: { lat: config.center.lat, lon: config.center.lon }, rangeNm: config.rangeNm };
  }
  if (config?.kind === 'receiver') return { kind: 'receiver', url: validateTrafficReceiverURL(config.url), schema: schemaValue(config.schema), coverageLabel: clean(config.coverageLabel, 200) || 'Receiver coverage supplied by its operator; completeness unverified.' };
  throw new RangeError('Choose regional traffic or an explicitly configured receiver.');
}
async function boundedText(response, signal) {
  const advertised = response.headers?.get?.('Content-Length');
  if (advertised != null && /^\d+$/.test(advertised) && Number(advertised) > TRAFFIC_LIMITS.responseBytes) throw new RangeError('Receiver response exceeds the 32MiB limit.');
  if (!response.body?.getReader) throw new Error('A readable streaming JSON response is required.');
  const reader = response.body.getReader(), decoder = new TextDecoder(); let bytes = 0, content = '';
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > TRAFFIC_LIMITS.responseBytes) throw new RangeError('Receiver response exceeds the 32MiB limit.');
      content += decoder.decode(value, { stream: true });
    }
    content += decoder.decode(); return content;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

// The transport owns the only network request. Offload JSON parsing and record
// normalization, keeping a bounded main-thread fallback for Worker-less clients.
// Worker failures are explicit: never restart workers or silently parse twice.
export function normalizeTrafficText(text, options, { signal, Worker: WorkerCtor = globalThis.Worker } = {}) {
  if (typeof text !== 'string' || text.length > TRAFFIC_LIMITS.responseBytes) return Promise.reject(new RangeError('Traffic text exceeds the supported response bound.'));
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  if (typeof WorkerCtor !== 'function') {
    try { return Promise.resolve({ ...normalizeTrafficPayload(JSON.parse(text), options), processingMode: 'main-thread-fallback' }); }
    catch (error) { return Promise.reject(error instanceof RangeError ? error : new RangeError('Traffic response is not valid JSON.')); }
  }
  return new Promise((resolve, reject) => {
    let worker = null, finished = false;
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    const finish = (error, result) => {
      if (finished) return;
      finished = true; signal?.removeEventListener('abort', abort);
      if (worker) { worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate(); }
      if (error) reject(error); else resolve(result);
    };
    try {
      worker = new WorkerCtor(new URL('./traffic-worker.js', import.meta.url), { type: 'module', name: 'skylens-traffic-parser' });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      worker.onerror = event => { event?.preventDefault?.(); finish(new RangeError('The traffic processing worker could not run. Reload and retry, or use a browser that permits local module workers.')); };
      worker.onmessageerror = () => finish(new RangeError('The traffic processing worker returned an unreadable result.'));
      worker.onmessage = event => {
        if (finished || event?.data?.id !== 1) return;
        const message = event.data;
        if (message.ok !== true) { finish(new RangeError('Traffic response failed JSON, timestamp or record-bound validation in the worker.')); return; }
        const result = message.result;
        if (!Array.isArray(result?.reports) || result.reports.length > TRAFFIC_LIMITS.rows || !Number.isFinite(result.providerAt) || !Number.isFinite(result.receivedAt)) { finish(new RangeError('The traffic processing worker returned an invalid result.')); return; }
        finish(null, { ...result, processingMode: 'worker' });
      };
      worker.postMessage({ id: 1, text, options });
    } catch { finish(new RangeError('The traffic processing worker could not be started. Reload and retry.')); }
  });
}

const receiverBudgets = new Map(), receiverCooldowns = new Map();
const RECEIVER_BUDGET_KEY = 'skylens.traffic.receiver-requests.v1', RECEIVER_COOLDOWN_KEY = 'skylens.traffic.receiver-cooldowns.v1';
async function receiverKey(url) {
  // Persist only a cryptographic endpoint fingerprint; never the entered URL.
  if (!globalThis.crypto?.subtle) return { memory: url, storage: null };
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
  const hash = [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
  return { memory: hash, storage: hash };
}
function readStored(key, fingerprint) {
  if (!fingerprint) return null;
  try { return JSON.parse(globalThis.localStorage?.getItem(key) || '{}')?.[fingerprint] || null; } catch { return null; }
}
function writeStored(key, fingerprint, value) {
  if (!fingerprint) return;
  try {
    const old = JSON.parse(globalThis.localStorage?.getItem(key) || '{}'), now = Date.now();
    const entries = Object.entries(old || {}).filter(([id, item]) => /^[a-f0-9]{64}$/.test(id) && (Number.isFinite(item) ? item : item?.retryAt) > now).slice(-127);
    const next = Object.fromEntries(entries); next[fingerprint] = value;
    globalThis.localStorage?.setItem(key, JSON.stringify(next));
  } catch { /* Storage failure leaves memory cooldowns intact. */ }
}
function receiverCooldown(key) {
  const memory = receiverCooldowns.get(key.memory), stored = readStored(RECEIVER_COOLDOWN_KEY, key.storage);
  const valid = x => x && Number.isFinite(x.retryAt) && ['limited', 'unavailable'].includes(x.status) && [401, 403, 429].includes(x.httpStatus);
  if (valid(stored) && (!memory || stored.retryAt > memory.retryAt)) return { retryAt: stored.retryAt, status: stored.status, httpStatus: stored.httpStatus };
  return memory || null;
}
function receiverReservation(key, signal) {
  const reserve = () => {
    if (signal.aborted) return { allowed: false, cancelled: true };
    const cooldown = receiverCooldown(key), now = Date.now();
    if (cooldown?.retryAt > now) return { allowed: false, ...cooldown };
    const stored = readStored(RECEIVER_BUDGET_KEY, key.storage);
    const retryAt = Math.max(receiverBudgets.get(key.memory) || 0, Number.isFinite(stored) && stored <= now + 30000 ? stored : 0);
    if (retryAt > now) return { allowed: false, status: 'waiting', retryAt };
    const next = now + TRAFFIC_LIMITS.receiverIntervalMs; receiverBudgets.set(key.memory, next); writeStored(RECEIVER_BUDGET_KEY, key.storage, next);
    return { allowed: true, retryAt: next };
  };
  const locks = globalThis.navigator?.locks;
  return locks?.request && key.storage ? locks.request(`skylens-receiver-request:${key.storage}`, { mode: 'exclusive', signal }, reserve) : reserve();
}

export function createTrafficFeed({ onUpdate, document: doc = globalThis.document } = {}) {
  if (typeof onUpdate !== 'function') throw new TypeError('Traffic updates require a callback.');
  let intent = null, disposed = false, generation = 0, regional = null, request = null, timer = null, timeout = null, interval = TRAFFIC_LIMITS.receiverIntervalMs, pausedByServer = false, key = null;
  const hidden = () => doc?.hidden === true;
  function cancel() { generation++; clearTimeout(timer); clearTimeout(timeout); timer = timeout = null; regional?.stop(); regional = null; request?.abort(); request = null; }
  const coverage = () => intent?.kind === 'regional' ? { kind: 'regional', label: 'Regional query; coverage is not complete.', center: { ...intent.center }, rangeNm: intent.rangeNm }
    : { kind: 'receiver', label: intent?.coverageLabel || 'Source-defined coverage; completeness unverified.' };
  const sourceName = () => intent?.kind === 'regional' ? AIRCRAFT_PROVIDERS[intent.provider].name : intent ? `Receiver · ${new URL(intent.url).hostname}` : 'Traffic';
  function emit(update) { if (!disposed && intent && !hidden()) onUpdate({ reports: [], coverage: coverage(), sourceName: sourceName(), ...update }); }
  function schedule(delay, token) { clearTimeout(timer); if (!disposed && intent && !hidden() && !pausedByServer && token === generation) timer = setTimeout(() => tick(token), Math.max(1, delay)); }
  async function tick(token) {
    if (disposed || !intent || intent.kind !== 'receiver' || hidden() || pausedByServer || token !== generation || request) return;
    const config = intent, controller = request = new AbortController(); let nextInterval = interval;
    const alive = () => !disposed && intent === config && !hidden() && token === generation;
    const valid = () => alive() && !controller.signal.aborted;
    try {
      const reservation = await receiverReservation(key, controller.signal); if (!valid() || reservation.cancelled) return;
      if (!reservation.allowed) { pausedByServer = reservation.status !== 'waiting'; nextInterval = reservation.retryAt - Date.now(); emit(reservation); return; }
      emit({ status: 'loading' });
      timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(config.url, { signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!valid()) return;
      if ([401, 403, 429].includes(response.status)) {
        const value = { status: response.status === 429 ? 'limited' : 'unavailable', httpStatus: response.status, retryAt: Math.max(Date.now() + 1000, retryAfterTime(response.headers?.get?.('Retry-After'))) };
        receiverCooldowns.set(key.memory, value); writeStored(RECEIVER_COOLDOWN_KEY, key.storage, value); pausedByServer = true; emit(value); return;
      }
      if (!response.ok) throw new Error('Receiver HTTP failure.');
      const content = await boundedText(response, controller.signal); if (!valid()) return;
      const normalized = await normalizeTrafficText(content, { schema: config.schema, source: { id: 'receiver', name: sourceName() }, receivedAt: Date.now(), coverage: coverage() }, { signal: controller.signal });
      if (!valid()) return;
      interval = nextInterval = TRAFFIC_LIMITS.receiverIntervalMs; emit({ ...normalized, status: 'ok' });
    } catch (error) {
      if (alive()) { interval = nextInterval = Math.min(interval * 2, 120000); emit({ status: 'error', error: error instanceof RangeError ? error.message : 'Receiver data could not be read. Check HTTPS, CORS, schema and freshness; no proxy or authentication is added.' }); }
    } finally {
      if (token === generation) { clearTimeout(timeout); timeout = null; request = null; schedule(nextInterval, token); }
    }
  }
  async function activate() {
    if (!intent || disposed || hidden() || pausedByServer) return;
    const config = intent, token = generation;
    if (config.kind === 'regional') {
      regional = startPlanes(() => ({ ...config.center }), update => {
        if (disposed || intent !== config || token !== generation || hidden()) return;
        // The regional adapter returns raw lat/lon in addition to sky geometry;
        // retain those reports without treating query center as sky observer.
        const reports = refreshTrafficReports((update.planes || []).map(p => ({ ...p, kind: 'plane', name: p.flight, ground: false,
          motionNote: 'Reported geographic position; the map query center does not change the sky observer.' })), Date.now());
        emit({ ...update, reports, coverage: coverage() });
      }, { provider: config.provider, rangeNm: config.rangeNm });
      return;
    }
    const resolvedKey = await receiverKey(config.url);
    if (intent !== config || token !== generation || disposed || hidden()) return;
    key = resolvedKey; await tick(token);
  }
  function visibility() { if (hidden()) cancel(); else if (intent && !disposed && !pausedByServer) void activate(); }
  doc?.addEventListener?.('visibilitychange', visibility);
  return {
    start(config) {
      if (disposed) throw new Error('This traffic feed has been disposed.');
      // Cancel the previous disclosure before validating a new destination.
      cancel(); intent = null; pausedByServer = false; key = null; interval = TRAFFIC_LIMITS.receiverIntervalMs;
      intent = configValue(config); emit({ status: hidden() ? 'paused' : 'loading' }); return activate();
    },
    stop() { cancel(); intent = null; pausedByServer = false; key = null; },
    dispose() { if (disposed) return; cancel(); intent = null; disposed = true; doc?.removeEventListener?.('visibilitychange', visibility); },
  };
}
