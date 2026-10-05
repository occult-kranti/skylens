// Globe release gate: all optional HTTP sources are deterministic local fixtures.
// node tests/browser-globe.mjs (same Playwright/Chromium as the existing gates).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), results = resolve(root, 'test-results');
await mkdir(results, { recursive: true });
const { chromium } = process.env.PLAYWRIGHT_PKG
  ? await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_PKG)).href)
  : await import('playwright').catch(() => import('/opt/codex/cua_node/lib/node_modules/playwright/index.mjs'));
const instant = Date.parse('2000-06-27T18:50:19.733Z');
const receiverURL = 'https://receiver.example.org/aircraft.json';
const coverageLabel = 'Owner declared coverage — ' + 'unbrokenReceiverDescription'.repeat(2) + ' (unverified)';
const observerPreferences = { loc: { lat: 40.7128, lon: -74.006, heightM: 30, source: 'manual', name: 'Saved observer fixture' }, nameMode: 'en' };
const omm = { OBJECT_NAME: 'VANGUARD QA', OBJECT_ID: '1958-002B', NORAD_CAT_ID: 5, CLASSIFICATION_TYPE: 'U',
  EPOCH: '2000-06-27T18:50:19.733568', MEAN_MOTION: 10.82419157, ECCENTRICITY: .1859667, INCLINATION: 34.2682,
  RA_OF_ASC_NODE: 348.7242, ARG_OF_PERICENTER: 331.7664, MEAN_ANOMALY: 19.3264, EPHEMERIS_TYPE: 0,
  ELEMENT_SET_NO: 475, REV_AT_EPOCH: 41366, BSTAR: .000028098, MEAN_MOTION_DOT: .00000023, MEAN_MOTION_DDOT: 0 };
function reports(now, centre = null, altitudeCases = false) {
  return [
    { hex: 'abcdef', flight: 'CENTER001', lat: centre?.lat ?? 15, lon: centre?.lon ?? (now - instant) / 1000 * .002,
      alt_geom: 10000, alt_baro: 9000, seen_pos: 0, gs: 300, track: 90, geom_rate: 0 },
    { hex: 'bcdef1', flight: 'EAST002', lat: 20, lon: 35, alt_geom: 12000, seen_pos: 0 },
    { hex: 'cdef12', flight: 'BACK180', lat: -15, lon: 180, alt_geom: 11000, seen_pos: 0 },
    { hex: 'def123', flight: 'EXPIRED99', lat: 15, lon: 0, alt_geom: 10000, seen_pos: 61 },
    ...(altitudeCases ? [
      { hex: 'aabb01', flight: 'UNKNOWNALT', lat: 10, lon: 5, seen_pos: 0 },
      { hex: 'aabb02', flight: 'GROUNDED', lat: 12, lon: 7, alt_baro: 'ground', seen_pos: 0 },
    ] : []),
  ];
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/skylens/')) { response.writeHead(404).end(); return; }
    let relative = decodeURIComponent(pathname.slice('/skylens/'.length));
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep) || relative.split('/').some(x => x.startsWith('.'))) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(body);
  } catch { response.writeHead(404).end(); }
});
let browser, failure;
const completed = [], layouts = [], navigation = [], screenshots = [], networkEvidence = [];
try {
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  async function setup(viewport, label, { denyLocation = false } = {}) {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const requests = [], errors = [], unexpected = [], pending = [], failedRequests = [];
    const mode = { receiver: 'ok', avioadsb: 'ok', adsbfi: 'ok', receiverSchema: 'readsb-aircraft-json', fixedTimestamp: null, altitudeCases: false };
    await context.addInitScript(({ observerPreferences, denyLocation }) => {
      if (!localStorage.getItem('skylens.preferences.v2')) localStorage.setItem('skylens.preferences.v2', JSON.stringify(observerPreferences));
      window.__globeTest = { geoCalls: 0, cameraCalls: 0, draws: 0, labels: [], workerResults: [], workerTerminated: 0,
        setHidden(hidden) { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); document.dispatchEvent(new Event('visibilitychange')); } };
      // Observe real browser worker messages; no fake parser or production hook.
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          super(url, options);
          this.addEventListener('message', event => {
            if (String(url).endsWith('/traffic-worker.js') && event.data?.ok === true)
              window.__globeTest.workerResults.push({ url: String(url), reports: event.data.result.reports.length });
          });
        }
        terminate() { window.__globeTest.workerTerminated++; return super.terminate(); }
      };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(ok, fail) {
        window.__globeTest.geoCalls++;
        queueMicrotask(() => denyLocation ? fail({ code: 1 }) : ok({ coords: { latitude: 12.34, longitude: 56.78, accuracy: 8, altitude: 50, altitudeAccuracy: 15 } }));
      } } });
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { async getUserMedia() {
        window.__globeTest.cameraCalls++; throw new DOMException('No implicit camera allowed', 'NotAllowedError');
      } } });
      const clear = CanvasRenderingContext2D.prototype.clearRect, fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.id === 'globeCanvas') { window.__globeTest.draws++; window.__globeTest.labels = []; }
        return clear.apply(this, args);
      };
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        if (this.canvas.id === 'globeCanvas') window.__globeTest.labels.push(String(args[0]));
        return fillText.apply(this, args);
      };
    }, { observerPreferences, denyLocation });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    await page.clock.install({ time: instant });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (new URL(response.url()).origin === origin && response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      let kind = url.href === receiverURL ? 'receiver' :
        url.origin === 'https://avioadsb.org' && url.pathname.startsWith('/v1/point/') ? 'avioadsb' :
        url.origin === 'https://opendata.adsb.fi' && url.pathname.startsWith('/api/v3/lat/') ? 'adsbfi' :
        url.origin === 'https://celestrak.org' && url.pathname === '/NORAD/elements/gp.php' &&
          ['stations', 'visual'].includes(url.searchParams.get('GROUP')) && url.searchParams.get('FORMAT')?.toLowerCase() === 'json' ? 'celestrak' : null;
      if (!kind) { unexpected.push(url.href); await route.abort('blockedbyclient'); return; }
      const entry = { label, kind, url: url.href, method: route.request().method() }; requests.push(entry); networkEvidence.push(entry);
      if (mode[kind] === 'hold') await new Promise(resolve => pending.push(resolve));
      if (mode[kind] === 'cors-error') return route.abort('failed').catch(() => {});
      const status = typeof mode[kind] === 'number' ? mode[kind] : 200;
      const now = mode.fixedTimestamp ?? await page.evaluate(() => Date.now()).catch(() => instant);
      let centre = null;
      if (kind === 'avioadsb') { const parts = url.pathname.split('/'); centre = { lat: Number(parts[3]), lon: Number(parts[4]) }; }
      if (kind === 'adsbfi') { const parts = url.pathname.split('/'); centre = { lat: Number(parts[4]), lon: Number(parts[6]) }; }
      const rows = mode[kind] === 'empty' ? [] : reports(now, centre, kind === 'receiver' && mode.altitudeCases);
      const payload = kind === 'celestrak' ? [omm] : mode[kind] === 'malformed' ? { now, invalid: true } :
        kind === 'receiver' && mode.receiverSchema === 'readsb-aircraft-json' ? { now: now / 1000, aircraft: rows } : { now, ac: rows };
      await route.fulfill({ status, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Retry-After,X-RateLimit-Remaining',
        'retry-after': '120', 'x-ratelimit-remaining': status === 429 ? '0' : '99' }, contentType: 'application/json',
        body: JSON.stringify(status === 200 ? payload : { error: 'Deliberate HTTP fixture ' + status }) }).catch(() => {});
    });
    await page.goto(origin + '/skylens/globe.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__globeTest.draws > 0);
    const check = async () => {
      assert.deepEqual(errors, [], label + ': application and Pages-base assets have no errors');
      assert.deepEqual(unexpected, [], label + ': no unapproved network destination');
      assert.equal(await page.evaluate(() => window.__globeTest.cameraCalls), 0, 'globe does not open camera');
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('skylens.preferences.v2')).loc), observerPreferences.loc,
        'map navigation and source queries do not overwrite the saved sky observer');
    };
    return { context, page, requests, failedRequests, mode, pending, check,
      close: async () => { pending.splice(0).forEach(resolve => resolve()); await context.close(); } };
  }
  async function match(page, selector, pattern) {
    try { await page.waitForFunction(({ selector, source, flags }) => new RegExp(source, flags).test(document.querySelector(selector)?.textContent || ''),
      { selector, source: pattern.source, flags: pattern.flags }); }
    catch (error) { throw new Error(`${selector}: expected ${pattern}; observed ${JSON.stringify(await page.locator(selector).textContent())}`, { cause: error }); }
  }
  const centre = page => page.locator('#globeViewCoordinates').textContent();
  const zoom = async page => Number.parseFloat(await page.locator('#globeZoomValue').textContent());
  const settleView = page => page.clock.runFor(40);
  const ready = page => page.locator('#globeCoverage[data-state="ok"]').waitFor({ state: 'visible' });
  async function closePanel(page) { if (await page.locator('#globePanelBody').isVisible()) await page.locator('#globePanelClose').click(); }
  async function data(page) { await page.locator('#globeCoverage').click(); await page.locator('#globeDataPanel').waitFor({ state: 'visible' }); }
  async function objects(page) {
    if (await page.locator('#globePanelBody').isHidden()) await page.locator('#globePanelToggle').click();
    await page.locator('#globeObjectsTab').click();
  }
  async function connect(page, schema = 'readsb-aircraft-json') {
    await data(page);
    if (!await page.locator('#globeReceiverSettings').evaluate(el => el.open)) await page.locator('#globeReceiverSettings > summary').click();
    await page.locator('#globeReceiverURL').fill(receiverURL); await page.locator('#globeReceiverSchema').selectOption(schema);
    await page.locator('#globeReceiverCoverage').fill(coverageLabel);
    await page.locator('#globeConnectReceiver').click();
  }
  async function shot(page, label, name) {
    // State text can update before the scheduled Canvas frame. Advance two
    // fixture frames so screenshots record the matching centre and markers.
    await settleView(page);
    const file = `globe-${label}-${name}.png`; await page.screenshot({ path: resolve(results, file), fullPage: true }); screenshots.push(file);
  }
  async function layout(page, label, selected = false) {
    const result = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      selectedCentreVisible: (() => {
        const canvas = document.getElementById('globeCanvas'), r = canvas.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === canvas;
      })(),
      controls: ['globePlanes', 'globeSatellites', 'globeZoomIn', 'globeZoomOut', 'globeReset', 'globeLocation'].map(id => {
        const el = document.getElementById(id), r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { id, width: r.width, height: r.height, visible: r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
          hit: hit === el || el.contains(hit) };
      }) }));
    layouts.push({ label, ...result });
    assert.ok(result.scrollWidth <= result.width + 1, label + ': document does not overflow');
    for (const control of result.controls) assert.ok(control.width >= 44 && control.height >= 44 && control.visible && control.hit,
      label + ': primary control usable ' + JSON.stringify(control));
    if (selected) assert.ok(result.selectedCentreVisible, label + ': centred selected marker remains visible and pickable outside the details panel');
  }
  async function drag(page) {
    const box = await page.locator('#globeCanvas').boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .65, box.y + box.height * .43, { steps: 8 }); await page.mouse.up();
    await settleView(page);
  }
  async function pickList(page, id) { await objects(page); await page.locator('#globeSearch').fill(''); await page.locator(`#globeList [data-object-id="${id}"]`).click(); }
  async function filterChecks(env, counts) {
    const { page, requests } = env;
    await objects(page);
    // Freeze only the polling clock during this synchronous list-only action:
    // an unrelated scheduled provider refresh must not look like filter I/O.
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
    const requestCount = requests.length, view = await centre(page);
    const layers = await Promise.all(['#globePlanes', '#globeSatellites'].map(selector => page.locator(selector).getAttribute('aria-pressed')));
    for (const [id, expected] of [['globeFilterPlanes', counts.plane], ['globeFilterSatellites', counts.satellite], ['globeFilterAll', counts.plane + counts.satellite]]) {
      await page.locator('#' + id).click();
      assert.equal(await page.locator('#' + id).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#globeList [data-object-id]').count(), expected, 'category filters only the loaded list');
    }
    await page.locator('#globeSearch').fill('no matching object');
    await page.locator('#globeFilterPlanes').click(); await page.locator('#globeResetSearch').click();
    assert.equal(await page.locator('#globeSearch').inputValue(), '');
    assert.equal(await page.locator('#globeFilterAll').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#globeSearch').evaluate(el => document.activeElement === el), true, 'reset returns keyboard focus to search');
    assert.equal(await page.locator('#globeList [data-object-id]').count(), counts.plane + counts.satellite);
    assert.equal(await centre(page), view, 'list filters do not rotate the globe');
    assert.deepEqual(await Promise.all(['#globePlanes', '#globeSatellites'].map(selector => page.locator(selector).getAttribute('aria-pressed'))), layers,
      'list filters do not enable or disable layers');
    assert.equal(requests.length, requestCount, 'list filtering and reset never contact a source');
    await page.clock.resume();
  }
  for (const [label, viewport] of [['small-mobile', { width: 320, height: 568 }], ['mobile', { width: 390, height: 844 }],
    ['landscape', { width: 844, height: 390 }], ['desktop', { width: 1440, height: 1000 }]]) {
    const env = await setup(viewport, label), { page, requests } = env;
    try {
      assert.equal(requests.length, 0); assert.equal(await page.evaluate(() => window.__globeTest.geoCalls), 0, 'startup requests no location');
      await closePanel(page); await layout(page, label + ' world'); await shot(page, label, 'world');
      await page.locator('#globeReset').click(); await settleView(page); const initial = await centre(page);
      await page.locator('#globeCanvas').focus(); await page.keyboard.press('ArrowRight');
      await settleView(page);
      assert.notEqual(await centre(page), initial, 'keyboard rotates map');
      await page.keyboard.press('+'); await settleView(page); assert.ok(await zoom(page) > 1, 'keyboard plus zooms');
      await page.locator('#globeZoomIn').click(); await settleView(page); const high = await zoom(page);
      await page.locator('#globeZoomOut').click(); await settleView(page); assert.ok(await zoom(page) < high, 'zoom buttons change scale');
      await page.locator('#globeReset').click(); await settleView(page); assert.equal(await zoom(page), 1, 'World restores whole-globe scale');
      const beforeDrag = await centre(page); await drag(page); assert.notEqual(await centre(page), beforeDrag, 'pointer drag rotates globe');
      const box = await page.locator('#globeCanvas').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -240);
      await settleView(page);
      await page.waitForFunction(() => Number.parseFloat(document.querySelector('#globeZoomValue').textContent) > 1);
      assert.equal(requests.length, 0, 'navigation never queries a source');
      await page.locator('#globeLocation').click(); await match(page, '#globeViewCoordinates', /12\.34/);
      assert.equal(await page.evaluate(() => window.__globeTest.geoCalls), 1, 'only explicit Locate asks geolocation');
      assert.equal(requests.length, 0, 'GPS centres locally without aircraft disclosure');
      await page.locator('#globeReset').click(); await settleView(page);
      await page.locator('#globePlanes').click(); await page.locator('#globeDataPanel').waitFor({ state: 'visible' });
      assert.equal(requests.length, 0, 'first Aircraft switch opens source controls without fetching');
      await page.locator('#globeUseCenter').click();
      assert.equal(Number(await page.locator('#globeAreaLat').inputValue()), 15);
      assert.equal(Number(await page.locator('#globeAreaLon').inputValue()), 0);
      await page.locator('#globeRange').selectOption('25'); assert.equal(requests.length, 0, 'area preview is not consent');
      await page.locator('#globeLoadArea').click(); await match(page, '#globeFeedDetails', /AvioADSB/i);
      await objects(page); await page.locator('#globeList [data-object-id="plane:abcdef"]').waitFor();
      assert.match(requests[0].url, /\/15\.000\/0\.000\/25$/);
      assert.equal(await page.locator('#globeList [data-object-id]').count(), 1, 'regional source excludes distant reports');
      await shot(page, label, 'regional');
      await data(page); await page.locator('#globeStopAircraft').click();
      await connect(page); await objects(page);
      await page.waitForFunction(() => document.querySelectorAll('#globeList [data-object-id]').length === 3);
      await filterChecks(env, { plane: 3, satellite: 0 });
      await data(page); await match(page, '#globeFeedDetails', /Owner declared coverage/);
      assert.ok((await page.locator('#globeFeedStatus').textContent()).length < 100, 'compact status does not reproduce arbitrary source coverage prose');
      await match(page, '#globeFeedMeta', /3/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'long source coverage wraps without document overflow');
      await objects(page);
      const workerEvidence = await page.evaluate(() => ({ results: window.__globeTest.workerResults, terminated: window.__globeTest.workerTerminated }));
      assert.ok(workerEvidence.results.some(result => result.reports === 3 && result.url.includes('/skylens/js/traffic-worker.js')),
        'receiver snapshot is normalized by the real project-relative module worker');
      assert.ok(workerEvidence.terminated > 0, 'one-shot worker is released after producing its result');
      assert.equal(requests.filter(r => r.kind === 'receiver').at(-1).url, receiverURL, 'receiver URL receives no coordinates or credentials');
      await page.locator('#globeSearch').fill('BACK180');
      assert.equal(await page.locator('#globeList [data-object-id]').count(), 1, 'far-side global record remains searchable');
      await page.locator('#globeSearch').fill('no such object'); assert.equal(await page.locator('#globeList [data-object-id]').count(), 0);
      await page.locator('#globeSearch').fill(''); await closePanel(page); await page.locator('#globeReset').click(); await settleView(page);
      await layout(page, label + ' global receiver'); await shot(page, label, 'global-receiver');
      // A back-side ground marker projects near the same pixel as the front-side
      // fixture. Actual canvas picking must choose only the visible hemisphere.
      const canvasBox = await page.locator('#globeCanvas').boundingBox();
      await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
      await match(page, '#globeObjectName', /CENTER001/);
      await match(page, '#globeObjectFacts', /receiver|source/i);
      await settleView(page);
      await layout(page, label + ' selected details', true);
      await shot(page, label, 'selected');
      await page.locator('#globeFollow').click(); assert.equal(await page.locator('#globeFollow').getAttribute('aria-pressed'), 'true');
      await closePanel(page); await page.locator('#globeStopFollow').waitFor({ state: 'visible' });
      const beforeFollow = await centre(page); await page.clock.fastForward(16000);
      await page.waitForFunction(old => document.querySelector('#globeViewCoordinates').textContent !== old, beforeFollow);
      await drag(page); await page.locator('#globeStopFollow').waitFor({ state: 'hidden' });
      await page.locator('#globePlanes').click();
      assert.equal(await page.locator('#globePlanes').getAttribute('aria-pressed'), 'false');
      await objects(page); assert.equal(await page.locator('#globeList [data-object-id]').count(), 0, 'turning off aircraft clears loaded objects and selection');
      await closePanel(page);
      await page.locator('#globeSatellites').click(); await objects(page);
      await page.locator('#globeList [data-object-id="sat:00005"]').waitFor();
      await filterChecks(env, { plane: 0, satellite: 1 });
      assert.deepEqual(requests.filter(r => r.kind === 'celestrak').map(r => new URL(r.url).searchParams.get('GROUP')), ['stations', 'visual']);
      await page.locator('#globeList [data-object-id="sat:00005"]').click(); await match(page, '#globeObjectFacts', /epoch|SGP4/i);
      await shot(page, label, 'satellite');
      await page.locator('#globeSatellites').click(); await objects(page);
      assert.equal(await page.locator('#globeList [data-object-id]').count(), 0, 'satellite off clears loaded selection');
      await env.check(); completed.push(label + ': keyboard/mouse/wheel/zoom/GPS, explicit regional/global data, hemisphere picking, search/follow/manual cancellation/layer off, real SGP4 fixture');
    } catch (error) { await page.screenshot({ path: resolve(results, `globe-${label}-failure.png`), fullPage: true }).catch(() => {}); throw error; }
    finally { await env.close(); }
  }
  {
    const env = await setup({ width: 390, height: 844 }, 'lifecycle', { denyLocation: true }), { page, mode, requests, pending, failedRequests } = env;
    try {
      await closePanel(page); await page.locator('#globeLocation').click(); await match(page, '#globeStatus', /unavailable/i);
      assert.equal(requests.length, 0, 'denied location never becomes a default network query');
      await page.locator('#globeReset').click(); await settleView(page);
      const cdp = await env.context.newCDPSession(page), b = await page.locator('#globeCanvas').boundingBox();
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 25, y, id: 1 }, { x: x + 25, y, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 55, y, id: 1 }, { x: x + 55, y, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await settleView(page);
      assert.ok(await zoom(page) > 1, 'synthetic two-finger pinch zooms the map');
      assert.equal(await page.evaluate(() => visualViewport.scale), 1, 'canvas pinch does not zoom the document'); await cdp.detach();
      await page.locator('#globeCanvas').focus();
      for (let i = 0; i < 35; i++) await page.keyboard.press('+');
      await settleView(page);
      assert.equal(await zoom(page), 32, 'zoom has a finite upper bound');
      for (let i = 0; i < 45; i++) await page.keyboard.press('-');
      await settleView(page);
      assert.equal(await zoom(page), 1, 'zoom has a finite lower bound');
      await data(page); await page.locator('#globeReceiverSettings > summary').click();
      for (const invalid of ['http://receiver.example.org/aircraft.json', 'https://user:password@receiver.example.org/aircraft.json', receiverURL + '?token=fixture', receiverURL + '#fragment']) {
        await page.locator('#globeReceiverURL').fill(invalid); await page.locator('#globeConnectReceiver').click();
        assert.equal(requests.length, 0, 'invalid/insecure/credential-bearing URL is rejected before fetch');
      }
      mode.receiverSchema = 'readsb-v2'; mode.receiver = 'empty'; await connect(page, 'readsb-v2'); await ready(page);
      await match(page, '#globeFeedDetails', /coverage|receiver|source/i); await objects(page);
      assert.equal(await page.locator('#globeList [data-object-id]').count(), 0); await match(page, '#globeObjectsSummary', /0|no.*report|no.*object|empty/i);
      await shot(page, 'mobile', 'empty-source');
      await data(page); await page.locator('#globeStopAircraft').click(); mode.receiver = 'ok'; mode.altitudeCases = true; await connect(page, 'readsb-v2');
      await page.clock.fastForward(16000); await ready(page);
      await objects(page); await page.locator('#globeList [data-object-id="plane:abcdef"]').waitFor();
      for (const [id, name, altitude] of [['aabb01', 'UNKNOWNALT', /Not reported · no sky elevation estimate/i], ['aabb02', 'GROUNDED', /Reported on ground/i]]) {
        await pickList(page, 'plane:' + id); await match(page, '#globeObjectFacts', altitude);
        assert.equal(await page.locator('#globeFollow').isDisabled(), false, 'fresh geographic report can be followed without airborne altitude');
        await page.locator('#globeFollow').click(); assert.equal(await page.locator('#globeFollow').getAttribute('aria-pressed'), 'true');
        await closePanel(page); await page.locator('#globeStopFollow').click();
        // Selecting a row centres its real geographic marker. Canvas picking
        // proves it is actually drawn, rather than merely enabled in the list.
        const canvas = await page.locator('#globeCanvas').boundingBox();
        await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await match(page, '#globeObjectName', new RegExp(name));
      }
      await objects(page);
      await page.evaluate(() => window.__globeTest.setHidden(true));
      const networkBefore = requests.length, drawsBefore = await page.evaluate(() => window.__globeTest.draws);
      await page.clock.fastForward(30000);
      assert.equal(requests.length, networkBefore, 'background suspends custom feed polling');
      assert.equal(await page.evaluate(() => window.__globeTest.draws), drawsBefore, 'hidden globe does no canvas work');
      await page.evaluate(() => window.__globeTest.setHidden(false));
      await ready(page);
      await page.locator('#globeList [data-object-id="plane:abcdef"]').waitFor();
      mode.fixedTimestamp = await page.evaluate(() => Date.now());
      await pickList(page, 'plane:abcdef'); await page.locator('#globeFollow').click(); await closePanel(page);
      await page.clock.fastForward(22000); await page.locator('#globeStopFollow').waitFor({ state: 'hidden' });
      await pickList(page, 'plane:abcdef'); assert.equal(await page.locator('#globeFollow').isDisabled(), true, 'old report cannot be followed');
      await page.clock.fastForward(40000); await objects(page);
      assert.equal(await page.locator('#globeList [data-object-id]').count(), 0, 'receiver reports expire after60s');
      mode.fixedTimestamp = null; mode.receiver = 'hold'; await connect(page, 'readsb-v2'); await page.clock.fastForward(16000);
      for (let i = 0; i < 100 && !pending.length; i++) await page.waitForTimeout(25);
      assert.ok(pending.length, 'request reached fixture before cancellation');
      await page.locator('#globeStopAircraft').click(); pending.splice(0).forEach(resolve => resolve()); await page.waitForTimeout(100);
      assert.ok(failedRequests.some(r => r.url === receiverURL && /ABORTED|ERR_FAILED/.test(r.error)), 'Stop aborts pending custom request');
      await objects(page); assert.equal(await page.locator('#globeList [data-object-id]').count(), 0, 'late response cannot restore stopped data');
      mode.receiver = 'cors-error'; await connect(page, 'readsb-v2'); await page.clock.fastForward(16000); await match(page, '#globeFeedStatus', /unavailable|error|failed/i);
      await shot(page, 'mobile', 'source-error');
      assert.equal(await page.evaluate(() => Object.values(localStorage).some(v => v.includes('receiver.example.org'))), false, 'custom endpoint is not persisted');
      await page.setViewportSize({ width: 320, height: 568 });
      const beforeNavigation = requests.length;
      await page.locator('#globeViewSky').click(); await page.waitForURL('**/skylens/index.html');
      await page.waitForLoadState('networkidle');
      if (await page.locator('#onboard').isVisible()) await page.locator('#btnManual').click();
      for (const viewport of [{ width: 320, height: 568 }, { width: 560, height: 320 }]) {
        await page.setViewportSize(viewport);
        const measurement = await page.locator('#skyGlobeLink').evaluate(el => {
          const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
            controlWidth: r.width, controlHeight: r.height, visible: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
            hit: hit === el || el.contains(hit) };
        });
        navigation.push(measurement);
        assert.ok(measurement.controlWidth >= 44 && measurement.controlHeight >= 44 && measurement.visible && measurement.hit,
          'shared Sky to Globe navigation remains a usable touch target ' + JSON.stringify(measurement));
        assert.ok(measurement.scrollWidth <= measurement.width + 1, 'Sky navigation does not overflow');
      }
      assert.equal(await page.locator('#togglePlanes').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#toggleSatellites').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.evaluate(() => window.__globeTest.geoCalls), 0, 'Sky navigation does not implicitly request location');
      await env.check();
      await page.locator('#skyGlobeLink').click(); await page.waitForURL('**/skylens/globe.html'); await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('#globeViewGlobe').getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('#globePlanes').getAttribute('aria-pressed'), 'false');
      await page.locator('#globePlanes').click(); await page.locator('#globeDataPanel').waitFor();
      assert.equal(requests.length, beforeNavigation, 'roundtrip clears per-visit source consent and never replays the former receiver');
      assert.equal(await page.evaluate(() => window.__globeTest.geoCalls), 0, 'return navigation does not request device location');
      await env.check(); completed.push('pinch and zoom bounds, location denial, receiver URL/schema/empty/CORS failure, hidden pause, stale follow/expiry, request abort and private endpoint handling');
    } catch (error) { await page.screenshot({ path: resolve(results, 'globe-lifecycle-failure.png'), fullPage: true }).catch(() => {}); throw error; }
    finally { await env.close(); }
  }
  {
    const env = await setup({ width: 390, height: 844 }, 'reservation'), { page, requests, mode } = env;
    try {
      await data(page); await page.locator('#globeAreaLat').fill('15'); await page.locator('#globeAreaLon').fill('0');
      await page.locator('#globeLoadArea').click(); await objects(page); await page.locator('#globeList [data-object-id="plane:abcdef"]').waitFor();
      await data(page); await page.locator('#globeAreaLat').fill('20'); await page.locator('#globeAreaLon').fill('10'); await page.locator('#globeLoadArea').click();
      assert.equal(requests.length, 1, 'rapid area changes do not bypass provider request reservation');
      await page.clock.fastForward(13000); await ready(page); await objects(page); await page.locator('#globeList [data-object-id="plane:abcdef"]').waitFor();
      assert.match(requests.at(-1).url, /\/20\.000\/10\.000\/50$/);
      await closePanel(page); await page.locator('#globePlanes').click();
      const beforeRestart = requests.length;
      await page.locator('#globeReset').click(); await drag(page);
      await page.locator('#globePlanes').click();
      assert.equal(requests.length, beforeRestart, 'simple re-enable retains shared provider reservation');
      await page.clock.fastForward(13000); await ready(page);
      assert.equal(requests.length, beforeRestart + 1, 'previously consented source can restart with the layer switch');
      assert.match(requests.at(-1).url, /\/20\.000\/10\.000\/50$/, 're-enable uses the consented area, never the newly panned centre');
      await data(page); await page.locator('#globeStopAircraft').click(); mode.avioadsb = 429;
      await page.clock.fastForward(13000); await page.locator('#globeLoadArea').click(); await match(page, '#globeFeedStatus', /limit|quota/i);
      const count = requests.length; await page.locator('#globeLoadArea').click(); await page.clock.fastForward(30000);
      assert.equal(requests.length, count, 'quota cooldown survives repeated explicit Load this area');
      await page.locator('#globeProvider').selectOption('adsbfi'); assert.equal(requests.length, count, 'provider selection alone sends nothing');
      mode.adsbfi = 403; await page.locator('#globeLoadArea').click(); await match(page, '#globeFeedStatus', /unavailable|error|403|blocked/i);
      const denied = requests.length; await page.clock.fastForward(15000); assert.equal(requests.length, denied, '403 does not initiate repeated polling or fallback');
      await env.check(); completed.push('regional area reservation,429 cooldown, provider preview consent,403 stop/no fallback');
    } finally { await env.close(); }
  }
} catch (error) { failure = error; console.error(error.stack || error); }
finally {
  await writeFile(resolve(results, 'globe-browser-results.json'), JSON.stringify({ ok: !failure, completed, layouts, navigation, screenshots,
    requests: networkEvidence, error: failure?.message || null, fixtureTime: new Date(instant).toISOString(),
    evidence: 'Chromium with mocked HTTP, device location and synthetic touch. Real local map assets/SGP4. No provider availability, global coverage or physical phone proof.' }, null, 2));
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
if (failure) process.exitCode = 1;
else console.log(`Globe browser gate passed: ${completed.length} journeys; ${screenshots.length} screenshots.`);
