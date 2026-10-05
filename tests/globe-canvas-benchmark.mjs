// Run from the repository root, or use this script's absolute path from any directory:
// PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium node tests/globe-canvas-benchmark.mjs
// Optional: PLAYWRIGHT_PKG=/absolute/path/index.mjs.
// Synthetic records are benchmark fixtures, never external/live telemetry.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_PKG) return import(pathToFileURL(resolve(process.env.PLAYWRIGHT_PKG)).href);
  try { return await import('playwright'); }
  catch { return import('/opt/codex/cua_node/lib/node_modules/playwright/index.mjs'); }
}
const { chromium } = await loadPlaywright();
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/__canvas-fixture') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<style>html,body{margin:0;background:#050c15}#main{width:900px;height:740px}</style><canvas id="main"></canvas>');
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', extname(path) === '.js' ? 'text/javascript' : 'application/json');
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok); });
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 900, height: 740 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/__canvas-fixture`);
  const results = await page.evaluate(async () => {
    const { createGlobeRenderer } = await import('/js/globe-render.js');
    const { createGlobeView, projectGlobePoint, unprojectGlobePoint } = await import('/js/globe-math.js');
    const land = await (await fetch('/data/earth-land.geojson')).json();
    const canvas = document.querySelector('#main');
    const renderer = createGlobeRenderer(canvas);
    renderer.setLand(land);
    const view = createGlobeView({ width: renderer.width, height: renderer.height, centerLat: 24, centerLon: 25 });
    const samples = [];
    for (const count of [1000, 20000, 60000]) {
      const rows = Array.from({ length: count }, (_, i) => ({ id: `fixture-${i}`, name: `Fixture ${i}`,
        kind: i % 15 ? 'plane' : 'satellite', lat: i % 179 - 89, lon: i * 137.508 % 360 - 180, track: i % 360 }));
      rows[count - 1] = { id: 'selected-last', kind: 'plane', lat: 24, lon: 25, name: 'Selected last', track: 45 };
      const drawMs = [];
      for (let i = 0; i < 11; i++) {
        renderer.draw({ view, objects: rows, selectedId: 'selected-last' });
        drawMs.push(renderer.stats.renderMs);
      }
      const point = projectGlobePoint(rows[count - 1].lat, rows[count - 1].lon, view);
      const selectedLastPicked = renderer.pick(point.x, point.y)?.id === 'selected-last';
      const rotatingMs = [];
      for (let i = 0; i < 10; i++) {
        renderer.draw({ view: createGlobeView({ ...view, centerLon: 26 + i }), objects: rows, selectedId: 'selected-last' });
        rotatingMs.push(renderer.stats.renderMs);
      }
      samples.push({ count, firstDrawMs: drawMs[0], cachedMapMs: drawMs.slice(1), rotatingMs,
        stats: renderer.stats, selectedLastPicked });
    }
    const front = { id: 'front', kind: 'plane', lat: 24, lon: 25 };
    const back = { id: 'back', kind: 'satellite', lat: -24, lon: -155 };
    const stale = { id: 'stale', kind: 'plane', lat: 24, lon: 25, overlayEligible: false };
    renderer.draw({ view, objects: [back, front, stale] });
    const occlusion = renderer.stats.visibleCount === 1 && renderer.pick(view.cx, view.cy) === front;
    renderer.draw({ view, objects: [back, stale], selectedId: 'back' });
    const excludedCannotPick = renderer.stats.drawnCount === 0 && renderer.pick(view.cx, view.cy) === null;

    // Capture real canvas text calls, preserving native rendering. This checks
    // the visible result instead of duplicating the label placement algorithm.
    const context = canvas.getContext('2d');
    const fillText = context.fillText;
    let paintedLabels = [];
    context.fillText = function (text, x, y, ...rest) {
      const metrics = this.measureText(text);
      paintedLabels.push({ text, left: x - metrics.actualBoundingBoxLeft - 1,
        right: x + metrics.actualBoundingBoxRight + 1,
        top: y - metrics.actualBoundingBoxAscent - 1,
        bottom: y + metrics.actualBoundingBoxDescent + 1 });
      return fillText.call(this, text, x, y, ...rest);
    };
    const labelCases = [];
    for (const zoom of [1, 2.49, 2.5, 4.99, 5, 10, 32]) {
      const labelView = createGlobeView({ ...view, zoom });
      const rows = [];
      for (let y = 130; y <= 610; y += 36) {
        for (let x = 190; x <= 710; x += 60) {
          const point = unprojectGlobePoint(x, y, labelView);
          if (point) rows.push({ id: `label-${rows.length}`, name: `F${rows.length}`,
            kind: 'plane', ...point });
        }
      }
      // A late, collocated selection must reserve its label before earlier rows.
      rows.push({ id: 'overlap', name: 'Other label', kind: 'plane', lat: 24, lon: 25 });
      rows.push({ id: 'selected-last', name: 'Selected last', kind: 'plane', lat: 24, lon: 25 });
      paintedLabels = [];
      renderer.draw({ view: labelView, objects: rows, selectedId: 'selected-last' });
      const collisions = [];
      for (let i = 0; i < paintedLabels.length; i++) {
        for (let j = i + 1; j < paintedLabels.length; j++) {
          const a = paintedLabels[i], b = paintedLabels[j];
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
            collisions.push([a.text, b.text]);
          }
        }
      }
      labelCases.push({ zoom, stats: renderer.stats, labels: paintedLabels.map(item => item.text),
        collisions, selectedPicked: renderer.pick(labelView.cx, labelView.cy)?.id === 'selected-last' });
    }
    context.fillText = fillText;
    renderer.dispose();
    const disposed = renderer.pick(view.cx, view.cy) === null;

    const makeCanvas = (width = 480, height = 360) => {
      const element = document.createElement('canvas');
      element.style.cssText = `position:absolute;left:0;top:0;opacity:0;width:${width}px;height:${height}px`;
      document.body.append(element);
      return element;
    };
    // Empty-object views isolate the cartography work. Record timings for
    // comparison, but bound geometry rather than asserting machine-specific ms.
    const gridCanvas = makeCanvas(900, 740);
    const gridRenderer = createGlobeRenderer(gridCanvas);
    const gridCases = [];
    for (const zoom of [1, 2.49, 2.5, 4.99, 5, 9.99, 10, 32]) {
      const rotatingMs = [];
      const frames = [];
      let maxPoints = 0;
      for (let i = 0; i < 12; i++) {
        const gridView = createGlobeView({ width: 900, height: 740, zoom,
          centerLat: [0, 24, 75, 89][i % 4], centerLon: 165 + i });
        gridRenderer.draw({ view: gridView, objects: [] });
        rotatingMs.push(gridRenderer.stats.renderMs);
        maxPoints = Math.max(maxPoints, gridRenderer.stats.graticulePoints);
        frames.push({ centerLat: gridView.centerLat, centerLon: gridView.centerLon,
          graticuleStep: gridRenderer.stats.graticuleStep, graticulePoints: gridRenderer.stats.graticulePoints });
      }
      const sorted = rotatingMs.slice().sort((a, b) => a - b);
      gridCases.push({ zoom, rotatingMs, frames, medianMs: (sorted[5] + sorted[6]) / 2, maxPoints });
    }
    for (const entry of gridCases) {
      entry.relativeToWorldMedian = gridCases[0].medianMs ? entry.medianMs / gridCases[0].medianMs : null;
    }
    gridRenderer.dispose(); gridCanvas.remove();
    const pixels = element => element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
    const hash = data => {
      let result = 2166136261;
      for (let i = 0; i < data.length; i++) result = Math.imul(result ^ data[i], 16777619);
      return (result >>> 0).toString(16);
    };
    const cachedCanvas = makeCanvas();
    const cached = createGlobeRenderer(cachedCanvas, { land });
    const initial = createGlobeView({ width: 480, height: 360, centerLat: 15, centerLon: -90 });
    cached.draw({ view: initial });
    const initialHash = hash(pixels(cachedCanvas));
    const cacheCases = [];
    for (const setup of [
      { label: 'Americas to Pacific', lat: .69, lon: 150.88, zoom: 1, width: 480, height: 360 },
      { label: 'Zoom changes radius', lat: .69, lon: 150.88, zoom: 3, width: 480, height: 360 },
      { label: 'Centre latitude changes', lat: 60, lon: 150.88, zoom: 1, width: 480, height: 360 },
      { label: 'Dimensions change', lat: .69, lon: 150.88, zoom: 1, width: 520, height: 400 },
      { label: 'Night palette changes', lat: .69, lon: 150.88, zoom: 1, width: 520, height: 400, night: true },
      { label: 'Regional grid threshold', lat: .69, lon: 150.88, zoom: 2.5, width: 520, height: 400 },
      { label: 'Close grid threshold', lat: .69, lon: 150.88, zoom: 5, width: 520, height: 400 },
      { label: 'Fine grid threshold', lat: .69, lon: 150.88, zoom: 10, width: 520, height: 400 },
      { label: 'DPR changes', lat: .69, lon: 150.88, zoom: 10, width: 520, height: 400, dpr: 2 },
    ]) {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: setup.dpr || 1 });
      cachedCanvas.style.width = setup.width + 'px';
      cachedCanvas.style.height = setup.height + 'px';
      cached.resize();
      const currentView = createGlobeView({ width: setup.width, height: setup.height,
        centerLat: setup.lat, centerLon: setup.lon, zoom: setup.zoom });
      cached.draw({ view: currentView, night: setup.night });
      const freshCanvas = makeCanvas(setup.width, setup.height);
      const fresh = createGlobeRenderer(freshCanvas, { land });
      fresh.draw({ view: currentView, night: setup.night });
      const cachedPixels = pixels(cachedCanvas), freshPixels = pixels(freshCanvas);
      let mismatchedBytes = 0;
      for (let i = 0; i < cachedPixels.length; i++) if (cachedPixels[i] !== freshPixels[i]) mismatchedBytes++;
      cacheCases.push({ label: setup.label, cachedHash: hash(cachedPixels), freshHash: hash(freshPixels), mismatchedBytes });
      fresh.dispose(); freshCanvas.remove();
    }
    cached.dispose(); cachedCanvas.remove();
    return { userAgent: navigator.userAgent, viewport: '900x740 CSS pixels, DPR 1',
      metric: 'Synchronous renderer.stats.renderMs: JavaScript and Canvas command submission; excludes compositor/frame presentation. Synthetic fixture records.',
      samples, occlusion, excludedCannotPick, disposed, labelCases, gridCases,
      initialAmericasHash: initialHash, cacheCases };
  });
  const resultsDir = resolve(root, 'test-results');
  await mkdir(resultsDir, { recursive: true });
  await writeFile(resolve(resultsDir, 'globe-canvas-benchmark.json'), JSON.stringify(results, null, 2) + '\n');
  assert(results.samples.every(item => item.selectedLastPicked && item.stats.consideredCount === item.count
    && item.stats.drawnCount <= 1600 && item.stats.labelsDrawn <= 12), 'dense world views stay bounded and preserve selection');
  assert(results.occlusion && results.excludedCannotPick && results.disposed, 'backface/stale/disposed markers cannot be picked');
  for (const entry of results.labelCases) {
    const expectedBudget = entry.zoom >= 5 ? 35 : entry.zoom >= 2.5 ? 22 : 12;
    assert.equal(entry.stats.labelBudget, expectedBudget, `label budget at zoom ${entry.zoom}`);
    assert.equal(entry.labels.length, expectedBudget, `fixture fills label budget at zoom ${entry.zoom}`);
    assert.equal(entry.stats.labelsDrawn, entry.labels.length, 'stats match actual text painting');
    assert.equal(entry.labels[0], 'Selected last', 'selection reserves its label before all other rows');
    assert.equal(entry.labels.filter(text => text === 'Selected last').length, 1, 'selected label is painted once');
    assert(entry.selectedPicked, 'selection wins collocated picking');
    assert.deepEqual(entry.collisions, [], `painted labels do not collide at zoom ${entry.zoom}`);
  }
  for (const entry of results.gridCases) {
    const expectedStep = entry.zoom >= 10 ? 1 : entry.zoom >= 5 ? 2 : entry.zoom >= 2.5 ? 5 : 10;
    for (const frame of entry.frames) {
      if (frame.centerLat < 75) assert.equal(frame.graticuleStep, expectedStep, `grid interval at zoom ${entry.zoom}`);
      else assert([1, 2, 5, 10].includes(frame.graticuleStep) && frame.graticuleStep >= expectedStep,
        'polar grids may coarsen to preserve the geometry budget');
    }
    assert(Number.isFinite(entry.maxPoints) && entry.maxPoints > 0 && entry.maxPoints <= 5000,
      `grid geometry stays bounded at zoom ${entry.zoom}: ${entry.maxPoints}`);
    assert(entry.rotatingMs.every(ms => Number.isFinite(ms) && ms >= 0), 'grid timing samples are valid');
  }
  assert(results.cacheCases.every(item => item.mismatchedBytes === 0), 'cached and fresh cartography match byte for byte');
  assert.notEqual(results.initialAmericasHash, results.cacheCases[0].cachedHash);
  console.log(`Canvas regressions passed: ${results.samples.length} density samples, ${results.labelCases.length} label cases, ${results.gridCases.length} grid cases, ${results.cacheCases.length} pixel comparisons.`);
  console.log(`Results: ${resolve(resultsDir, 'globe-canvas-benchmark.json')}`);
} finally {
  await browser?.close();
  server.close();
}
