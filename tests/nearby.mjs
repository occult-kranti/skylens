import assert from 'node:assert/strict';
import { interpolateDirection, aimingCandidates, selectMovingMarkers } from '../js/nearby.js';
const sample = (alt, az, nextAlt, nextAz) => ({ id: 'sat:1', alt, az, rangeKm: 1000,
  sampleTimeISO: '2026-10-05T00:00:00Z', next: { dateISO: '2026-10-05T00:00:01Z', alt: nextAlt, az: nextAz, rangeKm: 1100 } });
const t = Date.parse('2026-10-05T00:00:00Z');
let p = interpolateDirection(sample(0, 359, 0, 1), t + 500);
assert.ok(p.az < 1e-9 || p.az > 360 - 1e-9); assert.ok(Math.abs(p.alt) < 1e-9); assert.equal(p.rangeKm, 1050);
p = interpolateDirection(sample(89, 0, 89, 180), t + 500);
assert.ok(Math.abs(p.alt - 90) < 1e-8, 'cardinal zenith-crossing midpoint');
assert.equal(interpolateDirection(sample(0, 20, 0, 40), t - 1000).az, 20);
assert.ok(Math.abs(interpolateDirection(sample(0, 20, 0, 40), t + 10000).az - 40) < 1e-9, 'never extrapolate past next sample');
const invalid = sample(0, 0, 0, 180); assert.equal(interpolateDirection(invalid, t + 500), invalid);
const rows = [{ id: 'near', alt: 10, az: 1 }, { id: 'below', alt: -1, az: 1 }, { id: 'expired', alt: 10, az: 0, overlayEligible: false }, { id: 'far', alt: 10, az: 180 }];
assert.deepEqual(aimingCandidates(rows, 10, 0).map(x => x.id), ['near']);
assert.equal(selectMovingMarkers(rows, 10, 0, 'far', 1)[0].id, 'far');
assert.deepEqual(aimingCandidates(rows, NaN, 0), []);
console.log('Nearby direction checks pass: north/zenith crossings, bounded samples, selection and stale/horizon exclusion.');
