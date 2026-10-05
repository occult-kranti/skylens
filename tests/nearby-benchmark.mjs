// Deterministic CPU benchmark, not a browser/phone frame-rate measurement.
// node tests/nearby-benchmark.mjs [output.json]
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { makeBasis, projectVec, vecFromAltAz } from '../js/astro.js';
import { layoutLabels } from '../js/render.js';

const width = 390, height = 844, count = 1000, iterations = 200, rounds = 9;
const basis = makeBasis(90, 35), tanH = Math.tan(Math.PI / 6), tanV = tanH * height / width;
const targets = Array.from({ length: count }, (_, i) => ({
  key: 'fixture:' + i, vector: vecFromAltAz(-10 + (i * 17.137 % 100), i * 137.507764 % 360),
  width: 45 + i % 65, height: 11, priority: i === 0 ? 110 : i % 3 === 0 ? 40 : 30,
}));
function viewport() {
  const labels = [];
  for (const target of targets) {
    const point = projectVec(target.vector, basis, tanH, tanV, width, height);
    if (point) labels.push({ key: target.key, x: point.x, y: point.y, width: target.width,
      height: target.height, priority: target.priority, align: 'center' });
  }
  return { candidates: labels.length, labels: layoutLabels(labels, width, height, 45).length };
}
for (let warm = 0; warm < 100; warm++) viewport();
const samples = [];
for (let round = 0; round < rounds; round++) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) viewport();
  samples.push((performance.now() - start) / iterations);
}
const sorted = [...samples].sort((a, b) => a - b);
const result = {
  measuredAt: new Date().toISOString(), node: process.version, platform: process.platform,
  arch: process.arch, cpu: cpus()[0]?.model, fixture: { width, height, targets: count, iterations, rounds, ...viewport() },
  millisecondsPerProjectionAndLayout: { median: sorted[Math.floor(rounds / 2)], min: sorted[0], max: sorted.at(-1), samples },
  limitations: 'Node CPU only: fixed-width labels, no rasterization, DOM, sensors, network, ephemeris, SGP4 or physical phone. Same fixture and environment required for comparison.',
};
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
