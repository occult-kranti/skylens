// Offline fixtures only: no live aircraft requests or personal observer location.
import test from 'node:test';
import assert from 'node:assert/strict';
import { geodeticToECEF, ecefToENU, aircraftLook, groundDistanceM, projectAircraft } from '../js/aircraft-geometry.js';
import { parseAircraftPayload, refreshAircraftPositions, AIRCRAFT_PROVIDERS, quotaResetTime } from '../js/planes.js';

const AT = Date.parse('2026-10-05T22:00:00Z'), observer = { lat: 0, lon: 0 };
const row = (patch = {}) => ({ hex: 'abc123', flight: 'TEST1 ', lat: 0.05, lon: 0.05, alt_geom: 10000, alt_baro: 30000, seen_pos: 0, gs: 360, track: 90, geom_rate: 600, ...patch });
const payload = (patch = {}) => ({ now: AT, ac: [row()], ...patch });
const parse = (value, options = {}) => parseAircraftPayload(value, observer, { receivedAt: AT, ...options });
const near = (actual, expected, tolerance, name = '') => assert.ok(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} != ${expected} within ${tolerance}`);

test('WGS84 Cartesian conversion matches the independently published EPSG North Sea example', () => {
  // EPSG Guidance Note7-2 example, EPSG9603 datum-translation example published
  // at https://epsg.io/9603-method; inputs in EPSG9602 example (checked2026-10-05).
  const xyz = geodeticToECEF(53 + 48/60 + 33.82/3600, 2 + 7/60 + 46.38/3600, 73);
  near(xyz.x, 3771793.97, .01, 'X'); near(xyz.y, 140253.34, .01, 'Y'); near(xyz.z, 5124304.35, .01, 'Z');
  const equator = geodeticToECEF(0, 0), pole = geodeticToECEF(90, 0);
  near(equator.x, 6378137, 1e-8); near(pole.z, 6356752.314245, 1e-6);
  assert.throws(() => geodeticToECEF(NaN, 0)); assert.throws(() => geodeticToECEF(0, 181));
});

test('ESA ENU cardinal axes, true zenith/nadir and coincident points have explicit limits', () => {
  // At equator/Greenwich: ECEF+Y is east, +Z north, +X up. This independent
  // limiting case detects longitude-sign or matrix-transposition mistakes.
  assert.deepEqual(ecefToENU({ x: 3, y: 4, z: 5 }, 0, 0), { east: 4, north: 5, up: 3 });
  near(ecefToENU({ x: 0, y: 0, z: 100 }, 90, 0).up, 100, 1e-9);
  const zenith = aircraftLook({ lat: 35, lon: 139, heightM: 50 }, { lat: 35, lon: 139, heightM: 1200 });
  near(zenith.alt, 90, 1e-7); near(zenith.slantKm, 1.15, 1e-9); assert.equal(zenith.azimuthDefined, false);
  assert.equal(zenith.observerHeightKind, 'provided-ellipsoid');
  const assumed = aircraftLook(observer, { lat: 0, lon: 0, heightM: 1000 });
  assert.equal(assumed.observerHeightKind, 'assumed-zero');
  near(aircraftLook({ ...observer, heightM: 1000 }, { ...observer, heightM: 500 }).alt, -90, 1e-8);
  assert.equal(aircraftLook(observer, { ...observer, heightM: 0 }).alt, null);
  const east = aircraftLook(observer, { lat: 0, lon: .1, heightM: 0 });
  near(east.az, 90, 1e-8); near(east.alt, -.05, 1e-7, 'Earth-curvature horizon');
});

test('Ground distances obey WGS84 equatorial arc and independent meridian reference values', () => {
  // Standard WGS84 geodesic inverse reference values (GeographicLib/PROJ),
  // equator independently follows a*pi/180; metre tolerance covers rounding.
  near(groundDistanceM(observer, { lat: 0, lon: 1 }), 111319.490793, .001);
  near(groundDistanceM(observer, { lat: 1, lon: 0 }), 110574.388558, .001);
  near(groundDistanceM({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }), 22263.898159, .001);
  assert.equal(groundDistanceM(observer, observer), 0);
  assert.equal(groundDistanceM(observer, { lat: 0, lon: 180 }), Infinity, 'antipodal nonconvergence must not invent a distance');
});

test('Provider timestamp units are explicit and never inferred from receipt time', () => {
  const v2 = parse(payload()).planes[0];
  const readsb = parse({ now: AT / 1000, aircraft: [row()] }, { schema: 'readsb-aircraft-json' }).planes[0];
  assert.equal(v2.positionAt, readsb.positionAt); assert.equal(v2.providerAt, AT);
  assert.throws(() => parse({ now: AT / 1000, ac: [row()] }), /stale/);
  assert.throws(() => parse({ now: AT, aircraft: [row()] }, { schema: 'readsb-aircraft-json' }), /stale/);
  for (const value of [null, { ac: [] }, { now: AT }, { now: 'bad', ac: [] }, { now: AT, ac: Array(20001).fill(null) }]) assert.throws(() => parse(value));
  assert.deepEqual(parse(payload({ ac: [] })).planes, [], 'valid empty coverage is allowed');
});

test('Combined payload and per-position age, future clocks and range are strictly bounded', () => {
  assert.equal(parse(payload({ now: AT - 55000, ac: [row({ seen_pos: 6 })] })).planes.length, 0);
  assert.equal(parse(payload({ now: AT - 55000, ac: [row({ seen_pos: 5 })] })).planes.length, 1);
  assert.throws(() => parse(payload({ now: AT - 60001 })), /stale/);
  assert.throws(() => parse(payload({ now: AT + 5001 })), /stale/);
  assert.equal(parse(payload({ now: AT + 1000 })).clockSkewMs, 1000);
  for (const seen_pos of [null, -1, 61, Infinity, '1']) assert.equal(parse(payload({ ac: [row({ seen_pos })] })).planes.length, 0);
  assert.equal(parse(payload({ ac: [row({ lat: 10 })] })).planes.length, 0);
  assert.throws(() => parse(payload(), { rangeNm: 251 })); assert.throws(() => parse(payload(), { rangeNm: 0 }));
  for (const provider of ['unknown', '__proto__', 'constructor', null]) assert.throws(() => parse(payload(), { provider }));
});

test('Geometric feet are preferred, barometric height is labelled, and ground/rough fixes are excluded', () => {
  const p = parse(payload()).planes[0];
  assert.equal(p.altitudeKind, 'geometric-wgs84'); assert.equal(p.altFt, 10000); assert.equal(p.altM, 3048);
  const b = parse(payload({ ac: [row({ alt_geom: null })] })).planes[0];
  assert.equal(b.altitudeKind, 'barometric-approximate'); assert.match(b.altitudeNote, /Pressure altitude/); assert.equal(b.altM, 9144);
  for (const patch of [{ alt_geom: null, alt_baro: null }, { alt_baro: 'ground' }, { lat: undefined, lastPosition: { lat: 0, lon: 0 }, rr_lat: 0, rr_lon: 0 }]) assert.equal(parse(payload({ ac: [row(patch)] })).planes.length, 0);
  const meta = parse(payload({ ac: [row({ type: 'mlat', mlat: ['lat', 'lon'], r: 'N12345', t: 'A320', nac_p: 9 })] })).planes[0];
  assert.equal(meta.aircraftType, 'A320'); assert.equal(meta.registration, 'N12345'); assert.deepEqual(meta.mlat, ['lat', 'lon']); assert.equal(meta.integrity.nac_p, 9);
});

test('Anonymous Avio range stops at 100nm while adsb.fi retains its documented 250nm bound', () => {
  assert.equal(AIRCRAFT_PROVIDERS.avioadsb.maxRangeNm, 100);
  assert.equal(AIRCRAFT_PROVIDERS.adsbfi.maxRangeNm, 250);
  assert.doesNotThrow(() => parse(payload(), { provider: 'avioadsb', rangeNm: 100 }));
  for (const rangeNm of [100.001, 101, 250]) assert.throws(() => parse(payload(), { provider: 'avioadsb', rangeNm }), /1–100/);
  // A point approximately334km away is outside100nm but inside250nm.
  const distant = payload({ ac: [row({ lat: 0, lon: 3 })] });
  assert.equal(parse(distant, { provider: 'adsbfi', rangeNm: 250 }).planes.length, 1);
  assert.equal(parse(distant, { provider: 'avioadsb', rangeNm: 100 }).planes.length, 0);
  assert.throws(() => parse(distant, { provider: 'adsbfi', rangeNm: 250.001 }), /1–250/);
});

test('Constant true-track velocity is bounded at 15s, never compounded and pauses without backward snap', () => {
  const p = parse(payload({ ac: [row({ lat: 0, lon: 0, geom_rate: 0 })] })).planes[0];
  const east = projectAircraft(p, observer, AT + 10000);
  assert.equal(east.positionMode, 'extrapolated'); assert.equal(east.extrapolatedSeconds, 10);
  //360kt =185.2m/s exactly; in10s the ECEF tangent displacement is1852m.
  near(east.projectedLat, 0, 1e-10); near(east.az, 90, 1e-6);
  near(geodeticToECEF(east.projectedLat, east.projectedLon, east.projectedAltitudeM).y, 1852, 1e-6);
  assert.equal(east.positionAt, AT); assert.equal(east.lon, 0, 'raw report coordinates stay immutable');
  assert.deepEqual(projectAircraft(east, observer, AT + 10000), east, 'reprojection cannot integrate twice');
  const capped = projectAircraft(p, observer, AT + 15000), paused = projectAircraft(p, observer, AT + 16000);
  assert.equal(paused.positionMode, 'estimate-paused'); assert.equal(paused.projectedLon, capped.projectedLon);
  assert.equal(projectAircraft(p, observer, AT + 20000).overlayEligible, true);
  assert.equal(projectAircraft(p, observer, AT + 20001).overlayEligible, false);
  assert.ok(projectAircraft(p, observer, AT + 60000)); assert.equal(projectAircraft(p, observer, AT + 60001), null);
  assert.equal(refreshAircraftPositions([p], observer, AT + 60001).length, 0);
});

test('Missing or invalid velocity never invents direction; vertical rates use their altitude convention', () => {
  for (const patch of [{ gs: null }, { gs: 1600 }, { track: null }, { track: 360 }, { track: -1 }]) {
    const p = parse(payload({ ac: [row(patch)] })).planes[0];
    const later = projectAircraft(p, observer, AT + 10000); assert.equal(later.positionMode, 'reported');
  }
  const p = parse(payload({ ac: [row({ gs: 0, track: 0, geom_rate: 600, baro_rate: -6000 })] })).planes[0];
  near(projectAircraft(p, observer, AT + 10000).projectedAltitudeM - p.altM, 30.48, 1e-6);
  assert.equal(p.verticalRateFpm, 600);
});

const flush = () => new Promise(resolve => setImmediate(resolve));
let sequence = 0;
async function fixture(fn) {
  const saved = Object.fromEntries(['fetch', 'setTimeout', 'clearTimeout', 'document', 'localStorage'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const time = Date.now; let now = AT;
  const jobs = new Map(), storage = new Map(), controllers = []; let jobId = 0;
  const doc = new EventTarget(); doc.hidden = false;
  const state = { jobs, storage, doc, setNow: value => { now = value; }, requests: [] };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) } });
  globalThis.setTimeout = (fn, ms) => { jobs.set(++jobId, { fn, ms }); return jobId; };
  globalThis.clearTimeout = id => jobs.delete(id); Date.now = () => now;
  state.importFresh = async () => {
    const module = await import(`../js/planes.js?aircraft-test=${++sequence}`);
    return { ...module, startPlanes(...args) { const controller = module.startPlanes(...args); controllers.push(controller); return controller; } };
  };
  globalThis.fetch = async (url, options) => { state.requests.push({ url, options }); return { ok: true, status: 200, headers: new Headers(), json: async () => payload() }; };
  try { await fn(state); } finally {
    controllers.forEach(controller => controller.stop());
    Date.now = time;
    for (const [k, desc] of Object.entries(saved)) { if (desc) Object.defineProperty(globalThis, k, desc); else delete globalThis[k]; }
  }
}

test('Requests omit credentials, reject redirects, use selected provider cadence, and stop all timers', () => fixture(async s => {
  for (const provider of ['avioadsb', 'adsbfi']) {
    const { startPlanes } = await s.importFresh(); let update;
    const poller = startPlanes(() => observer, value => { update = value; }, { provider, rangeNm: 25 });
    await flush();
    const req = s.requests.at(-1); assert.equal(req.options.credentials, 'omit'); assert.equal(req.options.redirect, 'error');
    assert.equal(req.options.cache, 'no-store'); assert.ok(req.url.endsWith('/25'));
    assert.ok(req.url.startsWith(AIRCRAFT_PROVIDERS[provider].endpoint)); assert.equal(update.status, 'ok');
    assert.ok([...s.jobs.values()].some(j => j.ms === AIRCRAFT_PROVIDERS[provider].intervalMs));
    poller.stop(); assert.equal(s.jobs.size, 0);
  }
}));

test('Hidden and stopped feeds never read location; pending completions cannot write after hide/stop', () => fixture(async s => {
  const { startPlanes } = await s.importFresh(); let locations = 0, updates = 0, finish, signal;
  s.doc.hidden = true;
  globalThis.fetch = (_url, opts) => { signal = opts.signal; return new Promise(resolve => { finish = resolve; }); };
  const poller = startPlanes(() => { locations++; return observer; }, () => { updates++; });
  assert.equal(locations, 0); assert.equal(s.jobs.size, 0);
  s.doc.hidden = false; s.doc.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(locations, 1);
  s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange')); assert.equal(signal.aborted, true); assert.equal(s.jobs.size, 0);
  finish({ ok: true, json: async () => payload() }); await flush(); assert.equal(updates, 0);
  s.setNow(AT + 12000);
  s.doc.hidden = false; s.doc.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(locations, 2);
  poller.stop(); assert.equal(signal.aborted, true); finish({ ok: true, json: async () => payload() }); await flush();
  s.doc.dispatchEvent(new Event('visibilitychange')); assert.equal(locations, 2); assert.equal(updates, 0); assert.equal(s.jobs.size, 0);
}));

test('401/403/429 pause persistently across controller/module restart without storing a location', () => fixture(async s => {
  for (const status of [401, 403, 429]) {
    s.setNow(AT + (status - 400) * 86400000); s.storage.clear(); let requests = 0, update;
    globalThis.fetch = async () => { requests++; return { ok: false, status, headers: new Headers({ 'Retry-After': '3600' }) }; };
    const a = await s.importFresh();
    const first = a.startPlanes(() => ({ lat: 37.123456, lon: 121.987654 }), value => { update = value; });
    await flush(); assert.equal(update.status, status === 429 ? 'limited' : 'unavailable'); assert.equal(update.httpStatus, status);
    first.stop(); assert.equal(s.jobs.size, 0);
    const serialized = [...s.storage.values()].join(''); assert.ok(!serialized.includes('37.123456') && !serialized.includes('121.987654'));
    const b = await s.importFresh(); let locations = 0;
    const second = b.startPlanes(() => { locations++; return observer; }, value => { update = value; });
    await flush();
    assert.equal(requests, 1); assert.equal(locations, 0); assert.equal(update.httpStatus, status); second.stop();
  }
  assert.equal(quotaResetTime(new Headers({ 'Retry-After': '60', 'X-RateLimit-Reset': '3600' }), AT, 'avioadsb'), AT + 3600000);
  assert.equal(quotaResetTime(new Headers({ 'Retry-After': '60', 'X-RateLimit-Reset': '3600' }), AT, 'adsbfi'), AT + 60000);
}));

test('Invalid observer, malformed JSON and network failure cannot leak coordinates through error output', () => fixture(async s => {
  const { startPlanes } = await s.importFresh(); let called = 0, update;
  globalThis.fetch = async () => { called++; throw new Error('SECRET provider body coordinates37.123'); };
  let poller = startPlanes(() => ({ lat: NaN, lon: 0 }), value => { update = value; }); await flush();
  assert.equal(called, 0); assert.equal(update.status, 'location-needed'); poller.stop();
  s.setNow(AT + 12000);
  poller = startPlanes(() => observer, value => { update = value; }); await flush();
  assert.equal(update.status, 'error'); assert.ok(!JSON.stringify(update).includes('SECRET')); assert.ok([...s.jobs.values()].some(j => j.ms === 24000)); poller.stop();
  globalThis.fetch = async () => ({ ok: true, json: async () => { throw new Error('InvalidJSON'); } });
  s.setNow(AT + 24000);
  poller = startPlanes(() => observer, value => { update = value; }); await flush(); assert.equal(update.status, 'error'); poller.stop();
  assert.equal(s.jobs.size, 0);
}));
