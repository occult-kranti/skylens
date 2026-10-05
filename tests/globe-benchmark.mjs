// Reproducible globe projection/picking CPU cost. No browser/network work.
// node tests/globe-benchmark.mjs [output.json]
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { createGlobeView, projectGlobePoint, hitGlobeMarkers, geoGlobeUnitVector, createGlobeProjector } from '../js/globe-math.js';

const rounds = 9, iterations = 100, warmups = 100;
const scenarios = [];
for (const [name, count, zoom] of [['world-1000', 1000, 1], ['regional-1000', 1000, 8], ['world-10000', 10000, 1], ['world-60000-cap', 60000, 1]]) {
  const view = createGlobeView({ width: 390, height: 844, centerLat: 15, centerLon: -30, zoom });
  const markers = Array.from({ length: count }, (_, i) => ({ id: 'fixture:' + i,
    lat: Math.asin(1 - 2 * (i + 0.5) / count) * 180 / Math.PI, lon: (i * 137.507764 % 360) - 180 }));
  markers[0] = { id: 'fixture:centre', lat: view.centerLat, lon: view.centerLon };
  function frame() {
    let visible = 0, inViewport = 0;
    for (const marker of markers) {
      const point = projectGlobePoint(marker.lat, marker.lon, view);
      if (point?.visible) { visible++; if (point.inViewport) inViewport++; }
    }
    const picked = hitGlobeMarkers(view.cx, view.cy, markers, view, { radiusPx: 20 });
    return { visible, inViewport, picked: picked?.id };
  }
  const work = frame();
  assert.equal(work.picked, 'fixture:centre');
  assert.ok(work.visible > count * .4 && work.visible < count * .6, 'approximately one hemisphere is visible');
  for (let i = 0; i < warmups; i++) frame();
  const samples = [];
  for (let round = 0; round < rounds; round++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) frame();
    samples.push((performance.now() - start) / iterations);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const vectors = markers.map(marker => geoGlobeUnitVector(marker.lat, marker.lon));
  function cachedFrame() {
    const project = createGlobeProjector(view);
    let visible = 0, inViewport = 0;
    for (const vector of vectors) {
      const point = project(vector);
      if (point?.visible) { visible++; if (point.inViewport) inViewport++; }
    }
    return { visible, inViewport };
  }
  assert.deepEqual(cachedFrame(), { visible: work.visible, inViewport: work.inViewport });
  for (let i = 0; i < warmups; i++) cachedFrame();
  const cachedSamples = [];
  for (let round = 0; round < rounds; round++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) cachedFrame();
    cachedSamples.push((performance.now() - start) / iterations);
  }
  const cachedSorted = [...cachedSamples].sort((a, b) => a - b);
  scenarios.push({ name, markers: count, zoom, work,
    millisecondsPerProjectionAndPick: { median: sorted[4], min: sorted[0], max: sorted.at(-1), samples },
    millisecondsPerCachedProjectionOnly: { median: cachedSorted[4], min: cachedSorted[0], max: cachedSorted.at(-1), samples: cachedSamples } });
}
const report = { measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
  cpu: cpus()[0]?.model, viewport: { width: 390, height: 844 }, rounds, iterations, warmups, scenarios,
  limitations: 'Node CPU only. Two different workloads: uncached spherical ground-marker projection plus one full-list hit test; and cached-vector projection only without picking. Excludes vector cache rebuild, Canvas/coastline rasterization, label layout, DOM, feeds, SGP4, sensors, GPU and physical phone performance. New-feature cost, not a before/after speedup or a ratio between equivalent workloads.' };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
