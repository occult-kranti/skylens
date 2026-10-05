import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { constellationLabelAnchor, loadConstellations, constellationFrame } from '../js/objects.js';
import { engineReady, horizontalProjector } from '../js/sky.js';

const catalogue = JSON.parse(readFileSync(new URL('../data/constellations.json', import.meta.url), 'utf8'));
// Fixed values independently calculated by the skeptical reviewer from this catalogue.
const fixtures = [
  { name: 'Serpens Caput', ra: 15.828746398879188, dec: 10.857318694339286, vertices: 8,
    alt: 45.88284627293283, az: 285.69926620732787 },
  { name: 'Serpens Cauda', ra: 18.02810233546942, dec: -8.053014681366236, vertices: 6,
    alt: 77.15599915265598, az: 230.935932256035 },
];
const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${label}: ${actual} differs from ${expected}`);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({ ok: true, json: async () => catalogue });
try { await loadConstellations(); } finally { globalThis.fetch = originalFetch; }
await engineReady;

for (const fixture of fixtures) test(`${fixture.name} has its own independently checked drawing anchor`, () => {
  const c = catalogue.find(row => row.name === fixture.name);
  assert.equal(new Set(c.lines.flat().map(v => v.join(','))).size, fixture.vertices);
  const [ra, dec] = constellationLabelAnchor(c);
  close(ra, fixture.ra, 1e-12, 'right ascension hours');
  close(dec, fixture.dec, 1e-12, 'declination degrees');
  assert.deepEqual(c.label, [-5.3, 3], 'input catalogue remains unchanged');
});

test('both anchors project to the correct geometric sky directions at J2000', () => {
  // Independent spherical horizon reference at equator/Greenwich, 2000-01-01 12:00 UTC.
  // Fixed expected alt/az use published J2000 GMST 280.46061837 deg, no refraction.
  // The 0.02 deg allowance covers apparent-vs-mean sidereal/nutation conventions.
  const rows = constellationFrame(new Date('2000-01-01T12:00:00Z'), 0, 0);
  for (const fixture of fixtures) {
    const row = rows.find(c => c.name === fixture.name);
    close(row.alt, fixture.alt, .02, fixture.name + ' altitude');
    close(row.az, fixture.az, .02, fixture.name + ' azimuth');
    assert.match(row.description, /drawing anchor/);
    assert.match(row.description, /one IAU constellation/);
  }
});

test('one IAU identity, distinct stable part IDs, all other labels and all line geometry are preserved', () => {
  const date = new Date('2026-10-05T20:00:00Z');
  const rows = constellationFrame(date, 28.6139, 77.209);
  const project = horizontalProjector(date, 28.6139, 77.209);
  const serpens = rows.filter(row => row.catalogueId === 'Ser');
  assert.equal(serpens.length, 2); assert.notEqual(serpens[0].id, serpens[1].id);
  assert.equal(new Set(rows.map(row => row.catalogueId)).size, 88);
  catalogue.forEach((c, index) => {
    const row = rows[index];
    assert.equal(row.id, `const:${c.id}:${index}`);
    assert.equal(row.name, c.name);
    assert.deepEqual(row.segs, c.lines.map(seg => seg.map(([ra, dec]) => {
      const p = project(ra, dec); return [p.alt, p.az];
    })));
    if (c.id !== 'Ser') {
      assert.deepEqual(constellationLabelAnchor(c), c.label);
      const expected = project(...c.label);
      assert.equal(row.alt, expected.alt); assert.equal(row.az, expected.az);
    }
  });
});
