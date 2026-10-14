// Explorer release gate: mocked provider responses, real local assets and Chromium.
// PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium node tests/browser-explorer.mjs
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
function reports(now) {
  return [
    { hex: 'abcdef', flight: 'CENTER001', lat: 15, lon: (now - instant) / 1000 * .002,
      alt_geom: 10000, alt_baro: 9000, seen_pos: 0, gs: 300, track: 90, geom_rate: 0 },
    { hex: 'bcdef1', flight: 'EAST002', lat: 20, lon: 35, alt_geom: 12000, seen_pos: 0 },
    { hex: 'cdef12', flight: 'BACK180', lat: -15, lon: 180, alt_geom: 11000, seen_pos: 0 },
    { hex: 'def123', flight: 'EXPIRED99', lat: 15, lon: 0, alt_geom: 10000, seen_pos: 61 },
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
const completed = [], screenshots = [];
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  for (const [label, viewport] of [['small-mobile', { width: 320, height: 568 }], ['mobile', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }], ['desktop', { width: 1440, height: 1000 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const requests = [], errors = [];
    await context.addInitScript(() => {
      window.__labels = [];
      const text = CanvasRenderingContext2D.prototype.fillText, clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.fillText = function(...args) { if (this.canvas.id === 'globeCanvas') window.__labels.push(String(args[0])); return text.apply(this,args); };
      CanvasRenderingContext2D.prototype.clearRect = function(...args) { if (this.canvas.id === 'globeCanvas') window.__labels = []; return clear.apply(this,args); };
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() { throw new Error('No implicit location allowed'); } } });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Clipboard denied fixture'); } } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: instant });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      requests.push(url.href);
      if (url.origin === 'https://avioadsb.org') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ now: await page.evaluate(() => Date.now()), ac: reports(await page.evaluate(() => Date.now())).map((row,i)=>({...row,lat:15+i*.05,lon:i*.05})) }) });
      errors.push('Unexpected external destination ' + url.href); await route.abort();
    });
    const centre = () => page.locator('#globeViewCoordinates').textContent();
    const settle = () => page.clock.runFor(50);
    const close = async () => { if (await page.locator('#globePanelBody').isVisible()) await page.locator('#globePanelClose').click(); };
    const objects = async () => { if (await page.locator('#globePanelBody').isHidden()) await page.locator('#globePanelToggle').click(); await page.locator('#globeObjectsTab').click(); };
    const go = async value => { await objects(); await page.locator('#globePlaceSearch').fill(value); await page.locator('#globePlaceSearch').press('Enter'); await settle(); };
    try {
      await page.goto(origin + '/skylens/globe.html?token=DO_NOT_SHARE#old=PRIVATE', { waitUntil: 'networkidle' });
      await close();
      for (const panel of ['world','objects']) {
        if (panel==='objects') await objects();
        await settle(); const file=`explorer-${label}-initial-${panel}.png`;await page.screenshot({path:resolve(results,file),fullPage:true});screenshots.push(file);
      }
      await go('London'); assert.match(await centre(), /51\.5/);
      const london = await centre();
      await go('91, 0'); assert.equal(await centre(), london, 'invalid coordinates cannot move camera');
      assert.equal(await page.locator('#globePlaceSearch').evaluate(el => el.validity.valid), false);
      await go('15, 0'); assert.match(await centre(), /15\.00/);
      assert.equal(await page.locator('#globePlaceSearch').evaluate(el => el.validity.valid), true, 'typing after invalid clears validity');
      assert.equal(requests.length, 0, 'place navigation never contacts a provider');
      await page.locator('#globeCoverage').click(); await page.locator('#globeVisualStyle').click(); await settle();
      assert.equal(await page.locator('#globeVisualStyle').getAttribute('aria-pressed'), 'true');
      await page.locator('#globeShareView').click();
      const shared = new URL(await page.locator('#globeShareURL').inputValue());
      assert.equal(shared.search, '', 'share strips all incoming query values');
      assert.ok(!shared.href.includes('PRIVATE') && !shared.href.includes('DO_NOT_SHARE'));
      assert.match(shared.hash, /style=night/); assert.match(shared.hash, /view=/);
      await page.locator('#globeShareView').click();
      assert.equal(await page.locator('#globeShareURL').inputValue(), shared.href, 'repeat share is stable even with clipboard failure');
      assert.equal(requests.length, 0);
      for (const id of ['globeShareView','globeVisualStyle']) {
        await page.locator('#'+id).scrollIntoViewIfNeeded();
        const target=await page.locator('#'+id).evaluate(el=>{ const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {height:r.height,visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:el===hit||el.contains(hit),overflow:document.documentElement.scrollWidth>innerWidth+1};});
        assert.ok(target.height>=44&&target.visible&&target.hit&&!target.overflow,id+JSON.stringify(target));
      }
      await page.goto(shared.href, { waitUntil: 'networkidle' }); await close();
      assert.match(await centre(), /15\.00/); assert.equal(await page.locator('#globeVisualStyle').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#globePlanes').getAttribute('aria-pressed'), 'false'); assert.equal(requests.length,0,'shared view never restores source consent');
      await page.locator('#globeCoverage').click(); await page.locator('#globeLoadArea').click();
      await page.locator('#globeCoverage[data-state="ok"]').waitFor(); await objects();
      await page.locator('#globeList [data-object-id="plane:abcdef"]').click();
      await page.locator('#globeDetailsBack').click();
      await page.locator('#globeList [data-object-id="plane:abcdef"]').click();
      await page.locator('#globeDetails').waitFor({state:'visible'});
      assert.match(await page.locator('#globeObjectName').textContent(),/CENTER001/,'reselecting the same object reopens its details');
      await page.locator('#globeFollow').click();
      assert.equal(await page.locator('#globeFollow').getAttribute('aria-pressed'),'true');
      await objects(); await page.locator('#globeFilterMap').check(); await page.locator('#globeSearch').fill('EAST002'); await settle();
      assert.equal(await page.locator('#globeList [data-object-id]').count(),1,'list respects search');
      assert.equal(await page.locator('#globeStopFollow').isVisible(),true,'filtering retains followed selection');
      assert.match(await page.locator('#globeMapFilterStatus').textContent(),/select|follow/i);
      await page.locator('#globeResetSearch').click(); assert.equal(await page.locator('#globeFilterMap').isChecked(),true,'reset retains explicit map filter setting');
      await page.locator('#globeFilterMap').uncheck(); await page.locator('#globeFilterMap').check();
      await close(); await go('-33.86, 151.21');
      assert.equal(await page.locator('#globeStopFollow').isVisible(),false,'place navigation interrupts follow');
      assert.match(await centre(),/33\.86° S/);
      await page.locator('#globeCoverage').click();
      assert.match(await page.locator('#globeFeedDetails').textContent(),/15\.00/,'navigation does not rewrite consented query centre');
      assert.equal(requests.length,1,'search, share, follow, filters do not issue extra provider requests');
      await close(); await settle();
      const file=`explorer-${label}.png`;await page.screenshot({path:resolve(results,file),fullPage:true});screenshots.push(file);
      assert.deepEqual(errors,[],label+' no script errors or unexpected network'); completed.push(label+' place validation, repeat share/clipboard denial, private URL removal, share restore consent, map filters, repeated same-object selection, follow interruption, responsive controls');
    } catch(error) { await page.screenshot({path:resolve(results,`explorer-${label}-failure.png`),fullPage:true}).catch(()=>{}); throw error; }
    finally { await context.close(); }
  }
} catch(error) { failure=error; console.error(error.stack||error); }
finally {
  await writeFile(resolve(results,'explorer-browser-results.json'),JSON.stringify({ok:!failure,completed,screenshots,error:failure?.message||null,evidence:'Headless Chromium with mocked provider HTTP, clipboard rejection and touch-capable viewports. Not physical phone testing or live coverage proof.'},null,2));
  await browser?.close(); await new Promise(resolve=>server.close(resolve));
}
if(failure) process.exitCode=1;else console.log(`Explorer browser gate passed: ${completed.length} viewport journeys.`);
