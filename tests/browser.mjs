// CI browser journeys replay capabilities; they do not prove physical phone alignment.
// npm install --no-save --package-lock=false playwright@1.58.2
// npx playwright install chromium && node tests/browser.mjs
// Optional: PLAYWRIGHT_PKG=/absolute/path/index.mjs, PLAYWRIGHT_EXECUTABLE_PATH=/path/chromium.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = resolve(root, 'test-results');
await mkdir(results, { recursive: true });
async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_PKG) return import(pathToFileURL(resolve(process.env.PLAYWRIGHT_PKG)).href);
  try { return await import('playwright'); }
  catch { return import('/opt/codex/cua_node/lib/node_modules/playwright/index.mjs'); }
}
const { chromium } = await loadPlaywright();
const basePath = '/skylens/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith(basePath)) { response.writeHead(404).end('Project prefix required'); return; }
    let rel = decodeURIComponent(url.pathname.slice(basePath.length));
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const path = resolve(root, rel);
    if (!path.startsWith(root + sep) || rel.split('/').some(p => p.startsWith('.'))) {
      response.writeHead(403).end('Forbidden'); return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(404).end('Not found'); }
});
let browser, failure;
const completed = [];
try {
  await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const base = origin + basePath;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  async function contextFor(viewport, camera = 'denied') {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const unexpected = [], errors = [], badResponses = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      unexpected.push(url.href);
      return route.abort('blockedbyclient');
    });
    await context.addInitScript(({ camera }) => {
      window.__capabilityTest = { cameraCalls: 0, geoCalls: 0, motionCalls: 0, stopped: 0, tracks: [] };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition(_success, error) {
          window.__capabilityTest.geoCalls++;
          queueMicrotask(() => error({ code: 1, message: 'Permission denied by test' }));
        },
      } });
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
        async getUserMedia() {
          window.__capabilityTest.cameraCalls++;
          if (camera === 'denied') throw new DOMException('Permission denied by test', 'NotAllowedError');
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 480;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#203044'; ctx.fillRect(0, 0, 640, 480);
          const stream = canvas.captureStream(2);
          for (const track of stream.getVideoTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => { window.__capabilityTest.stopped++; stop(); };
            track.getSettings = () => ({ facingMode: 'environment', width: 640, height: 480 });
            window.__capabilityTest.tracks.push(track);
          }
          return stream;
        },
      } });
      if (window.DeviceOrientationEvent) Object.defineProperty(window.DeviceOrientationEvent, 'requestPermission', {
        configurable: true, value: async () => { window.__capabilityTest.motionCalls++; return 'granted'; },
      });
    }, { camera });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => {
      if (response.status() >= 400) badResponses.push(response.status() + ' ' + response.url());
    });
    return { context, page, check: () => {
      assert.deepEqual(errors, [], 'no uncaught browser errors');
      assert.deepEqual(badResponses, [], 'all local assets resolve under Pages project path');
      assert.deepEqual(unexpected, [], 'no external requests before optional feed is enabled');
    } };
  }
  async function tab(page, name) {
    if (await page.locator('#dockContent').isHidden()) await page.locator('#dockHandle').click();
    await page.locator('[data-tab="' + name + '"]').click();
  }
  async function waitText(page, selector, expected) {
    await page.waitForFunction(({ selector, expected }) =>
      (document.querySelector(selector)?.textContent || '').includes(expected), { selector, expected });
  }
  for (const [label, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1365, height: 900 }]]) {
    const { context, page, check } = await contextFor(viewport);
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnAR').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => window.__capabilityTest.cameraCalls), 0, 'camera permission is user initiated');
      assert.equal(await page.evaluate(() => window.__capabilityTest.geoCalls), 0, 'location permission is user initiated');
      await page.locator('#btnAR').click();
      await page.waitForFunction(() => window.__capabilityTest.cameraCalls === 1);
      await page.waitForFunction(() => /denied|unavailable|not allowed|permission/i.test(document.querySelector('#cameraStatus')?.textContent || ''));
      assert.equal(await page.locator('#cam').evaluate(el => el.srcObject), null, 'denied camera has no stream');
      await page.locator('#sky').focus();
      const before = await page.locator('#telAim').textContent();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(before => document.querySelector('#telAim')?.textContent !== before, before);
      await tab(page, 'settings');
      await page.locator('#locGps').click();
      await page.waitForFunction(() => window.__capabilityTest.geoCalls === 1);
      await page.locator('#locLat').fill('51.5');
      await page.locator('#locLon').fill('0');
      await page.locator('#setLoc').click();
      await waitText(page, '#telPos', '51.500');
      await page.locator('#alignmentDetails > summary').click();
      await page.locator('#setFov').focus();
      await page.locator('#setFov').press('Home');
      await page.locator('#setFov').press('ArrowRight');
      await page.locator('#setNight').check();
      assert.equal(await page.locator('body').evaluate(el => el.classList.contains('night')), true);
      await page.locator('#openSearch').click();
      await page.locator('#objectSearch').fill('Sirius');
      await page.locator('#searchList button').first().click();
      await page.locator('#infocard').waitFor({ state: 'visible' });
      await waitText(page, '#infocard', 'Sirius');
      await page.locator('#infocard').getByRole('button', { name: /^Save object$/ }).click();
      await tab(page, 'saved');
      await waitText(page, '#savedList', 'Sirius');
      await page.locator('#observationNote').fill('Browser release journey: clear northern horizon.');
      await page.locator('#notesForm').getByRole('button', { name: 'Save note', exact: true }).click();
      await tab(page, 'tonight');
      await page.locator('#skyTime').fill('2026-12-14T22:00');
      await page.locator('#timeForm').getByRole('button', { name: 'Set time', exact: true }).click();
      await page.locator('#simulationBanner').waitFor({ state: 'visible' });
      await waitText(page, '#telTime', '2026-12-14');
      await waitText(page, '#tonightBody', 'Moon');
      await page.screenshot({ path: resolve(results, label + '-explore.png'), fullPage: true });
      await page.locator('#returnLive').click();
      await page.locator('#simulationBanner').waitFor({ state: 'hidden' });
      await page.goto(base + '?manual=1&nointro=1&dock=settings', { waitUntil: 'domcontentloaded' });
      await page.locator('#panelSettings').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#setFov').inputValue(), '31', 'FOV persisted');
      assert.equal(await page.locator('#setNight').isChecked(), true, 'night preference persisted');
      await waitText(page, '#telPos', '51.500');
      await tab(page, 'saved');
      await waitText(page, '#savedList', 'Sirius');
      assert.match(await page.locator('#observationNote').inputValue(), /clear northern horizon/, 'note persisted');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal viewport overflow');
      await page.screenshot({ path: resolve(results, label + '-saved.png'), fullPage: true });
      check();
      completed.push(label + ': permission denial, manual keyboard, location fallback/input, search/select/save, UTC simulation, persistence, Pages base path, no external requests');
    } catch (error) {
      await page.screenshot({ path: resolve(results, label + '-failure.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  // MediaStream from canvas. No real camera frames or physical hardware involved.
  {
    const { context, page, check } = await contextFor({ width: 390, height: 844 }, 'granted');
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnAR').click();
      await page.waitForFunction(() => !!document.querySelector('#cam')?.srcObject);
      await page.locator('#cameraToggle').click();
      await page.waitForFunction(() => document.querySelector('#cam')?.srcObject === null);
      assert.equal(await page.evaluate(() => window.__capabilityTest.tracks.every(t => t.readyState === 'ended')), true, 'stop releases all tracks');
      await page.locator('#cameraToggle').click();
      await page.waitForFunction(() => window.__capabilityTest.cameraCalls === 2 && !!document.querySelector('#cam')?.srcObject);
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await page.waitForFunction(() => window.__capabilityTest.tracks.every(t => t.readyState === 'ended'));
      check();
      completed.push('camera mock: start, stop, restart, pagehide track cleanup; physical alignment untested');
    } finally { await context.close(); }
  }
  console.log(completed.map(item => 'PASS ' + item).join('\n'));
} catch (error) {
  failure = error;
  console.error(error);
} finally {
  await browser?.close();
  if (server.listening) await new Promise(ok => server.close(ok));
  await writeFile(resolve(results, 'browser-results.json'), JSON.stringify({
    timestamp: new Date().toISOString(), completed, passed: !failure,
    failure: failure ? String(failure.stack || failure) : null,
    physicalDeviceAlignment: 'not tested; requires documented phone checklist',
  }, null, 2));
}
if (failure) process.exitCode = 1;
