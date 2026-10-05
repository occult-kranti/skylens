// Offline browser integration gate for nearby tracking. No live provider calls.
// Requires the same Playwright/Chromium installation as tests/browser.mjs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = resolve(root, 'test-results');
await mkdir(results, { recursive: true });
const playwright = process.env.PLAYWRIGHT_PKG
  ? await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_PKG)).href)
  : await import('playwright').catch(() => import('/opt/codex/cua_node/lib/node_modules/playwright/index.mjs'));
const { chromium } = playwright;
const instant = Date.parse('2000-06-27T18:50:19.733Z');
// Vallado's published Vanguard 1 verification elements, expressed as OMM JSON.
// The browser uses the real SGP4 engine. Independent vector accuracy is gated
// separately in the calculation suite; this fixture tests integration/display.
const orbit = {
  OBJECT_NAME: 'VANGUARD QA', OBJECT_ID: '1958-002B', NORAD_CAT_ID: 5,
  CLASSIFICATION_TYPE: 'U', EPOCH: '2000-06-27T18:50:19.733568',
  MEAN_MOTION: 10.82419157, ECCENTRICITY: 0.1859667, INCLINATION: 34.2682,
  RA_OF_ASC_NODE: 348.7242, ARG_OF_PERICENTER: 331.7664, MEAN_ANOMALY: 19.3264,
  EPHEMERIS_TYPE: 0, ELEMENT_SET_NO: 475, REV_AT_EPOCH: 41366,
  BSTAR: 0.000028098, MEAN_MOTION_DOT: 0.00000023, MEAN_MOTION_DDOT: 0,
};
const response = now => ({ now, ac: [
  { hex: 'abcdef', flight: 'NEAR123', lat: 0, lon: 150.01, alt_geom: 10000, alt_baro: 8000,
    seen_pos: 0, gs: 120, track: 90, geom_rate: 0, nic: 8, nac_p: 9, sil: 3 },
  { hex: '654321', flight: 'BARO77', lat: 0.03, lon: 150, alt_baro: 5000, seen_pos: 0 },
  { hex: '123456', flight: 'STALE99', lat: 0, lon: 150.02, alt_geom: 10000, seen_pos: 61 },
  { hex: '111111', flight: 'GROUND', lat: 0, lon: 150.02, alt_baro: 'ground', alt_geom: 0, seen_pos: 0 },
  { hex: '222222', flight: 'FAR999', lat: 0, lon: 160, alt_geom: 10000, seen_pos: 0 },
] });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (request, res) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/skylens/')) { res.writeHead(404).end(); return; }
    let rel = decodeURIComponent(pathname.slice('/skylens/'.length));
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = resolve(root, rel);
    if (!file.startsWith(root + sep) || rel.split('/').some(x => x.startsWith('.'))) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
let browser, failure;
const completed = [], measurements = [], screenshots = [];
try {
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  async function setup(viewport, label) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const requests = [], errors = [], unexpected = [], failedRequests = [], pending = [];
    const mode = { avioadsb: 'ok', adsbfi: 'ok', fixedTimestamp: null };
    await context.addInitScript(() => {
      window.__nearbyTest = { cameraCalls: 0, locationCalls: 0,
        setHidden(hidden) { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); document.dispatchEvent(new Event('visibilitychange')); },
      };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(_ok, fail) {
        window.__nearbyTest.locationCalls++; fail({ code: 1 });
      } } });
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { async getUserMedia() {
        window.__nearbyTest.cameraCalls++; throw new DOMException('Test denial', 'NotAllowedError');
      } } });
      const clear = CanvasRenderingContext2D.prototype.clearRect, fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.id === 'sky') window.__nearbyTest.labels = [];
        return clear.apply(this, args);
      };
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        if (this.canvas.id === 'sky') (window.__nearbyTest.labels ||= []).push(String(args[0]));
        return fill.apply(this, args);
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.clock.install({ time: instant });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', reply => {
      if (new URL(reply.url()).origin === origin && reply.status() >= 400) errors.push('Local asset ' + reply.status() + ': ' + reply.url());
    });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      const satellite = url.origin === 'https://celestrak.org' && url.pathname === '/NORAD/elements/gp.php' &&
        ['stations', 'visual'].includes(url.searchParams.get('GROUP')) && url.searchParams.get('FORMAT')?.toLowerCase() === 'json';
      const provider = url.origin === 'https://avioadsb.org' && /^\/v1\/point\//.test(url.pathname) ? 'avioadsb' :
        url.origin === 'https://opendata.adsb.fi' && /^\/api\/v3\/lat\//.test(url.pathname) ? 'adsbfi' : null;
      if (!satellite && !provider) { unexpected.push(url.href); await route.abort('blockedbyclient'); return; }
      const entry = { provider: satellite ? 'celestrak' : provider, url: url.href };
      requests.push(entry);
      if (provider && mode[provider] === 'hold') await new Promise(resolve => pending.push(resolve));
      const status = provider && typeof mode[provider] === 'number' ? mode[provider] : 200;
      const now = mode.fixedTimestamp ?? await page.evaluate(() => Date.now()).catch(() => instant);
      await route.fulfill({ status, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Retry-After,X-RateLimit-Remaining',
        'retry-after': '120', 'x-ratelimit-remaining': status === 429 ? '0' : '99' }, contentType: 'application/json',
      body: JSON.stringify(satellite ? [orbit] : status === 200 ? response(now) : { error: 'Deliberate HTTP fixture ' + status }) }).catch(() => {});
    });
    await page.goto(origin + '/skylens/?manual=1&nointro=1', { waitUntil: 'networkidle' });
    await page.locator('#togglePlanes').waitFor();
    const check = async () => {
      assert.deepEqual(errors, [], label + ': no uncaught application errors');
      assert.deepEqual(unexpected, [], label + ': only explicitly mocked provider URLs requested');
      assert.equal(await page.evaluate(() => window.__nearbyTest.cameraCalls), 0, 'nearby tracking never implicitly opens camera');
    };
    const close = async () => { pending.splice(0).forEach(resolve => resolve()); await context.close(); };
    return { context, page, requests, failedRequests, mode, pending, check, close };
  }
  async function tab(page, name) {
    if (await page.locator('#dockContent').isHidden()) await page.locator('#dockHandle').click();
    await page.locator('[data-tab="' + name + '"]').click();
  }
  async function text(page, selector, pattern) {
    try {
      await page.waitForFunction(({ selector, source, flags }) => new RegExp(source, flags).test(document.querySelector(selector)?.textContent || ''),
        { selector, source: pattern.source, flags: pattern.flags });
    } catch (error) {
      throw new Error(`${selector}: expected ${pattern}; observed ${JSON.stringify(await page.locator(selector).textContent())}`, { cause: error });
    }
  }
  async function locate(page) {
    await tab(page, 'settings');
    await page.locator('#locLat').fill('0'); await page.locator('#locLon').fill('150'); await page.locator('#locHeight').fill('1000');
    await page.locator('#setLoc').click();
    await page.locator('#openNearby').click();
  }
  async function enablePlanes(page) {
    await page.locator('#togglePlanes').click();
    if (await page.locator('#planeConsent').isVisible()) await page.locator('#confirmPlanes').click();
  }
  async function layout(page, label) {
    const measured = await page.evaluate(() => {
      const controls = ['toggleSatellites', 'togglePlanes'].map(id => {
        const el = document.getElementById(id), r = el.getBoundingClientRect();
        const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { id, x: r.x, y: r.y, width: r.width, height: r.height, hit: target === el || el.contains(target),
          inViewport: r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 };
      });
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, controls };
    });
    measurements.push({ label, ...measured });
    assert.ok(measured.scrollWidth <= measured.width + 1, label + ': no document overflow ' + JSON.stringify(measured));
    for (const control of measured.controls) assert.ok(control.inViewport && control.hit && control.width >= 44 && control.height >= 44,
      label + ': nearby switch is directly visible and hittable ' + JSON.stringify(control));
  }
  async function shot(page, label, view) {
    const name = 'nearby-' + label + '-' + view + '.png';
    await page.screenshot({ path: resolve(results, name), fullPage: true }); screenshots.push(name);
  }
  const views = [ ['small-mobile', { width: 320, height: 568 }], ['mobile', { width: 390, height: 844 }],
    ['landscape', { width: 844, height: 390 }], ['desktop', { width: 1440, height: 1000 }] ];
  for (const [label, viewport] of views) {
    const env = await setup(viewport, label), { page, requests } = env;
    try {
      assert.equal(requests.length, 0, 'default page makes no optional provider requests');
      await locate(page);
      await page.locator('#aircraftRangeNm').selectOption('25');
      assert.equal(requests.length, 0, 'location, nearby navigation and range changes preserve privacy');
      await page.locator('#togglePlanes').click();
      await page.locator('#planeConsent').waitFor({ state: 'visible' });
      await text(page, '#planeConsent', /AvioADSB/);
      assert.equal(requests.length, 0, 'consent explanation appears before coordinate transmission');
      await page.locator('#cancelPlanes').click();
      assert.equal(requests.length, 0, 'cancelling consent sends nothing');
      await enablePlanes(page);
      await page.locator('#planeList [data-object-key="plane:abcdef"]').waitFor();
      assert.match(requests[0].url, /\/0\.000\/150\.000\/25$/);
      assert.equal(await page.locator('#planeList [data-object-key]').count(), 2, 'stale, grounded and out-of-range reports excluded');
      await text(page, '#planeMeta', /AvioADSB/);
      await text(page, '#planeMeta', /25/);
      await layout(page, label + ' nearby'); await shot(page, label, 'aircraft');
      await page.locator('#planeList [data-object-key="plane:abcdef"]').click();
      await text(page, '#infocard', /geometric|WGS84/i);
      await text(page, '#infocard', /line.of.sight|slant/i);
      await text(page, '#infocard', /ground/i);
      assert.equal(await page.locator('#infocard [data-action="save"]').count(), 0, 'ephemeral aircraft cannot become persistent favourites');
      await shot(page, label, 'aircraft-detail');
      await page.locator('#infocard').getByRole('button', { name: 'Guide to object', exact: true }).click();
      await page.waitForFunction(() => (window.__nearbyTest.labels || []).some(s => s.includes('NEAR123')));
      await shot(page, label, 'guided-aircraft');
      if (await page.locator('#infocard').isVisible()) await page.getByRole('button', { name: 'Close object details' }).click();
      await page.locator('#togglePlanes').click();
      await page.waitForFunction(() => document.querySelector('#togglePlanes').getAttribute('aria-pressed') === 'false');
      assert.equal(await page.locator('#planeList [data-object-key]').count(), 0, 'switching aircraft off removes rows');
      await text(page, '#adsbStatus', /^Aircraft: off$/);
      await page.waitForFunction(() => !(window.__nearbyTest.labels || []).some(s => s.includes('NEAR123')));
      await page.locator('#openNearby').click();
      await page.locator('#satelliteVisibility').selectOption('all');
      const before = requests.length;
      await page.locator('#toggleSatellites').click();
      await page.locator('#satList [data-object-key="sat:00005"]').waitFor();
      const satelliteRequests = requests.slice(before).filter(x => x.provider === 'celestrak');
      assert.deepEqual(satelliteRequests.map(x => new URL(x.url).searchParams.get('GROUP')), ['stations', 'visual']);
      assert.ok(satelliteRequests.every(x => new URL(x.url).searchParams.get('FORMAT')?.toLowerCase() === 'json'));
      await text(page, '#satList', /VANGUARD QA/);
      await layout(page, label + ' satellite'); await shot(page, label, 'satellite');
      await page.locator('#toggleSatellites').click();
      assert.equal(await page.locator('#satList [data-object-key]').count(), 0, 'switching satellites off removes rows');
      await env.check(); completed.push(label + ': successful aircraft consent/cancel, range, geometry labels, guidance/off cleanup, real SGP4 on mocked OMM, reachable switches');
    } catch (error) {
      await page.screenshot({ path: resolve(results, 'nearby-' + label + '-failure.png'), fullPage: true }).catch(() => {}); throw error;
    } finally { await env.close(); }
  }
  // Lifecycle, age and quota journeys follow successful rendering above. They
  // intentionally use a single mobile viewport rather than repeat policy tests.
  {
    const env = await setup({ width: 390, height: 844 }, 'policy'), { page, requests, mode, pending, failedRequests } = env;
    try {
      await page.locator('#togglePlanes').click();
      assert.equal(requests.length, 0, 'demo observer never sends aircraft coordinates');
      await text(page, '#planeConsentContext', /demonstration location/i);
      assert.equal(await page.locator('#confirmPlanes').isDisabled(), true, 'demo observer cannot confirm external transmission');
      await locate(page); await enablePlanes(page);
      await page.locator('#planeList [data-object-key="plane:abcdef"]').waitFor();
      await page.locator('#aircraftProvider').selectOption('adsbfi');
      assert.equal(await page.locator('#togglePlanes').getAttribute('aria-pressed'), 'false', 'provider change revokes enabled state');
      assert.equal(requests.filter(x => x.provider === 'adsbfi').length, 0, 'new provider receives nothing before new consent');
      mode.adsbfi = 403;
      await page.locator('#togglePlanes').click(); await page.locator('#planeConsent').waitFor({ state: 'visible' });
      await text(page, '#planeConsent', /adsb\.fi/i); await page.locator('#confirmPlanes').click();
      await text(page, '#planeMeta', /unavailable|403|stopped|blocked/i);
      await page.clock.fastForward(30000);
      assert.equal(requests.filter(x => x.provider === 'adsbfi').length, 1, '403 stops automatic provider polling');
      await page.locator('#aircraftProvider').selectOption('avioadsb');
      mode.avioadsb = 'hold';
      const before = requests.length; await enablePlanes(page);
      await page.waitForFunction(() => document.querySelector('#togglePlanes').getAttribute('aria-pressed') === 'true');
      for (let attempt = 0; attempt < 80 && requests.length === before; attempt++) await page.waitForTimeout(25);
      assert.ok(requests.length > before, 'held aircraft request actually began before cancellation');
      await page.locator('#togglePlanes').click();
      pending.splice(0).forEach(resolve => resolve());
      await page.waitForTimeout(100);
      assert.ok(failedRequests.some(x => /avioadsb/.test(x.url) && /ABORTED|ERR_FAILED/.test(x.error)), 'off aborts the in-flight aircraft request');
      assert.equal(await page.locator('#planeList [data-object-key]').count(), 0, 'late request completion cannot revive disabled aircraft');
      mode.avioadsb = 'ok'; await enablePlanes(page);
      await page.locator('#planeList [data-object-key="plane:abcdef"]').waitFor();
      await tab(page, 'tonight'); await page.locator('#skyTime').fill('2001-01-01T00:00'); await page.locator('#timeForm button[type=submit]').click();
      await text(page, '#planeMeta', /simulated|paused/i);
      const simulatedRequests = requests.length; await page.clock.fastForward(15000);
      assert.equal(requests.length, simulatedRequests, 'simulated time pauses real aircraft polling');
      await page.locator('#timeNow').click(); await page.locator('#openNearby').click();
      await page.locator('#planeList [data-object-key="plane:abcdef"]').waitFor();
      await page.evaluate(() => window.__nearbyTest.setHidden(true));
      const hiddenRequests = requests.length; await page.clock.fastForward(15000);
      assert.equal(requests.length, hiddenRequests, 'background stops aircraft network work');
      await page.evaluate(() => window.__nearbyTest.setHidden(false));
      await page.locator('#planeList [data-object-key="plane:abcdef"]').waitFor();
      mode.fixedTimestamp = await page.evaluate(() => Date.now());
      await page.locator('#planeList [data-object-key="plane:abcdef"]').click();
      await page.locator('#infocard').getByRole('button', { name: 'Guide to object', exact: true }).click();
      if (await page.locator('#infocard').isVisible()) await page.getByRole('button', { name: 'Close object details' }).click();
      await page.waitForFunction(() => (window.__nearbyTest.labels || []).some(s => s.includes('NEAR123')));
      await page.clock.fastForward(22000);
      await page.waitForFunction(() => !(window.__nearbyTest.labels || []).some(s => s.includes('NEAR123')));
      assert.equal(await page.locator('#planeList [data-object-key="plane:abcdef"]').count(), 1, '21–60 second report remains in list as stale, not in guidance');
      assert.equal(await page.evaluate(() => (window.__nearbyTest.labels || []).some(s => s.includes('NEAR123'))), false, 'stale aircraft no longer drawn as a fresh sky target');
      await text(page, '#planeList', /list only/i);
      await page.locator('#openNearby').click();
      await page.locator('#planeList [data-object-key="plane:abcdef"]').click();
      assert.equal(await page.locator('#infocard [data-action="guide"]').isDisabled(), true, 'an old report remains inspectable without enabling guidance');
      await text(page, '#infocard', /held at\s*15(?:\.0)?\s*s/i);
      await page.getByRole('button', { name: 'Close object details' }).click();
      await page.clock.fastForward(40000);
      assert.equal(await page.locator('#planeList [data-object-key]').count(), 0, 'reports expire after 60 seconds even between polls');
      await env.check(); completed.push('demo privacy, provider re-consent and 403, request cancellation, simulation/background pause, 20-second overlay and 60-second report expiry');
    } catch (error) { await page.screenshot({ path: resolve(results, 'nearby-policy-failure.png'), fullPage: true }).catch(() => {}); throw error; }
    finally { await env.close(); }
  }
  {
    const env = await setup({ width: 390, height: 844 }, 'quota'), { page, requests, mode } = env;
    try {
      await locate(page); mode.avioadsb = 429; await enablePlanes(page);
      await text(page, '#planeMeta', /limit|quota/i);
      const count = requests.length;
      await page.locator('#togglePlanes').click(); await enablePlanes(page);
      await page.clock.fastForward(30000);
      assert.equal(requests.length, count, '429 cooldown cannot be bypassed by toggling or automatic polling');
      await shot(page, 'mobile', 'quota'); await env.check();
      completed.push('429 retry window, off/on cooldown enforcement, visible quota state');
    } finally { await env.close(); }
  }
} catch (error) { failure = error; console.error(error.stack || error); }
finally {
  await writeFile(resolve(results, 'nearby-browser-results.json'), JSON.stringify({
    ok: !failure, completed, measurements, screenshots, error: failure?.message || null,
    fixtureTime: new Date(instant).toISOString(), evidence: 'Chromium with mocked optional HTTP feeds. Real SGP4; no live API delivery or physical phone alignment claimed.',
  }, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
if (failure) process.exitCode = 1;
else console.log('Nearby browser gate passed: ' + completed.length + ' journeys; ' + screenshots.length + ' screenshots.');
