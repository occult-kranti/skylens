import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as S from '../vendor/satellite.esm.js';
import * as AE from '../vendor/astronomy.js';
import { loadRecsFromList, propagateNow, satMeta, parseOMM, ommEpoch, observingCandidate, MAX_RECORDS } from '../js/satellites.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/vallado-sgp4.json', import.meta.url)));
const [ISS] = JSON.parse(readFileSync(new URL('./fixtures/iss-omm.json', import.meta.url)));
const legacyISS = JSON.parse(readFileSync(new URL('../data/tle-snapshot.json', import.meta.url))).satellites[0];
const date = new Date(ISS.EPOCH + 'Z');
const xyz = vector => [vector.x, vector.y, vector.z];
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const engine = () => { globalThis.window = { satellite: S }; };
engine();

test('vendored 7.1.0 sources have pinned output hashes and no WASM graph', () => {
  const manifest = JSON.parse(readFileSync(new URL('../vendor/satellite/upstream.json', import.meta.url)));
  assert.equal(manifest.version, '7.1.0');
  assert.equal(manifest.commit, '582a72ecf9cb22fd3c210f1e497d8565517f1d6d');
  for (const file of manifest.files) {
    const source = readFileSync(new URL(`../vendor/satellite/${file.output}`, import.meta.url));
    assert.equal(createHash('sha256').update(source).digest('hex'), file.sha256, file.output);
    assert.doesNotMatch(source.toString(), /(?:from\s*|import\s*\()['"][^'"]*(?:wasm|https?:)/);
  }
});

test('published Vallado TEME near-Earth and deep-space vectors, including backward propagation', () => {
  for (const row of fixture.cases) for (const sample of row.samples) {
    const state = S.sgp4(S.twoline2satrec(row.l1, row.l2), sample.minutes);
    assert.ok(state, `${row.catalogueId}: ${sample.minutes}`);
    xyz(state.position).forEach((v, i) => near(v, sample.position[i], 1e-5, 'TEME position km'));
    xyz(state.velocity).forEach((v, i) => near(v, sample.velocity[i], 1e-8, 'TEME velocity km/s'));
  }
});

test('published decayed MINOTAUR case fails instead of rendering an invented position', () => {
  const c = fixture.decayCase, record = S.twoline2satrec(c.l1, c.l2);
  assert.equal(S.sgp4(record, c.minutes), null);
  assert.equal(record.error, c.expectedError);
  engine(); loadRecsFromList([{ name: 'MINOTAUR verification case', l1: c.l1, l2: c.l2 }]);
  const when = new Date((record.jdsatepoch - 2440587.5) * 86400000 + c.minutes * 60000);
  assert.deepEqual(propagateNow(when, 0, 0, -90), []);
  assert.equal(satMeta().failed, 1);
});

test('OMM and genuine legacy TLE agree within 20 m despite millisecond epoch truncation', () => {
  const a = S.twoline2satrec(legacyISS.l1, legacyISS.l2), b = S.json2satrec(ISS);
  for (const hours of [-24, 0, 24]) {
    const when = new Date(date.getTime() + hours * 3600000);
    const pa = S.propagate(a, when).position, pb = S.propagate(b, when).position;
    near(Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z), 0, 0.02, 'OMM/TLE distance km');
  }
  engine();
  assert.equal(loadRecsFromList([legacyISS]).count, 1);
  assert.equal(loadRecsFromList([ISS]).count, 1);
});

test('OMM epochs are explicitly UTC, reject normalized invalid dates, and preserve full years', () => {
  assert.equal(ommEpoch('2026-10-02T00:19:52.567'), Date.UTC(2026, 9, 2, 0, 19, 52, 567));
  assert.equal(ommEpoch('2026-10-02T00:19:52.567Z'), ommEpoch(ISS.EPOCH));
  assert.equal(ommEpoch('2057-01-01T00:00:00'), Date.UTC(2057, 0, 1));
  for (const value of ['2026-02-30T00:00:00', '2026-10-05T24:00:00', '2026-10-05T00:00:00+01:00', '2026-10-05', '', null]) assert.equal(ommEpoch(value), null);
});

test('reject unsupported OMM frames/models and malformed orbital fields before propagation', () => {
  engine();
  const bad = [{ CENTER_NAME: 'MARS' }, { REF_FRAME: 'J2000' }, { TIME_SYSTEM: 'TAI' }, { MEAN_ELEMENT_THEORY: 'SGP4-XP' },
    { EPHEMERIS_TYPE: 4 }, { ECCENTRICITY: 1 }, { ECCENTRICITY: -0.1 }, { MEAN_MOTION: 0 }, { MEAN_MOTION: '' },
    { MEAN_MOTION: null }, { INCLINATION: 181 }, { MEAN_ANOMALY: 360 }, { BSTAR: 'NaN' }, { NORAD_CAT_ID: 1000000000 },
    { NORAD_CAT_ID: '1e5' }, { EPOCH: 'not a date' }].map(patch => ({ ...ISS, ...patch }));
  const result = loadRecsFromList(bad);
  assert.equal(result.count, 0); assert.equal(result.bad, bad.length);
  assert.equal(loadRecsFromList([{ ...ISS, REF_FRAME: 'TEME', TIME_SYSTEM: 'UTC', MEAN_ELEMENT_THEORY: 'SGP4', CENTER_NAME: 'EARTH' }]).count, 1);
  assert.deepEqual(parseOMM('<html>not orbital JSON</html>'), []);
  assert.deepEqual(parseOMM(Array(MAX_RECORDS + 1).fill(ISS)), []);
});

test('legacy checksums and mismatched catalogue lines are rejected', () => {
  engine();
  const badChecksum = { ...legacyISS, l1: legacyISS.l1.slice(0, 68) + ((Number(legacyISS.l1[68]) + 1) % 10) };
  const mismatch = { ...legacyISS, l2: legacyISS.l2.replace('25544', '25545') };
  assert.equal(loadRecsFromList([badChecksum, mismatch, {}, null, legacyISS]).count, 1);
  assert.equal(satMeta().bad, 4);
});

test('full NORAD IDs deduplicate by newest epoch while unioning stations/visual membership', () => {
  engine();
  const newer = { ...ISS, EPOCH: '2026-10-03T00:00:00', OBJECT_NAME: 'newer orbit' };
  const expanded = { ...ISS, NORAD_CAT_ID: 123456789, OBJECT_NAME: null };
  assert.equal(loadRecsFromList([{ omm: newer, groups: ['visual'] }, { omm: ISS, groups: ['stations'] }, expanded]).count, 2);
  const rows = propagateNow(date, 0, 0, -90);
  const iss = rows.find(row => row.noradId === '25544');
  assert.equal(iss.id, 'sat:25544'); assert.equal(iss.name, 'newer orbit');
  assert.equal(iss.epochISO, '2026-10-03T00:00:00.000Z');
  assert.deepEqual(iss.groups, ['stations', 'visual']);
  assert.equal(rows.find(row => row.noradId === '123456789').name, 'NORAD 123456789');
  const vanguard = fixture.cases[0];
  loadRecsFromList([{ name: 'Vanguard', l1: vanguard.l1, l2: vanguard.l2 }]);
  assert.equal(propagateNow(new Date('2000-06-28T00:00:00Z'), 0, 0, -90)[0].id, 'sat:00005', 'preserve legacy saved IDs');
});

test('observer height uses metres, geometric zenith/range match an analytic WGS84 case', () => {
  // Synthetic position deliberately bypasses SGP4: this isolates coordinate/unit integration.
  // WGS84 equatorial radius = 6378.137 km. Observer and target lie on x axis.
  globalThis.window = { satellite: { ...S, gstime: () => 0, propagate: () => ({ position: { x: 6878.137, y: 0, z: 0 } }) } };
  loadRecsFromList([ISS]);
  const sea = propagateNow(date, 0, 0, -90, { nextSampleSeconds: 0 })[0];
  const raised = propagateNow(date, 0, 0, -90, { observerHeightM: 1000, nextSampleSeconds: 0 })[0];
  near(sea.alt, 90, 1e-9, 'zenith'); near(sea.rangeKm, 500, 1e-9, 'sea-level slant range');
  near(raised.rangeKm, 499, 1e-9, 'one-km raised observer'); near(sea.geo.heightKm, 500, 1e-8, 'subpoint height');
  assert.equal(raised.observerHeightM, 1000); assert.equal(raised.next, null);
  engine();
});

test('coordinate validation, polar observers and date-line continuity are finite', () => {
  engine(); loadRecsFromList([ISS]);
  for (const [lat, lon] of [[90, 0], [-90, 90], [0, 180], [0, -180]]) {
    const [row] = propagateNow(date, lat, lon, -90);
    assert.ok(row && [row.alt, row.az, row.rangeKm, row.geo.lat, row.geo.lon].every(Number.isFinite));
  }
  near(propagateNow(date, 0, 180, -90)[0].alt, propagateNow(date, 0, -180, -90)[0].alt, 1e-9, 'date line');
  for (const args of [[date, 91, 0], [date, 0, 181], [new Date(NaN), 0, 0], [date, 0, 0, 91],
    [date, 0, 0, -90, { observerHeightM: NaN }], [date, 0, 0, -90, { observerHeightM: 10001 }],
    [date, 0, 0, -90, { nextSampleSeconds: 6 }]]) assert.deepEqual(propagateNow(...args), []);
});

test('shadow model has fully lit, umbra and continuous penumbra limits', () => {
  assert.equal(S.shadowFraction({ x: 1, y: 0, z: 0 }, { x: 6800, y: 0, z: 0 }), 0);
  assert.equal(S.shadowFraction({ x: 1, y: 0, z: 0 }, { x: -6800, y: 0, z: 0 }), 1);
  const centre = Math.asin(6378.135 / 6800);
  const fractions = [-0.002, 0, 0.002].map(delta => {
    const angle = centre + delta;
    return S.shadowFraction({ x: 1, y: 0, z: 0 }, { x: -6800 * Math.cos(angle), y: 6800 * Math.sin(angle), z: 0 });
  });
  assert.ok(fractions.every(x => x > 0 && x < 1));
  assert.ok(fractions[0] > fractions[1] && fractions[1] > fractions[2]);
});

test('Sun/twilight altitude agrees with independent Astronomy Engine across the stated model range', () => {
  engine();
  for (const iso of ['1950-06-21T12:00:00Z', '2000-01-01T12:00:00Z', '2026-10-02T00:20:00Z', '2050-12-21T12:00:00Z']) {
    const when = new Date(iso);
    // Synthetic epoch isolates solar calculation; no claim this ISS orbit existed in 1950.
    loadRecsFromList([{ ...ISS, EPOCH: iso }]);
    const row = propagateNow(when, 51.5, 0, -90)[0];
    const observer = new AE.Observer(51.5, 0, 0), eq = AE.Equator('Sun', when, observer, true, true);
    const expected = AE.Horizon(when, observer, eq.ra, eq.dec).altitude;
    near(row.observerSunAlt, expected, 0.025, 'geometric Sun altitude degrees');
    assert.ok(['sunlit', 'penumbra', 'umbra'].includes(row.illumination));
  }
});

test('outside 1950–2050 illumination is unavailable and never an observing candidate', () => {
  engine();
  for (const iso of ['1949-12-31T12:00:00Z', '2051-01-01T12:00:00Z']) {
    loadRecsFromList([{ ...ISS, EPOCH: iso }]);
    const [row] = propagateNow(new Date(iso), 0, 0, -90);
    assert.equal(row.illumination, 'unavailable'); assert.equal(row.shadowFraction, null);
    assert.equal(row.observerSunAlt, null); assert.equal(row.visibility.candidate, false);
    assert.ok(row.visibility.reasons.some(reason => reason.includes('1950–2050')));
  }
});

test('candidate rule distinguishes horizon, twilight, shadow and partial illumination', () => {
  assert.equal(observingCandidate(10, -8, 'sunlit').candidate, true);
  assert.equal(observingCandidate(0, -6, 'sunlit').candidate, true);
  for (const args of [[-1, -10, 'sunlit'], [40, 0, 'sunlit'], [40, -10, 'umbra'], [40, -10, 'penumbra'], [40, null, 'unavailable']]) {
    const result = observingCandidate(...args); assert.equal(result.candidate, false); assert.ok(result.reasons.length);
  }
});

test('one-second sample uses future Earth rotation and equals direct propagation at that instant', () => {
  engine(); loadRecsFromList([ISS]);
  const [row] = propagateNow(date, 28.6139, 77.209, -90, { observerHeightM: 216 });
  assert.equal(row.sampleTimeISO, date.toISOString());
  assert.equal(row.next.dateISO, new Date(date.getTime() + 1000).toISOString());
  const [direct] = propagateNow(new Date(row.next.dateISO), 28.6139, 77.209, -90, { observerHeightM: 216, nextSampleSeconds: 0 });
  near(row.next.alt, direct.alt, 1e-9, 'future altitude'); near(row.next.az, direct.az, 1e-9, 'future azimuth');
  near(row.next.rangeKm, direct.rangeKm, 1e-9, 'future range');
  assert.equal(row.epoch, row.epochISO); assert.equal(row.noradId, '25544');
});

test('seven-day age boundary suppresses future samples without extrapolating stale elements', () => {
  engine(); loadRecsFromList([ISS]);
  const limit = new Date(date.getTime() + 7 * 86400000);
  const [row] = propagateNow(limit, 0, 0, -90);
  assert.ok(row); assert.equal(row.ageDays, 7); assert.equal(row.next, null);
  assert.deepEqual(propagateNow(new Date(limit.getTime() + 1), 0, 0, -90), []);
  assert.equal(satMeta().suppressed, 1);
  assert.deepEqual(propagateNow(new Date(date.getTime() - 7 * 86400000 - 1), 0, 0, -90), []);
});

test('malformed propagation and missing next sample cannot publish nonfinite coordinates', () => {
  globalThis.window = { satellite: { ...S, propagate: () => ({ position: { x: NaN, y: 0, z: 0 } }) } };
  loadRecsFromList([ISS]); assert.deepEqual(propagateNow(date, 0, 0, -90), []); assert.equal(satMeta().failed, 1);
  let calls = 0;
  globalThis.window = { satellite: { ...S, propagate: (...args) => ++calls === 1 ? S.propagate(...args) : null } };
  loadRecsFromList([ISS]); const [row] = propagateNow(date, 0, 0, -90);
  assert.ok(row && row.next === null, 'current sample survives future propagation failure');
  engine();
});
