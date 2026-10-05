// UI-only before/after benchmark. The frozen baseline is never deployed.
// PLAYWRIGHT_PKG=/path/to/playwright/index.mjs node tests/globe-ui-benchmark.mjs [output.json]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_PKG || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const browser = await chromium.launch({ headless: true });
const reports = [];
let userAgent;
try {
  for (const revision of ['before-cache', 'current']) {
    const base = revision === 'current' ? root : root + 'tests/fixtures/globe-ui-before-cache/';
    const files = await Promise.all(['globe.html', 'js/globe-ui.js', 'css/globe.css'].map(name => readFile(base + name, 'utf8')));
    const [html, ui, css] = files;
    const page = await browser.newPage({ viewport: { width: 900, height: 740 }, deviceScaleFactor: 1 });
    await page.route('**/*', route => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({ status: 200,
        contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
        body: path.endsWith('globe-ui.js') ? ui : path.endsWith('.css') ? css : html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '') });
    });
    await page.goto('http://fixture.local/globe.html');
    userAgent = await page.evaluate(() => navigator.userAgent);
    const results = await page.evaluate(async () => {
      const { createGlobeUI } = await import('./js/globe-ui.js');
      const ui = createGlobeUI();
      const objects = Array.from({ length: 60000 }, (_, i) => ({
        id: 'plane:' + i.toString(16).padStart(6, '0'), name: 'Test ' + i, kind: 'plane',
        lat: i % 179 - 89, lon: i % 359 - 179, positionAt: Date.now(), overlayEligible: true,
      }));
      const state = { view: { centerLat: 15, centerLon: 0, zoom: 1 }, layers: { planes: true, sats: false }, objects,
        feed: { status: 'ok', sourceName: 'Synthetic benchmark', receivedAt: Date.now(), coverage: { kind: 'receiver', label: 'Fixture' } }, selectedId: null };
      const results = [];
      for (const open of [false, true]) {
        if (open) ui.openPanel('objects');
        ui.update(state);
        for (let i = 0; i < 5; i++) { state.view = { ...state.view, centerLon: i }; ui.update(state); }
        const samples = [];
        for (let round = 0; round < 9; round++) {
          const start = performance.now();
          for (let i = 0; i < 10; i++) { state.view = { ...state.view, centerLon: i }; ui.update(state); }
          samples.push((performance.now() - start) / 10);
        }
        results.push({ panel: open ? 'objects' : 'closed', samples, median: [...samples].sort((a, b) => a - b)[4] });
      }
      ui.dispose(); return results;
    });
    reports.push({ revision, combinedSourceSha256: createHash('sha256').update(files.join('\n')).digest('hex'), results });
    await page.close();
  }
} finally { await browser.close(); }
const result = { measuredAt: new Date().toISOString(), userAgent, viewport: { width: 900, height: 740, dpr: 1 },
  records: 60000, warmups: 5, rounds: 9, iterations: 10, reports,
  scope: 'Unchanged synthetic object array with repeated view updates. UI JavaScript/DOM/layout only; excludes canvas, paint/compositor, incoming snapshots, network, sensors and phone hardware. These are implementation-stage before/after costs, not a speedup of the whole application.' };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
