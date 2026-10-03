import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as AE from '../vendor/astronomy.js';
import { parseSimulationTime, normalizePreferences, readPreferences, validLocation, searchCatalogue, createSkyCache } from '../js/main.js';
import { engineReady, loadStars, visibleStars, horizontalProjector, computeBodies } from '../js/sky.js';
import { loadConstellations, loadDSOs, constellationFrame, dsoFrame } from '../js/objects.js';
import { startPlanes } from '../js/planes.js';

await engineReady;
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(readFileSync(resolve(new URL('..', import.meta.url).pathname, url), 'utf8')) });
await Promise.all([loadStars(), loadConstellations(), loadDSOs()]);
globalThis.fetch = originalFetch;

test('simulation time is explicit UTC and rejects rollover / unsupported dates', () => {
  assert.equal(parseSimulationTime('2026-10-03T12:30'), '2026-10-03T12:30:00.000Z');
  assert.equal(parseSimulationTime('2026-10-03T12:30:00+05:30'), '2026-10-03T07:00:00.000Z');
  assert.equal(parseSimulationTime(null), null);
  for (const value of ['2026-02-29T12:00', '2026-04-31T12:00', '2026-10-03T24:00', '2026-10-03T11:60', '1899-01-01T00:00', '2101-01-01T00:00', 'tomorrow']) {
    assert.throws(() => parseSimulationTime(value), undefined, value);
  }
  assert.equal(parseSimulationTime('2000-02-29T12:00'), '2000-02-29T12:00:00.000Z');
});

test('invalid URL/saved numeric values never become plausible observer positions', () => {
  assert.equal(validLocation({ lat: NaN, lon: 0 }), false);
  assert.equal(validLocation({ lat: 91, lon: 0 }), false);
  assert.equal(validLocation({ lat: 0, lon: -180 }), true);
  const p = normalizePreferences({ loc: { lat: '10', lon: 0 }, fov: Infinity, headingOffset: 999, selectedTime: 'bad' });
  assert.match(p.loc.source, /^demo/); assert.equal(p.fov, 70); assert.equal(p.headingOffset, 180); assert.equal(p.selectedTime, null);
});

test('saved preferences survive reload; blocked/corrupt storage has a usable fallback', () => {
  const p = { loc: { lat: 0, lon: 0, source: 'manual' }, favourites: ['body:Moon', 'body:Moon', '<script>'], selectedTime: '2000-01-01T12:00Z', night: true };
  const loaded = readPreferences({ getItem: () => JSON.stringify(p) });
  assert.equal(loaded.loc.lat, 0); assert.equal(loaded.night, true); assert.deepEqual(loaded.favourites, ['body:Moon']);
  assert.equal(loaded.selectedTime, '2000-01-01T12:00:00.000Z');
  assert.match(readPreferences({ getItem() { throw new Error('denied'); } }).loc.source, /^demo/);
  assert.match(readPreferences({ getItem: () => '{' }).loc.source, /^demo/);
});

test('cache separates sensor frames from one-second sky recomputation and invalidates inputs', () => {
  let calls = 0;
  const cache = createSkyCache(() => ({ generation: ++calls }));
  const loc = { lat: 10, lon: 20 }, settings = { magLimit: 4.6, refraction: false };
  const t = Date.parse('2026-10-03T12:00:00Z');
  for (let frame = 0; frame < 60; frame++) cache.get(new Date(t + frame * 16), loc, settings);
  assert.equal(calls, 1);
  cache.get(new Date(t + 1000), loc, settings); assert.equal(calls, 2);
  cache.get(new Date(t + 1000), { ...loc, lon: 21 }, settings); assert.equal(calls, 3);
  cache.get(new Date(t + 1000), loc, { ...settings, refraction: true }); assert.equal(calls, 4);
  cache.get(new Date(t + 1000), loc, settings, true); assert.equal(calls, 5);
});

test('search covers below-horizon stars and all 110 Messier objects with stable IDs', () => {
  const date = new Date('2026-10-03T21:00:00Z');
  const stars = visibleStars(date, 51.5, -.1, 4.6, -90);
  const dsos = dsoFrame(date, 51.5, -.1, Infinity, -90);
  assert.equal(stars.length, 1023); assert.equal(dsos.length, 110);
  const below = stars.find(s => s.name && s.alt < 0);
  const results = searchCatalogue([...stars, ...dsos], below.name, [below.id]);
  assert.equal(results[0].id, below.id); assert.equal(results[0].belowHorizon, true); assert.equal(results[0].favourite, true);
  assert.equal(searchCatalogue(dsos, 'M31')[0].id, 'dso:M31');
});

test('shared J2000 matrix adapter agrees with Astronomy Engine public vector API', () => {
  // Adapter/frame-convention regression; not an independent ephemeris accuracy claim.
  for (const iso of ['1900-01-01T00:00:00Z', '2026-10-03T21:00:00Z', '2100-01-01T12:00:00Z']) {
    const date = new Date(iso), observer = new AE.Observer(-30, 179.9, 0), ra = 6.752477, dec = -16.716116;
    const vec = AE.VectorFromSphere(new AE.Spherical(dec, ra * 15, 1), date);
    const expected = AE.HorizonFromVector(AE.RotateVector(AE.Rotation_EQJ_HOR(date, observer), vec), null);
    const actual = horizontalProjector(date, -30, 179.9)(ra, dec);
    assert.ok(Math.abs(actual.alt - expected.lat) < 1e-9); assert.ok(Math.abs(actual.az - expected.lon) < 1e-9);
  }
});

test('time exploration updates stars, planets and constellation positions together', () => {
  const a = new Date('2026-10-03T00:00Z'), b = new Date('2026-10-03T06:00Z');
  const starA = visibleStars(a, 40, -74, 4.6, -90)[0], starB = visibleStars(b, 40, -74, 4.6, -90)[0];
  assert.equal(starA.id, starB.id); assert.ok(Math.abs(starA.alt - starB.alt) > 1);
  assert.ok(Math.abs(computeBodies(a, 40, -74)[0].alt - computeBodies(b, 40, -74)[0].alt) > 1);
  assert.notDeepEqual(constellationFrame(a, 40, -74)[0].segs, constellationFrame(b, 40, -74)[0].segs);
});

test('stopping aircraft aborts pending location request and suppresses late updates', async () => {
  let requestSignal, resolveFetch, updates = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => { requestSignal = options.signal; return new Promise(resolve => { resolveFetch = resolve; }); };
  const poller = startPlanes(() => ({ lat: 40, lon: -74 }), () => { updates++; });
  assert.equal(requestSignal.aborted, false); poller.stop(); assert.equal(requestSignal.aborted, true);
  resolveFetch({ ok: true, json: async () => ({ ac: [] }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates, 0); globalThis.fetch = oldFetch;
});

test('unknown aircraft altitude is not invented as ground level', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ac: [
    { lat: 40.1, lon: -74, alt_baro: null, hex: 'unknown' },
    { lat: 40.1, lon: -74, alt_baro: 35000, hex: 'valid', flight: '<external>', seen_pos: 1 },
    { lat: 40.1, lon: -74, alt_baro: 35000, hex: 'stale', seen_pos: 200 },
  ] }) });
  let received;
  const poller = startPlanes(() => ({ lat: 40, lon: -74 }), update => { received = update; });
  await new Promise(resolve => setImmediate(resolve)); poller.stop(); globalThis.fetch = oldFetch;
  assert.equal(received.status, 'ok'); assert.equal(received.planes.length, 1); assert.equal(received.planes[0].id, 'plane:valid');
});
