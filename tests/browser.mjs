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
const browserDiagnostics = [];
try {
  await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const base = origin + basePath;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  async function contextFor(viewport, camera = 'denied', mockSatelliteFailure = false) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const unexpected = [], errors = [], badResponses = [], satelliteRequests = [];
    const isSatelliteRequest = url => url.origin === 'https://celestrak.org' && url.pathname === '/NORAD/elements/gp.php' &&
      ['stations', 'visual'].includes(url.searchParams.get('GROUP')) && url.searchParams.get('FORMAT') === 'tle';
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      if (mockSatelliteFailure && isSatelliteRequest(url)) {
        satelliteRequests.push(url.href);
        return route.fulfill({ status: 503, contentType: 'text/plain', body: 'Deliberately unavailable browser fixture' });
      }
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
    page.on('pageerror', e => {
      errors.push(e.message);
      browserDiagnostics.push({ viewport, camera, error: e.message });
      console.error('Browser error:', e.message);
    });
    page.on('response', response => {
      if (mockSatelliteFailure && isSatelliteRequest(new URL(response.url())) && response.status() === 503) return;
      if (response.status() >= 400) badResponses.push(response.status() + ' ' + response.url());
    });
    return { context, page, satelliteRequests, check: () => {
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
  async function layoutCheck(page, label) {
    const layout = await page.evaluate(() => ({
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('button, input, select, textarea, h2')].filter(el =>
        el.getClientRects().length && !el.closest('[hidden]')).map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.id, tag: el.tagName, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
      }).filter(r => r.right > innerWidth + 1 || r.left < -1).slice(0, 10),
    }));
    assert.ok(layout.scrollWidth <= layout.width + 1, label + ' has no page overflow: ' + JSON.stringify(layout));
  }
  async function reachable(page, selector) {
    const control = page.locator(selector);
    await control.scrollIntoViewIfNeeded();
    const box = await control.evaluate(el => {
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        viewportWidth: innerWidth, viewportHeight: innerHeight, hit: hit === el || el.contains(hit) };
    });
    assert.ok(box.width >= 24 && box.height >= 24 && box.left >= -1 && box.right <= box.viewportWidth + 1 &&
      box.top >= -1 && box.bottom <= box.viewportHeight + 1 && box.hit,
    selector + ' is visible and directly reachable: ' + JSON.stringify(box));
  }
  async function screenshot(page, label, view) {
    await page.waitForFunction(() => document.querySelector('#toasts')?.childElementCount === 0);
    await layoutCheck(page, label + ' ' + view);
    await page.screenshot({ path: resolve(results, label + '-' + view + '.png'), fullPage: true });
  }
  async function findObject(page, query, id) {
    await page.locator('#openSearch').click();
    await page.locator('#objectSearch').fill(query);
    const result = page.locator('#searchList [data-object-key="' + id + '"]');
    await result.waitFor({ state: 'visible' });
    await result.click();
    await page.locator('#infocard').waitFor({ state: 'visible' });
  }
  async function selectedCoordinates(page) {
    return page.locator('#infocard').evaluate(el => [...el.querySelectorAll('dt')]
      .find(dt => dt.textContent === 'Altitude / azimuth')?.nextElementSibling?.textContent);
  }
  const viewports = [['small-mobile', { width: 320, height: 568 }], ['mobile', { width: 390, height: 844 }],
    ['landscape', { width: 844, height: 390 }], ['desktop', { width: 1365, height: 900 }]];
  for (const [label, viewport] of viewports) {
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
      assert.equal(await page.locator('#nameMode').inputValue(), 'bilingual', 'new sessions default to bilingual object names');
      await page.locator('#savedLocationName').fill('London roof');
      await page.locator('#saveLocation').click();
      await waitText(page, '#savedLocationList', 'London roof');
      await page.locator('#locLat').fill('28.6139');
      await page.locator('#locLon').fill('77.2090');
      await page.locator('#setLoc').click();
      await waitText(page, '#telPos', '28.614');
      await page.locator('#savedLocationName').fill('Temporary spot');
      await page.locator('#saveLocation').click();
      await tab(page, 'saved');
      await page.locator('#savedLocationList').getByRole('button', { name: 'Remove Temporary spot from saved locations', exact: true }).click();
      assert.equal(await page.locator('#savedLocationList').getByRole('button', { name: /^Use Temporary spot\b/ }).count(), 0);
      await page.locator('#savedLocationList').getByRole('button', { name: /^Use London roof\b/ }).click();
      await waitText(page, '#telPos', '51.500');
      await tab(page, 'settings');
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
      assert.equal(await page.locator('#observingView').isVisible(), true, 'observing view is the initial Explore subview');
      assert.equal(await page.locator('#solarView').isHidden(), true, 'solar system does not crowd observing results');
      assert.ok(await page.locator('#toasts .toast').count() <= 1, 'transient messages never stack over controls');
      await page.locator('#tonightBody').scrollIntoViewIfNeeded();
      await screenshot(page, label, 'observing');
      await page.locator('#exploreSolar').click();
      await page.locator('#orbitView svg').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#observingView').isHidden(), true, 'solar and observing subviews are distinct');
      await reachable(page, '#exploreTonight');
      await page.locator('#orbitView svg').scrollIntoViewIfNeeded();
      await screenshot(page, label, 'solar');
      await page.locator('#exploreSolar').press('ArrowLeft');
      assert.equal(await page.locator('#exploreTonight').getAttribute('aria-selected'), 'true', 'Explore subviews support arrow-key navigation');
      await tab(page, 'settings');
      await page.locator('#nameMode').selectOption('hi');
      await findObject(page, 'ओरायन', 'const:Ori:59');
      await waitText(page, '#infocard h2', 'ओरायन');
      await waitText(page, '#infocard', 'Anchor altitude / azimuth');
      await waitText(page, '#infocard', 'anchor');
      await page.locator('#objectEvents[aria-busy="false"]').waitFor();
      assert.equal(await page.locator('#objectEvents dt').count(), 0, 'a constellation figure does not invent single-object rise/set events');
      await page.locator('#infocard').getByRole('button', { name: /^Save object$/ }).click();
      await page.locator('#infocard h2').scrollIntoViewIfNeeded();
      await screenshot(page, label, 'hindi-constellation');
      await findObject(page, 'Orion', 'const:Ori:59');
      await waitText(page, '#infocard h2', 'ओरायन');
      assert.equal(await page.locator('#infocard [data-action="save"]').getAttribute('aria-pressed'), 'true', 'English constellation alias retains saved canonical identity');
      await findObject(page, 'मंगल', 'body:Mars');
      await waitText(page, '#infocard h2', 'मंगल');
      const hindiCoordinates = await selectedCoordinates(page);
      assert.ok(hindiCoordinates && hindiCoordinates.includes('°'), 'selected object has measured coordinate details');
      assert.ok(await page.locator('#infocard h2 [lang="hi"]').count(), 'Hindi object names have an explicit language annotation');
      await page.locator('#objectEvents[aria-busy="false"]').waitFor();
      assert.deepEqual(await page.locator('#objectEvents dt').allTextContents(), ['Rise', 'Transit', 'Set'], 'object details calculate all three observing events');
      assert.match(await page.locator('#objectEvents').textContent(), /2026-12-\d{2} \d{2}:\d{2} UTC/, 'object event times are dated and explicitly UTC');
      await page.locator('#infocard').getByRole('button', { name: /^Save object$/ }).click();
      await reachable(page, '#infocard [data-action="save"]');
      await page.locator('#infocard h2').scrollIntoViewIfNeeded();
      await screenshot(page, label, 'hindi-object');
      if (label === 'mobile') {
        const permissions = await page.evaluate(() => ({ camera: window.__capabilityTest.cameraCalls, geo: window.__capabilityTest.geoCalls }));
        await page.setViewportSize({ width: 844, height: 390 });
        await waitText(page, '#infocard h2', 'मंगल');
        await layoutCheck(page, 'rotation keeps selected Hindi object within viewport');
        await reachable(page, '#infocard [data-action="save"]');
        assert.deepEqual(await page.evaluate(() => ({ camera: window.__capabilityTest.cameraCalls, geo: window.__capabilityTest.geoCalls })), permissions,
          'rotation does not request permissions again');
        await page.setViewportSize(viewport);
      }
      await page.locator('#infocard').getByRole('button', { name: 'Close object details', exact: true }).click();
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.objectKey), 'body:Mars', 'closing details restores focus to its current result');
      await tab(page, 'settings');
      await page.locator('#nameMode').selectOption('en');
      await findObject(page, 'मंगल', 'body:Mars');
      await waitText(page, '#infocard h2', 'Mars');
      assert.equal(await selectedCoordinates(page), hindiCoordinates, 'language changes preserve fixed-time astronomical coordinates');
      await tab(page, 'settings');
      await page.locator('#nameMode').selectOption('hi');
      await findObject(page, 'Mars', 'body:Mars');
      await waitText(page, '#infocard h2', 'मंगल');
      await tab(page, 'tools');
      assert.equal(await page.locator('#panelTools').isVisible(), true, 'Tools is a reachable main destination');
      await waitText(page, '#toolsTime', 'Simulated · 2026-12-14 22:00:00 UTC');
      await waitText(page, '#toolsLocation', 'London roof');
      await waitText(page, '#toolsLocation', '51.500');
      await waitText(page, '#toolsCalculation', 'Astronomy Engine');
      await waitText(page, '#toolsFeedStatus', 'Satellites off · Aircraft off');
      assert.equal(await page.locator('#setPlanes').isChecked(), false, 'tools navigation does not enable location-sharing aircraft feed');
      await page.locator('#returnLive').click();
      await page.locator('#simulationBanner').waitFor({ state: 'hidden' });
      await page.goto(base + '?manual=1&nointro=1&dock=settings', { waitUntil: 'domcontentloaded' });
      await page.locator('#panelSettings').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#setFov').inputValue(), '31', 'FOV persisted');
      assert.equal(await page.locator('#setNight').isChecked(), true, 'night preference persisted');
      assert.equal(await page.locator('#nameMode').inputValue(), 'hi', 'Hindi name preference persisted');
      await waitText(page, '#telPos', '51.500');
      await reachable(page, '#nameMode');
      await screenshot(page, label, 'settings-hindi');
      await tab(page, 'saved');
      assert.equal(await page.locator('#savedLocationList').getByRole('button', { name: /^Use London roof\b/ }).count(), 1, 'saved location survives reload without duplicate rows');
      assert.equal(await page.locator('#savedLocationList').getByRole('button', { name: /^Use Temporary spot\b/ }).count(), 0, 'location removal persists');
      await waitText(page, '#savedList', 'मंगल');
      assert.equal(await page.locator('#savedList [data-object-key="body:Mars"]').count(), 1, 'Hindi favourites retain canonical identity');
      assert.equal(await page.locator('#savedList [data-object-key="const:Ori:59"]').count(), 1, 'Hindi constellation favourites persist without duplicate identities');
      assert.match(await page.locator('#observationNote').inputValue(), /clear northern horizon/, 'note persisted');
      await layoutCheck(page, label + ' saved');
      check();
      completed.push(label + ': camera denial/manual, named-location save/use/remove, Hindi/English planet and constellation search with stable IDs and coordinates, favourites/name persistence, observing/solar separation, Tools time/location/feed status, responsive controls, Pages base path, no external requests');
    } catch (error) {
      browserDiagnostics.push({ label, state: await page.evaluate(() => ({
        focus: document.activeElement?.id, aim: document.querySelector('#telAim')?.textContent,
        camera: document.querySelector('#cameraStatus')?.textContent,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      })).catch(() => null) });
      await page.screenshot({ path: resolve(results, label + '-failure.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  // A mocked 503 proves visible feed failure and privacy behavior, not live API availability.
  {
    const { context, page, check, satelliteRequests } = await contextFor({ width: 390, height: 844 }, 'denied', true);
    try {
      await page.goto(base + '?manual=1&nointro=1&dock=tools', { waitUntil: 'domcontentloaded' });
      await page.locator('#panelTools').waitFor({ state: 'visible' });
      await waitText(page, '#toolsTime', 'Live');
      await waitText(page, '#toolsLocation', 'Demo: New York');
      assert.equal(satelliteRequests.length, 0, 'opening Tools does not request an external feed');
      await page.locator('#trafficDetails > summary').click();
      await reachable(page, '#refreshSatellites');
      await page.locator('#refreshSatellites').click();
      await page.locator('#refreshSatellites[aria-busy="false"]').waitFor();
      await waitText(page, '#satRefreshStatus', 'Live orbital data could not be fully refreshed. Previously retrieved or bundled records may remain; old elements are hidden.');
      await waitText(page, '#satRefreshStatus', 'Next online check no earlier than');
      assert.deepEqual(satelliteRequests.map(url => new URL(url).searchParams.get('GROUP')), ['stations'],
        'the first upstream failure stops the remaining orbital group request');
      await page.locator('#refreshSatellites').click();
      await page.locator('#refreshSatellites[aria-busy="false"]').waitFor();
      await waitText(page, '#satRefreshStatus', 'Live orbital data could not be fully refreshed.');
      assert.equal(satelliteRequests.length, 1, 'repeated checks within the two-hour window reuse fallback metadata without another upstream request');
      assert.equal(await page.locator('#setSats').isChecked(), false, 'refreshing does not enable the satellite layer');
      assert.equal(await page.locator('#setPlanes').isChecked(), false, 'refreshing does not enable aircraft requests');
      await waitText(page, '#toolsFeedStatus', 'Satellites off · Aircraft off');
      await page.locator('#satRefreshStatus').scrollIntoViewIfNeeded();
      await screenshot(page, 'mobile', 'orbital-feed-failure');
      check();
      completed.push('explicit orbital refresh: one mocked 503 stops further requests, repeated check honors two-hour window, visible fallback/failure status, no implicit feed enablement or aircraft request; live API availability not tested');
    } catch (error) {
      await page.screenshot({ path: resolve(results, 'orbital-feed-failure-diagnostic.png'), fullPage: true }).catch(() => {});
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
    timestamp: new Date().toISOString(), completed, passed: !failure, browserDiagnostics,
    failure: failure ? String(failure.stack || failure) : null,
    physicalDeviceAlignment: 'not tested; requires documented phone checklist',
  }, null, 2));
}
if (failure) process.exitCode = 1;
