import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGlobeView, projectGlobePoint, geoGlobeUnitVector, createGlobeProjector, unprojectGlobePoint, rotateGlobeView, zoomGlobeView, hitGlobeMarkers } from '../js/globe-math.js';
import { geoOrthographic, geoPath } from '../vendor/d3-geo.js';

const near = (actual, expected, tolerance = 1e-9, message = '') => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const longitudeError = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const base = createGlobeView({ width: 400, height: 400 });

test('known spherical/cardinal orthographic projections match exact independent limiting cases', () => {
  // USGS PP1395 orthographic limits: R=184, centre Greenwich/equator.
  // At (lat,lon)=(30,30): east=sqrt(3)/4, north=1/2, depth=3/4.
  const fixtures = [
    [0, 0, 0, 0, 1], [0, 90, 1, 0, 0], [0, -90, -1, 0, 0],
    [90, 0, 0, 1, 0], [-90, 0, 0, -1, 0], [30, 30, Math.sqrt(3) / 4, 0.5, 0.75],
  ];
  for (const [lat, lon, east, north, depth] of fixtures) {
    const point = projectGlobePoint(lat, lon, base);
    near(point.x, base.cx + base.radius * east); near(point.y, base.cy - base.radius * north); near(point.depth, depth);
    assert.equal(point.visible, true);
  }
  const tilted = createGlobeView({ width: 400, height: 400, centerLat: 45, centerLon: 20 });
  const pole = projectGlobePoint(90, -160, tilted);
  near(pole.x, tilted.cx); near(pole.y, tilted.cy - tilted.radius / Math.sqrt(2)); near(pole.depth, 1 / Math.sqrt(2));
});

test('front and back hemispheres cannot be confused by coincident screen coordinates', () => {
  const front = projectGlobePoint(0, 0, base), back = projectGlobePoint(0, 180, base);
  near(front.x, back.x); near(front.y, back.y);
  assert.equal(front.visible, true); assert.equal(back.visible, false);
  assert.equal(projectGlobePoint(0, 89.999, base).visible, true);
  assert.equal(projectGlobePoint(0, 90.001, base).visible, false);
});

test('orthographic points agree with the independent pinned d3-geo projection across globe rotations', () => {
  let count = 0;
  for (const centerLat of [-90, -75, -30, 0, 40, 80, 90]) for (const centerLon of [-180, -75, 0, 122, 179]) {
    const view = createGlobeView({ width: 844, height: 390, centerLat, centerLon, zoom: 3 });
    const batch = createGlobeProjector(view);
    const reference = geoOrthographic().translate([view.cx, view.cy]).scale(view.radius).rotate([-view.centerLon, -view.centerLat, 0]);
    for (const lat of [-90, -60, -10, 0, 30, 70, 90]) for (const lon of [-180, -110, -1, 25, 120, 179, 180]) {
      const actual = projectGlobePoint(lat, lon, view), expected = reference([lon, lat]);
      assert.deepEqual(batch(geoGlobeUnitVector(lat, lon)), actual, 'cached-vector batch keeps exact point/depth/visibility results');
      near(actual.x, expected[0], 1e-8, 'd3 x'); near(actual.y, expected[1], 1e-8, 'd3 y'); count++;
    }
  }
  assert.equal(count, 1715);
});

test('cached geographic vectors are unit length, reusable across views and never reinterpret invalid positions', () => {
  assert.deepEqual(geoGlobeUnitVector(0, 0), [1, 0, 0]);
  assert.deepEqual(geoGlobeUnitVector(90, 83), [0, 0, 1]);
  assert.deepEqual(geoGlobeUnitVector(-90, -83), [0, 0, -1]);
  const vector = geoGlobeUnitVector(30, 30), before = [...vector];
  near(vector[0], 0.75); near(vector[1], Math.sqrt(3) / 4); near(vector[2], 0.5);
  near(Math.hypot(...vector), 1);
  for (const view of [base, rotateGlobeView(base, 145, -75), zoomGlobeView(base, 32)]) {
    assert.deepEqual(createGlobeProjector(view)(vector), projectGlobePoint(30, 30, view));
  }
  assert.deepEqual(vector, before);
  for (const pair of [[91, 0], [0, 181], [NaN, 0], [0, null], ['0', 0]]) assert.equal(geoGlobeUnitVector(...pair), null);
});

test('batch projector snapshots its view and rejects missing, nonfinite or nonunit vectors', () => {
  const view = createGlobeView({ width: 400, height: 300, centerLat: 35, centerLon: -110, zoom: 3 });
  const vector = geoGlobeUnitVector(20, -90), expected = projectGlobePoint(20, -90, view), project = createGlobeProjector(view);
  view.cx = -100; view.radius = 1; view.basis.forward[0] = -1; view.basis.east[0] = 50;
  assert.deepEqual(project(vector), expected, 'later controls cannot mutate an existing render batch');
  for (const invalid of [null, undefined, [], [1, 0], [1, 0, 0, 0], [NaN, 0, 1], [Infinity, 0, 0], [0, 0, 0], [6378.137, 0, 0], ['1', 0, 0]]) assert.equal(project(invalid), null);
  assert.equal(createGlobeProjector(null)([1, 0, 0]), null);
  assert.equal(createGlobeProjector({ width: 1 })([1, 0, 0]), null);
});

test('inverse returns front surface, analytic limb and stable pole meridians', () => {
  assert.deepEqual(unprojectGlobePoint(base.cx, base.cy, base), { lat: 0, lon: 0 });
  const east = unprojectGlobePoint(base.cx + base.radius, base.cy, base);
  near(east.lat, 0); near(east.lon, 90);
  const exact = unprojectGlobePoint(base.cx + base.radius * Math.sqrt(3) / 4, base.cy - base.radius / 2, base);
  near(exact.lat, 30); near(exact.lon, 30);
  const north = createGlobeView({ width: 400, height: 300, centerLat: 90, centerLon: 73 });
  assert.deepEqual(unprojectGlobePoint(north.cx, north.cy, north), { lat: 90, lon: 73 });
  const south = createGlobeView({ width: 400, height: 300, centerLat: -90, centerLon: -42 });
  assert.deepEqual(unprojectGlobePoint(south.cx, south.cy, south), { lat: -90, lon: -42 });
});

test('inverse agrees with d3-geo on valid front-facing viewport samples', () => {
  let count = 0;
  for (const config of [
    { width: 390, height: 844, centerLat: 51.5, centerLon: -0.1, zoom: 1 },
    { width: 844, height: 390, centerLat: -35, centerLon: 179.9, zoom: 4 },
    { width: 320, height: 240, centerLat: 82, centerLon: -100, zoom: 32 },
  ]) {
    const view = createGlobeView(config), reference = geoOrthographic().translate([view.cx, view.cy]).scale(view.radius).rotate([-view.centerLon, -view.centerLat, 0]);
    for (let ix = 0; ix <= 8; ix++) for (let iy = 0; iy <= 8; iy++) {
      const x = ix * view.width / 8, y = iy * view.height / 8, actual = unprojectGlobePoint(x, y, view);
      if (!actual) continue;
      const expected = reference.invert([x, y]);
      near(actual.lat, expected[1], 1e-8, 'inverse latitude');
      if (Math.abs(actual.lat) < 89.999999) near(longitudeError(actual.lon, expected[0]), 0, 1e-8, 'inverse longitude');
      const restored = projectGlobePoint(actual.lat, actual.lon, view);
      near(restored.x, x, 1e-8); near(restored.y, y, 1e-8); assert.equal(restored.visible, true); count++;
    }
  }
  assert.ok(count > 100);
});

test('ocean/background outside sphere or canvas is not clamped into an invented geographic point', () => {
  assert.equal(unprojectGlobePoint(0, 0, base), null);
  assert.equal(unprojectGlobePoint(base.cx + base.radius + 1, base.cy, base), null);
  assert.equal(unprojectGlobePoint(-1, base.cy, base), null);
  assert.equal(unprojectGlobePoint(NaN, 100, base), null);
  const zoomed = zoomGlobeView(base, 32);
  assert.equal(unprojectGlobePoint(-1, zoomed.cy, zoomed), null, 'outside viewport remains unavailable even inside enlarged sphere');
});

test('date-line identity and pole projections stay finite and continuous', () => {
  const view = createGlobeView({ width: 400, height: 300, centerLat: 15, centerLon: 180 });
  assert.equal(view.centerLon, -180);
  const a = projectGlobePoint(15, 180, view), b = projectGlobePoint(15, -180, view);
  near(a.x, b.x); near(a.y, b.y); near(a.depth, 1);
  const west = projectGlobePoint(15, 179.999, view), east = projectGlobePoint(15, -179.999, view);
  assert.ok(Math.abs(east.x - west.x) < 0.01);
  for (const lat of [-90, 90]) for (const lon of [-180, -90, 0, 90, 180]) {
    const p = projectGlobePoint(lat, lon, view), same = projectGlobePoint(lat, 0, view);
    assert.ok([p.x, p.y, p.depth].every(Number.isFinite)); near(p.x, same.x); near(p.y, same.y);
  }
});

test('zoom and rotation produce new bounded visual views without mutating geographic data', () => {
  const before = JSON.stringify(base);
  const zoomed = zoomGlobeView(base, 1000);
  assert.equal(zoomed.zoom, 32); near(zoomed.radius, 32 * base.radius);
  assert.equal(zoomGlobeView(zoomed, Number.MAX_VALUE).zoom, 32);
  assert.equal(zoomGlobeView(zoomed, 1e-10).zoom, 1);
  const rotated = rotateGlobeView(base, 370, 100);
  assert.equal(rotated.centerLat, 90); assert.equal(rotated.centerLon, 10);
  assert.equal(rotateGlobeView(base, -370, -100).centerLat, -90);
  assert.equal(rotateGlobeView(base, -370, -100).centerLon, -10);
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(Object.keys(base).sort(), ['basis', 'centerLat', 'centerLon', 'cx', 'cy', 'height', 'radius', 'width', 'zoom'].sort(), 'view has no observer, feed or permission state');
});

test('invalid dimensions, numeric controls and marker coordinates fail closed', () => {
  for (const config of [{ width: 0, height: 100 }, { width: 100, height: -1 }, { width: NaN, height: 100 },
    { width: 100, height: 100, zoom: Infinity }, { width: 100, height: 100, centerLat: '20' },
    { width: Number.MAX_VALUE, height: Number.MAX_VALUE, zoom: 32 }]) assert.throws(() => createGlobeView(config), RangeError);
  for (const factor of [0, -1, Infinity, NaN, '2']) assert.throws(() => zoomGlobeView(base, factor), RangeError);
  assert.throws(() => rotateGlobeView(base, Infinity, 0), RangeError);
  for (const [lat, lon] of [[91, 0], [0, 181], [NaN, 0], [0, null]]) assert.equal(projectGlobePoint(lat, lon, base), null);
  assert.equal(projectGlobePoint(0, 0, null), null); assert.equal(unprojectGlobePoint(0, 0, null), null);
});

test('picking rejects backside/offscreen rows and preserves original timestamp/provenance', () => {
  const front = { id: 'plane:front', lat: 0, lon: 0, positionAt: 42, source: 'fixture' };
  const back = { id: 'plane:back', lat: 0, lon: 180 };
  assert.equal(hitGlobeMarkers(base.cx, base.cy, [back, front], base), front);
  assert.equal(hitGlobeMarkers(base.cx, base.cy, [back], base), null);
  assert.equal(hitGlobeMarkers(0, 0, [front], base), null);
  assert.equal(hitGlobeMarkers(base.cx, base.cy, [null, { id: 'invalid', lat: NaN, lon: 0 }], base), null);
  const zoomed = zoomGlobeView(base, 32), offscreen = { id: 'plane:outside', lat: 0, lon: 45 };
  assert.equal(projectGlobePoint(offscreen.lat, offscreen.lon, zoomed).inViewport, false);
  assert.equal(hitGlobeMarkers(base.width - 1, base.cy, [offscreen], zoomed, { radiusPx: 80 }), null);
});

test('picking uses nearest pixel distance, deterministic collision ties and selected-row tie preference', () => {
  const a = { id: 'sat:a', lat: 0, lon: 0 }, b = { id: 'sat:b', lat: 0, lon: 0 }, close = { id: 'plane:nearer', lat: 0, lon: 2 };
  assert.equal(hitGlobeMarkers(base.cx, base.cy, [b, a], base), a);
  assert.equal(hitGlobeMarkers(base.cx, base.cy, [a, b], base, { selectedId: b.id }), b);
  const nearPoint = projectGlobePoint(close.lat, close.lon, base);
  assert.equal(hitGlobeMarkers(nearPoint.x, nearPoint.y, [a, close], base, { selectedId: a.id }), close, 'selection does not override a genuinely closer marker');
  assert.equal(hitGlobeMarkers(base.cx + 21, base.cy, [a], base), null);
  assert.equal(hitGlobeMarkers(base.cx + 20, base.cy, [a], base), a);
  assert.equal(hitGlobeMarkers(-1, base.cy, [a], base), null);
});

test('portrait/landscape resize shares scale in CSS pixels and retains centre target', () => {
  const p = createGlobeView({ width: 390, height: 844, centerLat: 28.6139, centerLon: 77.209, zoom: 4 });
  const l = createGlobeView({ ...p, width: 844, height: 390 });
  near(p.radius, l.radius);
  for (const view of [p, l]) { const at = projectGlobePoint(view.centerLat, view.centerLon, view); near(at.x, view.cx); near(at.y, view.cy); }
});

test('land and public-domain licence match pinned upstream bytes, with valid closed geographic rings', () => {
  const data = readFileSync(new URL('../data/earth-land.geojson', import.meta.url));
  const license = readFileSync(new URL('../data/earth-land-LICENSE.md', import.meta.url));
  const provenance = JSON.parse(readFileSync(new URL('../data/earth-land-provenance.json', import.meta.url)));
  const blob = buffer => createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
  assert.equal(blob(data), '04811d72fff2701ec67587e30ad8942675b511e3');
  assert.equal(blob(license), '9dfbc3d55a4ab1dd758c253b2ee339888f632889');
  assert.equal(createHash('sha256').update(data).digest('hex'), provenance.sha256);
  assert.equal(data.length, 138160); assert.match(license.toString(), /public domain/);
  const land = JSON.parse(data); assert.equal(land.type, 'FeatureCollection'); assert.equal(land.features.length, 127);
  let count = 0;
  for (const feature of land.features) {
    assert.equal(feature.geometry.type, 'Polygon');
    for (const ring of feature.geometry.coordinates) {
      assert.ok(ring.length >= 4); assert.deepEqual(ring[0], ring.at(-1));
      for (const [lon, lat] of ring) { assert.ok(Math.abs(lon) <= 180 && Math.abs(lat) <= 90); count++; }
    }
  }
  assert.equal(count, 5143);
});

test('upstream land winding and holes render bounded land area under spherical hemisphere clipping', () => {
  const land = JSON.parse(readFileSync(new URL('../data/earth-land.geojson', import.meta.url)));
  for (const [lon, lat] of [[0, 0], [-100, 30], [100, 30], [180, 0], [0, 90], [0, -90]]) {
    const projection = geoOrthographic().rotate([-lon, -lat, 0]).scale(100).translate([100, 100]).clipAngle(90);
    const fraction = geoPath(projection).area(land) / (Math.PI * 10000);
    assert.ok(Number.isFinite(fraction) && fraction > 0 && fraction < 1,
      'reversed small-island rings must not fill the globe repeatedly');
    if (lon === 180 && lat === 0) assert.ok(fraction < 0.3, 'Pacific hemisphere remains predominantly ocean');
  }
});
