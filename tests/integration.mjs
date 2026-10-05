import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as AE from '../vendor/astronomy.js';
import { parseSimulationTime, normalizePreferences, readPreferences, validLocation, searchCatalogue, createSkyCache, shouldRenderFrame, normalizeSavedLocations, addSavedLocation } from '../js/main.js';
import { fitLabel } from '../js/render.js';
import { engineReady, loadStars, visibleStars, horizontalProjector, computeBodies } from '../js/sky.js';
import { loadConstellations, loadDSOs, constellationFrame, dsoFrame } from '../js/objects.js';
import { startPlanes, retryAfterTime, quotaResetTime } from '../js/planes.js';

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

test('reduced-motion render loop draws immediately, keeps advancing and resumes after suspension', () => {
  let previous = null;
  const drawn = [];
  for (const timestamp of [0, 16, 32, 48, 64, 80, 96]) {
    if (!shouldRenderFrame(timestamp, previous, true)) continue;
    previous = timestamp; drawn.push(timestamp);
  }
  assert.deepEqual(drawn, [0, 32, 64, 96], 'initial timestamp zero must not starve every later frame');
  assert.equal(shouldRenderFrame(110, previous, false), true, 'normal-motion view is not capped');
  previous = null;
  assert.equal(shouldRenderFrame(5000, previous, true), true, 'resume renders without waiting for prior-frame state');
});

test('search covers below-horizon stars and all 110 Messier objects with stable IDs', () => {
  const date = new Date('2026-10-03T21:00:00Z');
  const stars = visibleStars(date, 51.5, -.1, 4.6, -90);
  const dsos = dsoFrame(date, 51.5, -.1, Infinity, -90);
  assert.equal(stars.length, 1022); assert.equal(dsos.length, 110);
  assert.equal(stars.some(s => s.name === 'Sol'), false, 'the solar ephemeris is the only Sun');
  const rawStars = JSON.parse(readFileSync(new URL('../data/stars.json', import.meta.url))).stars;
  const siriusIndex = rawStars.findIndex(s => s[3] === 'Sirius');
  assert.equal(stars.find(s => s.name === 'Sirius').id, `star:${siriusIndex}`, 'excluding Sol must preserve saved IDs');
  const below = stars.find(s => s.name && s.alt < 0);
  const results = searchCatalogue([...stars, ...dsos], below.name, [below.id]);
  assert.equal(results[0].id, below.id); assert.equal(results[0].belowHorizon, true); assert.equal(results[0].favourite, true);
  assert.equal(searchCatalogue(dsos, 'M31')[0].id, 'dso:M31');
});

test('Hindi search and display preferences preserve canonical object identities', () => {
  const bodies = computeBodies(new Date('2026-10-05T12:00:00Z'), 28.6, 77.2);
  for (const query of ['मंगल', 'Mangal', 'Mars']) assert.equal(searchCatalogue(bodies, query)[0].id, 'body:Mars');
  assert.equal(normalizePreferences().nameMode, 'bilingual');
  assert.equal(normalizePreferences({ nameMode: '<script>' }).nameMode, 'bilingual');
  for (const nameMode of ['hi', 'en', 'bilingual']) {
    const prefs = readPreferences({ getItem: () => JSON.stringify({ nameMode, favourites: ['body:Mars'] }) });
    assert.equal(prefs.nameMode, nameMode); assert.deepEqual(prefs.favourites, ['body:Mars']);
  }
});

test('constellations keep their catalogue anchor identity across Hindi search and saved preferences', () => {
  const date = new Date('2026-10-05T12:00:00Z');
  const rows = constellationFrame(date, 28.6, 77.2);
  assert.equal(rows.length, 89);
  const orion = rows.find(row => row.name === 'Orion');
  assert.equal(orion.id, 'const:Ori:59'); assert.equal(orion.kind, 'constellation');
  assert.ok(Number.isFinite(orion.alt) && Number.isFinite(orion.az));
  for (const q of ['Orion', 'ओरायन']) assert.equal(searchCatalogue(rows, q)[0].id, orion.id);
  const prefs = normalizePreferences({ favourites: [orion.id, 'sat:25544', 'const:Ori:59'] });
  assert.deepEqual(prefs.favourites, [orion.id, 'sat:25544']);
  assert.match(orion.description, /label anchor/);
});

test('named observing locations validate, persist and retain zero coordinates', () => {
  const input = [{ id: 'place:test', name: 'दिल्ली', lat: 0, lon: 0 },
    { id: 'place:bad', name: 'Bad latitude', lat: 95, lon: 0 },
    { id: 'place:test', name: 'duplicate ID', lat: 1, lon: 2 }];
  const list = normalizeSavedLocations(input);
  assert.deepEqual(list, [input[0]]);
  assert.deepEqual(readPreferences({ getItem: () => JSON.stringify({ savedLocations: input }) }).savedLocations, list);
  assert.deepEqual(normalizeSavedLocations(null), []);
  assert.equal(addSavedLocation(list, 'दिल्ली', { lat: 20, lon: 30 }, 'place:new').ok, false);
  assert.equal(addSavedLocation(list, '', { lat: 20, lon: 30 }, 'place:new').ok, false);
  assert.equal(addSavedLocation(list, 'x'.repeat(41), { lat: 20, lon: 30 }, 'place:new').ok, false);
  assert.equal(addSavedLocation(list, 'Invalid', { lat: 20, lon: Infinity }, 'place:new').ok, false);
  const result = addSavedLocation(list, 'London', { lat: 51.5, lon: 0 }, 'place:london');
  assert.equal(result.ok, true); assert.equal(result.locations[1].lon, 0); assert.equal(list.length, 1);
  const full = Array.from({ length: 12 }, (_, i) => ({ id: `place:${i}`, name: `Site ${i}`, lat: 0, lon: i }));
  assert.equal(addSavedLocation(full, 'Another', { lat: 0, lon: 0 }, 'place:13').ok, false);
});

test('canvas label shortening keeps complete Devanagari graphemes', () => {
  const segmenter = new Intl.Segmenter('hi', { granularity: 'grapheme' });
  const measure = value => Array.from(segmenter.segment(value)).length;
  assert.equal(fitLabel('शुक्र · Venus', 3, measure), 'शुक्र…');
  assert.equal(fitLabel('सूर्य', 20, measure), 'सूर्य');
  assert.equal(fitLabel('शुक्र', 0, measure), '');
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
  resolveFetch({ ok: true, json: async () => ({ now: Date.now(), ac: [] }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates, 0); globalThis.fetch = oldFetch;
});

test('unknown aircraft altitude is not invented as ground level', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ now: Date.now(), ac: [
    { lat: 40.1, lon: -74, alt_baro: null, hex: 'unknown' },
    { lat: 40.1, lon: -74, alt_baro: 35000, hex: 'valid', flight: '<external>', seen_pos: 1 },
    { lat: 40.1, lon: -74, alt_baro: 35000, hex: 'stale', seen_pos: 200 },
    { lat: 40.1, lon: -74, alt_baro: 35000, hex: 'unknown-age' },
  ] }) });
  let received;
  const poller = startPlanes(() => ({ lat: 40, lon: -74 }), update => { received = update; });
  await new Promise(resolve => setImmediate(resolve)); poller.stop(); globalThis.fetch = oldFetch;
  assert.equal(received.status, 'ok'); assert.equal(received.planes.length, 1); assert.equal(received.planes[0].id, 'plane:valid');
});

test('stale or malformed aircraft payloads never become fresh on receipt', async () => {
  const oldFetch = globalThis.fetch;
  try {
    for (const payload of [
      { now: Date.now() - 120000, ac: [{ lat: 40.1, lon: -74, alt_baro: 35000, hex: 'old', seen_pos: 1 }] },
      { now: Date.now() + 120000, ac: [] }, { ac: [] }, { now: Date.now() }, null,
    ]) {
      globalThis.fetch = async () => ({ ok: true, json: async () => payload });
      let received;
      const poller = startPlanes(() => ({ lat: 40, lon: -74 }), update => { received = update; });
      await new Promise(resolve => setImmediate(resolve)); poller.stop();
      assert.equal(received.status, 'error'); assert.deepEqual(received.planes, []);
    }
  } finally { globalThis.fetch = oldFetch; }
});

test('aircraft position freshness combines payload delay with per-position age', async () => {
  const oldFetch = globalThis.fetch, providerAt = Date.now() - 55000;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ now: providerAt, ac: [
    { lat: 40.1, lon: -74, alt_baro: 35000, hex: '115-seconds', seen_pos: 60 },
    { lat: 40.1, lon: -74, alt_baro: 35000, hex: '56-seconds', seen_pos: 1 },
  ] }) });
  let received;
  const poller = startPlanes(() => ({ lat: 40, lon: -74 }), value => { received = value; });
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(received.status, 'ok'); assert.equal(received.planes.length, 1);
    assert.equal(received.planes[0].id, 'plane:56-seconds');
    assert.equal(received.planes[0].positionAt, providerAt - 1000);
  } finally { poller.stop(); globalThis.fetch = oldFetch; }
});

test('aircraft quota metadata uses reset durations and pauses instead of retrying a daily limit', async () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  assert.equal(retryAfterTime('60', now), now + 60000);
  assert.equal(retryAfterTime('Mon, 05 Oct 2026 12:02:00 GMT', now), now + 120000);
  assert.equal(retryAfterTime(null, now), now + 15 * 60000);
  assert.equal(quotaResetTime(new Headers({ 'Retry-After': '10', 'X-RateLimit-Reset': '3600' }), now), now + 3600000);
  const oldFetch = globalThis.fetch;
  let requests = 0, update;
  globalThis.fetch = async () => { requests++; return { status: 429, headers: new Headers({ 'Retry-After': '3600' }) }; };
  const poller = startPlanes(() => ({ lat: 51.5, lon: 0 }), value => { update = value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(update.status, 'limited'); assert.deepEqual(update.planes, []); assert.ok(update.retryAt > Date.now());
  poller.stop();
  const retry = startPlanes(() => ({ lat: 51.5, lon: 0 }), value => { update = value; });
  assert.equal(requests, 1, 'toggling cannot bypass the server retry window');
  assert.equal(update.status, 'limited'); retry.stop(); globalThis.fetch = oldFetch;
});
