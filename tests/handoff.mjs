import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSkyHandoff, buildSkyHandoff } from '../js/handoff.js';
import { captureSkyObservation, resolveHandoffObject } from '../js/main.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/sky-handoff-v1.json', import.meta.url))).cases;
const moon = fixtures[0];
const hash = record => new URL(buildSkyHandoff(record, 'studio')).hash;
test('shared fixtures round-trip across both fixed project destinations with fragment-only inputs', () => {
  for (const record of fixtures) for (const target of ['studio', 'skylens']) {
    const url = new URL(buildSkyHandoff(record, target));
    assert.equal(url.origin, 'https://occult-kranti.github.io');
    assert.equal(url.search, '');
    assert.equal(url.pathname, target === 'studio' ? '/astrology-sim-ant/pages/studio.html' : '/skylens/');
    assert.deepEqual(parseSkyHandoff(url.hash), record);
    assert.equal(url.pathname + url.search, target === 'studio' ? '/astrology-sim-ant/pages/studio.html' : '/skylens/', 'HTTP request target contains no coordinates');
  }
  assert.equal(parseSkyHandoff(''), null);
  assert.equal(parseSkyHandoff('#wb-p-figure'), null);
  assert.throws(() => buildSkyHandoff(moon, 'https://example.test/'));
});
test('DST folds and date-line offsets normalize to exact instants without inferring civil time zones', () => {
  const early = parseSkyHandoff(hash({ ...moon, dateISO: '2026-11-01T01:30:00-04:00' }));
  const late = parseSkyHandoff(hash({ ...moon, dateISO: '2026-11-01T01:30:00-05:00' }));
  assert.equal(early.dateISO, '2026-11-01T05:30:00.000Z');
  assert.equal(late.dateISO, '2026-11-01T06:30:00.000Z');
  const apia = parseSkyHandoff(hash({ ...fixtures[2], dateISO: '2026-10-05T13:00:00+13:00' }));
  assert.equal(apia.dateISO, fixtures[2].dateISO);
  assert.equal(Object.hasOwn(apia, 'timeZone'), false);
  assert.equal(Object.hasOwn(apia, 'utcOffset'), false);
});
test('invalid dates and precision outside the shared whole-second range are rejected', () => {
  for (const dateISO of ['1899-12-31T23:59:59Z', '2101-01-01T00:00:00Z', '2026-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-10-05T24:00:00Z', '2026-10-05T12:00:60Z', '2026-10-05T12:00Z', '2026-10-05T12:00:00', '2026-10-05T12:00:00.001Z', '2026-10-05T12:00:00+24:00']) assert.throws(() => buildSkyHandoff({ ...moon, dateISO }, 'studio'), undefined, dateISO);
  assert.throws(() => parseSkyHandoff(hash(moon).replace('12%3A34%3A56Z', '12%3A34%3A56%2B00%3A00')));
});
test('duplicates, unknown fields, malformed encodings and incomplete object records fail closed', () => {
  for (const tail of ['&lat=0', '&skyMode=current', '&returnTo=https%3A%2F%2Fevil.test', '&camera=on', '&__proto__=bad']) assert.throws(() => parseSkyHandoff(hash(moon) + tail));
  for (const fragment of ['#skyV=2', '#skyAt=2026-10-05T12:00:00Z', hash(moon).replace('skyV=1', 'skyV=9'), hash(moon).replace('Moon', '%C0'), hash(moon) + '&bad=%', '#skyV=1&skyName=' + 'x'.repeat(1600)]) assert.throws(() => parseSkyHandoff(fragment));
  const p = new URLSearchParams(hash(moon).slice(1)); p.delete('skyKind');
  assert.throws(() => parseSkyHandoff('#' + p));
});
test('coordinate bounds, categories, identity and string limits are enforced', () => {
  for (const patch of [{ lat: '' }, { lat: NaN }, { lon: Infinity }, { lat: 90.0001 }, { lon: -180.1 }, { mode: 'live' }, { locationSource: 'gps' }, { names: 'unsafe' }, { birth: {} }, { object: { id: 'const:Ser:75', name: 'Moon', kind: 'moon' } }, { object: { ...moon.object, name: 'x'.repeat(101) } }, { object: { ...moon.object, name: 'Moon\nInjected' } }, { object: { ...moon.object, id: 'javascript:alert' } }]) assert.throws(() => buildSkyHandoff({ ...moon, ...patch }, 'studio'));
  for (const raw of ['', 'NaN', 'Infinity', '0x10', ' 0']) {
    const p = new URLSearchParams(hash(moon).slice(1)); p.set('lat', raw);
    assert.throws(() => parseSkyHandoff('#' + p));
  }
  assert.equal(parseSkyHandoff(hash({ ...moon, lat: 1e-7 })).lat, 1e-7);
});
test('capture uses the actual supplied details object and excludes unrelated device/private state', () => {
  const state = { loc: { lat: 28.6139, lon: 77.209, source: 'manual', name: 'Private home' }, nameMode: 'hi', selectedTime: null,
    selectedId: 'body:Sun', sensor: { heading: 20 }, mode: 'ar', camera: 'on', savedNotes: 'private note' };
  const now = Date.parse('2026-10-05T12:34:56.789Z');
  assert.deepEqual(captureSkyObservation(state, moon.object, now), moon);
  assert.equal(captureSkyObservation(state, null, now).object, null, 'global moment action does not reuse a previous guidance target');
  const simulated = captureSkyObservation({ ...state, selectedTime: '2026-10-04T00:00:00.900Z' }, moon.object, now);
  assert.equal(simulated.dateISO, '2026-10-04T00:00:00.000Z'); assert.equal(simulated.mode, 'simulated');
  assert.equal(captureSkyObservation({ ...state, loc: { ...state.loc, source: 'demo (New York)' } }, null, now).locationSource, 'demo');
  assert.doesNotMatch(JSON.stringify(captureSkyObservation(state, moon.object, now)), /Private home|private note|heading|camera|savedNotes/);
});
test('reordered catalogue IDs resolve only a unique matching name/category; Serpens parts remain distinct', () => {
  const caput = fixtures[2].object, cauda = fixtures[3].object;
  const catalogue = [{ ...caput, id: 'const:Ser:95', alt: 10, az: 20 }, { ...cauda, id: 'const:Ser:96', alt: -20, az: 45 }];
  assert.equal(resolveHandoffObject(caput, catalogue).name, 'Serpens Caput');
  assert.equal(resolveHandoffObject(cauda, catalogue).name, 'Serpens Cauda');
  assert.equal(resolveHandoffObject({ ...moon.object, id: 'body:Moon', name: 'Unknown' }, [moon.object]), null);
  assert.equal(resolveHandoffObject({ ...moon.object, id: 'body:Sun' }, [moon.object]), null, 'stable body IDs cannot be overridden by a different name');
  assert.equal(resolveHandoffObject({ ...moon.object, id: 'body:unknown' }, [moon.object, { ...moon.object, id: 'body:other' }]), null);
  assert.equal(resolveHandoffObject(null, catalogue), null);
});
