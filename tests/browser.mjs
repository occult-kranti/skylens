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
const layoutMeasurements = [];
try {
  await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const base = origin + basePath;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  async function contextFor(viewport, camera = 'denied', mockSatelliteFailure = false, motion = 'granted', deviceScaleFactor = 1) {
    const context = await browser.newContext({ viewport, deviceScaleFactor, reducedMotion: 'reduce', serviceWorkers: 'block' });
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
    await context.addInitScript(({ camera, motion }) => {
      const orientationListeners = new Map(['deviceorientation', 'deviceorientationabsolute'].map(name => [name, new Set()]));
      const nativeAdd = window.addEventListener.bind(window), nativeRemove = window.removeEventListener.bind(window);
      window.addEventListener = (name, listener, options) => {
        orientationListeners.get(name)?.add(listener); return nativeAdd(name, listener, options);
      };
      window.removeEventListener = (name, listener, options) => {
        orientationListeners.get(name)?.delete(listener); return nativeRemove(name, listener, options);
      };
      window.__capabilityTest = { cameraCalls: 0, geoCalls: 0, motionCalls: 0, stopped: 0, tracks: [], motionActivations: [],
        get orientationListenerCount() { return [...orientationListeners.values()].reduce((total, list) => total + list.size, 0); },
        setHidden(hidden) {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
          document.dispatchEvent(new Event('visibilitychange'));
        },
      };
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
      if (motion === 'unsupported') Object.defineProperty(window, 'DeviceOrientationEvent', { configurable: true, value: undefined });
      if (window.DeviceOrientationEvent) Object.defineProperty(window.DeviceOrientationEvent, 'requestPermission', {
        configurable: true, value: () => {
          window.__capabilityTest.motionCalls++;
          window.__capabilityTest.motionActivations.push(navigator.userActivation.isActive);
          return motion === 'deferred' ? new Promise(resolve => { window.__capabilityTest.resolveMotion = resolve; }) : Promise.resolve(motion);
        },
      });
    }, { camera, motion });
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
  async function usablePanelAndControls(page, selector, label) {
    // Let the application's measured console sizing settle. Do not scroll controls
    // into view: that can hide an unusably small panel or displaced primary actions.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const measured = await page.evaluate(selector => {
      const visibleRect = element => {
        const box = element.getBoundingClientRect();
        let left = Math.max(0, box.left), right = Math.min(innerWidth, box.right);
        let top = Math.max(0, box.top), bottom = Math.min(innerHeight, box.bottom);
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
          // display:contents generates no box, so its inherited overflow value
          // cannot clip the fixed tool surfaces that remain in its DOM subtree.
          if (style.display === 'contents') continue;
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
            left = Math.max(left, bounds.left + parent.clientLeft);
            right = Math.min(right, bounds.left + parent.clientLeft + parent.clientWidth);
          }
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
            top = Math.max(top, bounds.top + parent.clientTop);
            bottom = Math.min(bottom, bounds.top + parent.clientTop + parent.clientHeight);
          }
        }
        const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
        return { width: box.width, height: box.height, visibleWidth: Math.max(0, right - left),
          visibleHeight: Math.max(0, bottom - top), left, right, top, bottom,
          hit: hit === element || element.contains(hit) };
      };
      const panel = document.querySelector(selector);
      return { viewport: { width: innerWidth, height: innerHeight }, panel: panel ? visibleRect(panel) : null,
        controls: ['trackingToggle', 'cameraToggle'].map(id => ({ id, ...visibleRect(document.getElementById(id)) })) };
    }, selector);
    layoutMeasurements.push({ label, selector, ...measured });
    assert.ok(measured.panel && measured.panel.visibleHeight >= 140 && measured.panel.hit,
      label + ' provides at least 140 CSS px of visible panel viewport: ' + JSON.stringify(measured));
    for (const control of measured.controls) assert.ok(control.width >= 24 && control.height >= 24 &&
      control.visibleWidth >= control.width - 1 && control.visibleHeight >= control.height - 1 && control.hit,
    label + ' keeps primary control ' + control.id + ' fully visible without scrolling: ' + JSON.stringify(measured));
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
  async function trackingStatus(page, status) {
    await page.waitForFunction(status => document.querySelector('#trackingStatus')?.dataset.status === status, status);
  }
  async function emitOrientation(page, alpha, beta = 90, gamma = 0, absolute = true) {
    await page.evaluate(sample => {
      const type = sample.absolute ? 'deviceorientationabsolute' : 'deviceorientation';
      window.dispatchEvent(new DeviceOrientationEvent(type, sample));
    }, { alpha, beta, gamma, absolute });
  }
  async function headingNear(page, expected) {
    await page.waitForFunction(expected => {
      const match = document.querySelector('#telAim')?.textContent.match(/(-?\d+(?:\.\d+)?)°/);
      return match && Math.abs(((Number(match[1]) - expected + 540) % 360) - 180) <= 2;
    }, expected);
  }
  // 640 CSS pixels at DPR2 emulate the layout of a 1280px desktop at200% zoom;
  // this is a reflow equivalent, not native browser UI zoom or physical pinch testing.
  const viewports = [['small-mobile', { width: 320, height: 568 }], ['mobile', { width: 390, height: 844 }],
    ['landscape', { width: 844, height: 390 }], ['desktop', { width: 1365, height: 900 }],
    ['reflow-200-equivalent', { width: 640, height: 512 }, 2]];
  for (const [label, viewport, deviceScaleFactor = 1] of viewports) {
    const { context, page, check } = await contextFor(viewport, 'denied', false, 'granted', deviceScaleFactor);
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnAR').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => window.__capabilityTest.cameraCalls), 0, 'camera permission is user initiated');
      assert.equal(await page.evaluate(() => window.__capabilityTest.geoCalls), 0, 'location permission is user initiated');
      await page.locator('#btnCamera').click();
      await page.waitForFunction(() => window.__capabilityTest.cameraCalls === 1);
      await page.waitForFunction(() => /denied|unavailable|not allowed|permission/i.test(document.querySelector('#cameraStatus')?.textContent || ''));
      assert.equal(await page.locator('#cam').evaluate(el => el.srcObject), null, 'denied camera has no stream');
      await page.locator('#sky').focus();
      const before = await page.locator('#telAim').textContent();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(before => document.querySelector('#telAim')?.textContent !== before, before);
      await reachable(page, '#toggleHindiNames');
      assert.equal(await page.locator('#toggleHindiNames').getAttribute('aria-label'), 'Hindi names: Hide Hindi');
      assert.equal(await page.locator('#toggleHindiNames').getAttribute('aria-pressed'), 'true', 'direct Hindi control reflects the default bilingual view');
      assert.equal(await page.locator('#dockContent').isHidden(), true, 'Hindi visibility can change without opening tools');
      await page.locator('#toggleHindiNames').click();
      assert.equal(await page.locator('#toggleHindiNames').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#toggleHindiNames').getAttribute('aria-label'), 'Hindi names: Show Hindi');
      assert.equal(await page.locator('#nameMode').inputValue(), 'en', 'direct hide synchronizes the Settings selector');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('skylens.preferences.v2')).nameMode), 'en', 'direct hide persists the shared preference');
      await findObject(page, 'मंगल', 'body:Mars');
      await waitText(page, '#infocard h2', 'Mars');
      assert.equal(await page.locator('#infocard h2 [lang="hi"]').count(), 0, 'hidden Hindi names are absent from the selected-object heading');
      await page.goto(base + '?manual=1&nointro=1', { waitUntil: 'domcontentloaded' });
      await page.locator('#toggleHindiNames[aria-pressed="false"]').waitFor();
      assert.equal(await page.locator('#nameMode').inputValue(), 'en', 'direct hide survives reload');
      await waitText(page, '#toggleHindiNames', 'Show Hindi');
      await reachable(page, '#toggleHindiNames');
      await screenshot(page, label, 'sky-hindi-toggle');
      await page.locator('#toggleHindiNames').click();
      assert.equal(await page.locator('#toggleHindiNames').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#nameMode').inputValue(), 'bilingual', 'direct show restores Hindi and English together');
      await findObject(page, 'Mars', 'body:Mars');
      await waitText(page, '#infocard h2', 'मंगल');
      await waitText(page, '#infocard h2', 'Mars');
      assert.equal(await page.locator('#infocard h2 [lang="hi"]').count(), 1, 'direct show restores the annotated Hindi name');
      await findObject(page, 'Polaris', 'star:48');
      await waitText(page, '#infocard h2', 'ध्रुव तारा');
      assert.equal(await page.locator('#infocard .hindi-aliases').isVisible(), true, 'Hindi aliases are available when enabled');
      await page.locator('#objectEvents[aria-busy="false"]').waitFor();
      const polarisEvents = await page.locator('#objectEvents').elementHandle();
      const polarisCoordinates = await selectedCoordinates(page);
      await reachable(page, '#toggleHindiNames');
      await page.locator('#toggleHindiNames').click();
      await waitText(page, '#infocard h2', 'Polaris');
      assert.equal(await page.locator('#infocard h2 [lang="hi"]').count(), 0);
      assert.equal(await page.locator('#infocard .hindi-aliases').isHidden(), true, 'direct hide also hides Hindi traditional aliases in the open detail card');
      assert.equal(await selectedCoordinates(page), polarisCoordinates, 'changing name visibility preserves the selected coordinates');
      assert.equal(await polarisEvents.evaluate(node => node === document.querySelector('#objectEvents')), true, 'changing name visibility preserves calculated event content');
      await page.locator('#toggleHindiNames').click();
      await waitText(page, '#infocard h2', 'ध्रुव तारा');
      assert.equal(await page.locator('#infocard .hindi-aliases').isVisible(), true, 'direct show restores aliases in the same card');
      await polarisEvents.dispose();
      await page.locator('#infocard').getByRole('button', { name: 'Close object details', exact: true }).click();
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
      await usablePanelAndControls(page, '#panelExplore', label + ' observing at selected time');
      await screenshot(page, label, 'observing');
      await page.locator('#exploreSolar').click();
      await page.locator('#orbitView svg').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#observingView').isHidden(), true, 'solar and observing subviews are distinct');
      await reachable(page, '#exploreTonight');
      await page.locator('#orbitView svg').scrollIntoViewIfNeeded();
      await usablePanelAndControls(page, '#panelExplore', label + ' solar at selected time');
      await screenshot(page, label, 'solar');
      await page.locator('#exploreSolar').press('ArrowLeft');
      assert.equal(await page.locator('#exploreTonight').getAttribute('aria-selected'), 'true', 'Explore subviews support arrow-key navigation');
      await tab(page, 'settings');
      await page.locator('#nameMode').selectOption('hi');
      assert.equal(await page.locator('#toggleHindiNames').getAttribute('aria-pressed'), 'true', 'Hindi-only Settings selection synchronizes the direct control');
      await findObject(page, 'ओरायन', 'const:Ori:59');
      await waitText(page, '#infocard h2', 'ओरायन');
      await waitText(page, '#infocard', 'Anchor altitude / azimuth');
      await waitText(page, '#infocard', 'anchor');
      await page.locator('#objectEvents[aria-busy="false"]').waitFor();
      assert.equal(await page.locator('#objectEvents dt').count(), 0, 'a constellation figure does not invent single-object rise/set events');
      await page.locator('#infocard').getByRole('button', { name: /^Save object$/ }).click();
      await page.locator('#infocard h2').scrollIntoViewIfNeeded();
      await usablePanelAndControls(page, '#infocard', label + ' constellation detail');
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
      await usablePanelAndControls(page, '#infocard', label + ' planet detail');
      await screenshot(page, label, 'hindi-object');
      if (label === 'mobile') {
        const permissions = await page.evaluate(() => ({ camera: window.__capabilityTest.cameraCalls, geo: window.__capabilityTest.geoCalls }));
        await page.setViewportSize({ width: 844, height: 390 });
        await waitText(page, '#infocard h2', 'मंगल');
        await layoutCheck(page, 'rotation keeps selected Hindi object within viewport');
        await reachable(page, '#infocard [data-action="save"]');
        await usablePanelAndControls(page, '#infocard', 'rotated planet detail');
        assert.deepEqual(await page.evaluate(() => ({ camera: window.__capabilityTest.cameraCalls, geo: window.__capabilityTest.geoCalls })), permissions,
          'rotation does not request permissions again');
        await page.setViewportSize(viewport);
      }
      await page.locator('#infocard').getByRole('button', { name: 'Close object details', exact: true }).click();
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.objectKey), 'body:Mars', 'closing details restores focus to its current result');
      await tab(page, 'settings');
      await page.locator('#nameMode').selectOption('en');
      assert.equal(await page.locator('#toggleHindiNames').getAttribute('aria-pressed'), 'false', 'English Settings selection synchronizes the direct control');
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
      await usablePanelAndControls(page, '#panelTools', label + ' Tools at selected time');
      assert.equal(await page.locator('#setPlanes').isChecked(), false, 'tools navigation does not enable location-sharing aircraft feed');
      await page.locator('#returnLive').click();
      await page.locator('#simulationBanner').waitFor({ state: 'hidden' });
      await page.goto(base + '?manual=1&nointro=1&dock=settings', { waitUntil: 'domcontentloaded' });
      await page.locator('#panelSettings').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#setFov').inputValue(), '31', 'FOV persisted');
      assert.equal(await page.locator('#setNight').isChecked(), true, 'night preference persisted');
      assert.equal(await page.locator('#nameMode').inputValue(), 'hi', 'Hindi name preference persisted');
      assert.equal(await page.locator('#toggleHindiNames').getAttribute('aria-pressed'), 'true', 'direct control restores persisted Hindi-only state');
      await waitText(page, '#telPos', '51.500');
      await reachable(page, '#nameMode');
      await usablePanelAndControls(page, '#panelSettings', label + ' Settings');
      await screenshot(page, label, 'settings-hindi');
      await tab(page, 'saved');
      assert.equal(await page.locator('#savedLocationList').getByRole('button', { name: /^Use London roof\b/ }).count(), 1, 'saved location survives reload without duplicate rows');
      assert.equal(await page.locator('#savedLocationList').getByRole('button', { name: /^Use Temporary spot\b/ }).count(), 0, 'location removal persists');
      await waitText(page, '#savedList', 'मंगल');
      assert.equal(await page.locator('#savedList [data-object-key="body:Mars"]').count(), 1, 'Hindi favourites retain canonical identity');
      assert.equal(await page.locator('#savedList [data-object-key="const:Ori:59"]').count(), 1, 'Hindi constellation favourites persist without duplicate identities');
      assert.match(await page.locator('#observationNote').inputValue(), /clear northern horizon/, 'note persisted');
      await layoutCheck(page, label + ' saved');
      await usablePanelAndControls(page, '#panelSaved', label + ' Saved');
      check();
      completed.push(label + ': camera denial/manual, direct Sky Hindi show/hide with Settings synchronization and reload, named-location save/use/remove, Hindi/English planet and constellation search with stable IDs and coordinates, favourites/name persistence, observing/solar separation, Tools time/location/feed status, responsive controls, Pages base path, no external requests');
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
  // Native DOM orientation events with controlled permission results exercise the integration,
  // not a real compass, physical alignment, or a platform permission sheet.
  {
    const { context, page, check } = await contextFor({ width: 390, height: 844 }, 'granted');
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnAR').click();
      await trackingStatus(page, 'waiting');
      assert.equal(await page.evaluate(() => window.__capabilityTest.cameraCalls), 0, 'Start Auto AR never requests camera access');
      assert.equal(await page.evaluate(() => window.__capabilityTest.motionCalls), 1);
      assert.deepEqual(await page.evaluate(() => window.__capabilityTest.motionActivations), [true], 'motion permission is requested within the click activation');
      assert.equal(await page.evaluate(() => window.__capabilityTest.orientationListenerCount), 2);
      await emitOrientation(page, 0);
      await trackingStatus(page, 'tracking');
      await headingNear(page, 0);
      await emitOrientation(page, 90);
      await headingNear(page, 270);
      assert.equal(await page.locator('#cam').evaluate(el => el.srcObject), null);
      await reachable(page, '#trackingToggle');
      await screenshot(page, 'mobile', 'auto-ar-without-camera');
      await page.locator('#cameraToggle').click();
      await page.waitForFunction(() => !!document.querySelector('#cam')?.srcObject);
      assert.equal(await page.evaluate(() => window.__capabilityTest.motionCalls), 1, 'adding camera keeps the established motion session');
      await emitOrientation(page, 180);
      await headingNear(page, 180);
      await screenshot(page, 'mobile', 'auto-ar-camera');
      await page.locator('#trackingToggle').click();
      await trackingStatus(page, 'off');
      assert.equal(await page.locator('#cam').evaluate(el => !!el.srcObject), true, 'stopping motion keeps the independently enabled camera');
      assert.equal(await page.evaluate(() => window.__capabilityTest.orientationListenerCount), 0);
      await page.locator('#trackingToggle').click();
      await trackingStatus(page, 'waiting');
      await page.locator('#cameraToggle').click();
      await page.waitForFunction(() => document.querySelector('#cam')?.srcObject === null);
      assert.equal(await page.locator('#trackingToggle').getAttribute('aria-pressed'), 'true', 'stopping camera retains requested tracking');
      await emitOrientation(page, 270);
      await headingNear(page, 90);
      await trackingStatus(page, 'tracking');
      await page.locator('#sky').focus();
      await page.keyboard.press('ArrowRight');
      await trackingStatus(page, 'off');
      assert.equal(await page.locator('#trackingToggle').getAttribute('aria-pressed'), 'false', 'intentional manual navigation stops following the phone');
      assert.equal(await page.evaluate(() => window.__capabilityTest.orientationListenerCount), 0, 'manual navigation removes both tracking listeners');
      await emitOrientation(page, 0);
      await page.locator('#sky').focus();
      const manualHeading = await page.locator('#telAim').textContent();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(before => document.querySelector('#telAim')?.textContent !== before, manualHeading);
      await page.locator('#trackingToggle').click();
      await trackingStatus(page, 'waiting');
      assert.equal(await page.evaluate(() => window.__capabilityTest.motionCalls), 1, 'same-session restart reuses an established permission grant');
      // Observe coordinates sent to the real main canvas, not a copy of the projection
      // formula. A level-only fallback can keep heading correct while snapping roll.
      await page.evaluate(() => {
        const ctx = document.querySelector('#sky').getContext('2d');
        const fill = ctx.fillText.bind(ctx), clear = ctx.clearRect.bind(ctx);
        window.__projectionTrace = { frame: 0, north: null };
        ctx.clearRect = (...args) => { window.__projectionTrace.frame++; window.__projectionTrace.north = null; return clear(...args); };
        ctx.fillText = (text, x, y, ...args) => {
          if (text === 'N') window.__projectionTrace.north = { x, y };
          return fill(text, x, y, ...args);
        };
      });
      await emitOrientation(page, 0);
      await headingNear(page, 0);
      await page.waitForFunction(() => !!window.__projectionTrace.north);
      const levelNorth = await page.evaluate(() => window.__projectionTrace.north);
      await page.evaluate(() => Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 90 }));
      await emitOrientation(page, 0);
      await page.waitForFunction(level => {
        const trace = window.__projectionTrace, point = trace.north;
        if (!point || trace.checkedFrame === trace.frame) return false;
        trace.checkedFrame = trace.frame;
        const settled = trace.previous && Math.hypot(point.x - trace.previous.x, point.y - trace.previous.y) < 0.02;
        trace.stableFrames = settled ? (trace.stableFrames || 0) + 1 : 0;
        trace.previous = point;
        return trace.stableFrames >= 6 && Math.hypot(point.x - level.x, point.y - level.y) > 10;
      }, levelNorth);
      const rolledNorth = await page.evaluate(() => window.__projectionTrace.north);
      await trackingStatus(page, 'stale');
      assert.equal(await page.evaluate(() => window.__capabilityTest.orientationListenerCount), 2, 'stale tracking can recover on a fresh sample');
      await page.waitForFunction(frame => window.__projectionTrace.frame >= frame + 3, await page.evaluate(() => window.__projectionTrace.frame));
      const staleNorth = await page.evaluate(() => window.__projectionTrace.north);
      assert.ok(staleNorth && Math.hypot(staleNorth.x - rolledNorth.x, staleNorth.y - rolledNorth.y) < 1,
        'stale motion preserves the actual rolled canvas projection: ' + JSON.stringify({ levelNorth, rolledNorth, staleNorth }));
      await screenshot(page, 'mobile', 'auto-ar-stale-roll');
      await page.evaluate(() => Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 0 }));
      await emitOrientation(page, 125);
      await trackingStatus(page, 'tracking');
      await headingNear(page, 235);
      await page.locator('#cameraToggle').click();
      await page.waitForFunction(() => !!document.querySelector('#cam')?.srcObject);
      const permissions = await page.evaluate(() => ({ camera: window.__capabilityTest.cameraCalls, motion: window.__capabilityTest.motionCalls }));
      await page.evaluate(() => window.__capabilityTest.setHidden(true));
      await trackingStatus(page, 'paused');
      assert.equal(await page.evaluate(() => window.__capabilityTest.orientationListenerCount), 0, 'backgrounding releases orientation listeners');
      assert.equal(await page.locator('#cam').evaluate(el => el.srcObject), null, 'backgrounding releases video');
      assert.equal(await page.evaluate(() => window.__capabilityTest.tracks.every(track => track.readyState === 'ended')), true);
      await emitOrientation(page, 0);
      await page.evaluate(() => window.__capabilityTest.setHidden(false));
      await trackingStatus(page, 'waiting');
      assert.deepEqual(await page.evaluate(() => ({ camera: window.__capabilityTest.cameraCalls, motion: window.__capabilityTest.motionCalls })), permissions,
        'returning resumes authorized motion without prompting or restarting camera');
      assert.equal(await page.locator('#cam').evaluate(el => el.srcObject), null);
      await emitOrientation(page, 0);
      await trackingStatus(page, 'tracking');
      await headingNear(page, 0);
      check();
      completed.push('orientation replay: gesture grant, camera-free heading updates, independent camera start/stop, manual fallback, stale recovery, background listener/video cleanup, authorized motion-only resume');
    } catch (error) {
      await page.screenshot({ path: resolve(results, 'tracking-lifecycle-failure.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  {
    const { context, page, check } = await contextFor({ width: 390, height: 844 }, 'denied');
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnAR').click();
      await trackingStatus(page, 'waiting');
      await emitOrientation(page, 0);
      await headingNear(page, 0);
      await page.locator('#cameraToggle').click();
      await page.waitForFunction(() => /denied|unavailable|not allowed|permission/i.test(document.querySelector('#cameraStatus')?.textContent || ''));
      assert.equal(await page.locator('#cam').evaluate(el => el.srcObject), null);
      assert.equal(await page.locator('#trackingToggle').getAttribute('aria-pressed'), 'true', 'camera denial retains requested motion');
      await emitOrientation(page, 90);
      await trackingStatus(page, 'tracking');
      await headingNear(page, 270);
      assert.equal(await page.evaluate(() => window.__capabilityTest.motionCalls), 1);
      await screenshot(page, 'mobile', 'auto-ar-camera-denied');
      check();
      completed.push('camera denial leaves authorized sensor tracking active with continuing heading updates');
    } catch (error) {
      await page.screenshot({ path: resolve(results, 'tracking-camera-denied-failure.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  for (const motion of ['denied', 'unsupported', 'deferred']) {
    const { context, page, check } = await contextFor({ width: 390, height: 844 }, 'granted', false, motion);
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#btnAR').click();
      if (motion === 'deferred') {
        await trackingStatus(page, 'requesting');
        await page.locator('#trackingToggle').click();
        await trackingStatus(page, 'off');
        await page.evaluate(() => window.__capabilityTest.resolveMotion('granted'));
        await emitOrientation(page, 0);
        await trackingStatus(page, 'off');
        assert.equal(await page.locator('#trackingToggle').getAttribute('aria-pressed'), 'false');
        assert.equal(await page.evaluate(() => window.__capabilityTest.orientationListenerCount), 0, 'a cancelled late permission result cannot attach sensors');
        assert.equal(await page.evaluate(() => window.__capabilityTest.cameraCalls), 0);
        await page.locator('#trackingToggle').click();
        await trackingStatus(page, 'requesting');
        const requestsBeforeBackground = await page.evaluate(() => window.__capabilityTest.motionCalls);
        await page.evaluate(() => window.__capabilityTest.setHidden(true));
        await trackingStatus(page, 'paused');
        await page.evaluate(() => window.__capabilityTest.resolveMotion('granted'));
        await page.evaluate(() => window.__capabilityTest.setHidden(false));
        await trackingStatus(page, 'paused');
        assert.equal(await page.evaluate(() => window.__capabilityTest.orientationListenerCount), 0, 'backgrounded pending permission cannot establish a resumable grant');
        assert.equal(await page.evaluate(() => window.__capabilityTest.motionCalls), requestsBeforeBackground, 'returning does not prompt for unknown permission');
        await page.locator('#trackingToggle').click();
        await trackingStatus(page, 'requesting');
        assert.equal(await page.evaluate(() => window.__capabilityTest.motionCalls), requestsBeforeBackground + 1, 'the next explicit gesture can request motion again');
        await page.locator('#trackingToggle').click();
        await trackingStatus(page, 'off');
      } else {
        await trackingStatus(page, motion);
        assert.equal(await page.evaluate(() => window.__capabilityTest.orientationListenerCount), 0);
        assert.equal(await page.evaluate(() => window.__capabilityTest.cameraCalls), 0);
        await page.locator('#cameraToggle').click();
        await page.waitForFunction(() => !!document.querySelector('#cam')?.srcObject);
        await trackingStatus(page, motion);
        assert.equal(await page.evaluate(() => window.__capabilityTest.cameraCalls), 1, 'camera works independently when motion is denied or unsupported');
        await page.locator('#sky').focus();
        const before = await page.locator('#telAim').textContent();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(before => document.querySelector('#telAim')?.textContent !== before, before);
      }
      check();
      completed.push('orientation ' + motion + ': explicit status, no unrequested camera, safe fallback or cancelled late grant');
    } catch (error) {
      await page.screenshot({ path: resolve(results, 'tracking-' + motion + '-failure.png'), fullPage: true }).catch(() => {});
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
      await page.locator('#btnCamera').click();
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
    timestamp: new Date().toISOString(), completed, passed: !failure, browserDiagnostics, layoutMeasurements,
    failure: failure ? String(failure.stack || failure) : null,
    physicalDeviceAlignment: 'not tested; requires documented phone checklist',
  }, null, 2));
}
if (failure) process.exitCode = 1;
