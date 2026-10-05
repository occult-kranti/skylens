// Optional release diagnostic, deliberately separate from deterministic npm test.
// node tests/live-feeds.mjs             -> one Node GET per provider, CORS headers only
// node tests/live-feeds.mjs --browser   -> one real browser GET per provider instead
// node tests/live-feeds.mjs --self-test -> offline parser/metadata checks; no requests
// --browser --satellites-only probes stations+visual sequentially, stopping on
// any source error; --cache-output retains those public elements for later
// browser verification without downloading the same update twice.
// Do not repeatedly rerun: CelesTrak GP data may be downloaded only once per 2 h update.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseOMM, ommEpoch, MAX_ELEMENT_AGE_DAYS } from '../js/satellites.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://occult-kranti.github.io';
const TIMEOUT_MS = 5000;
const SAT_FEEDS = ['stations', 'visual'].map(group => ({ id: 'celestrak-' + group, group,
  url: `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=JSON` }));
const AIR_FEED = { id: 'avioadsb-london', url: 'https://avioadsb.org/v1/point/51.500/0.000/50' };
const FEEDS = process.argv.includes('--satellites-only') ? SAT_FEEDS : [SAT_FEEDS[0], AIR_FEED];
const HEADERS = ['date', 'content-type', 'age', 'cache-control', 'access-control-allow-origin',
  'access-control-expose-headers', 'retry-after', 'x-avioadsb-tier', 'x-ratelimit-limit',
  'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-policy'];
const iso = ms => Number.isFinite(ms) && Math.abs(ms) <= 8.64e15 ? new Date(ms).toISOString() : null;

function describePayload(id, body, receivedAt) {
  if (body.length > 1024 * 1024) throw new Error('Response exceeds diagnostic 1 MiB parse limit');
  if (id.startsWith('celestrak-')) {
    const records = parseOMM(body, id.slice('celestrak-'.length));
    if (!records.length) throw new Error('No valid OMM JSON orbital records');
    const epochs = records.map(r => ommEpoch(r.omm.EPOCH)).filter(Number.isFinite);
    if (!epochs.length) throw new Error('No valid element epochs');
    const iss = records.find(r => Number(r.omm.NORAD_CAT_ID) === 25544);
    return { count: records.length, invalidEpochCount: records.length - epochs.length,
      oldestEpoch: iso(Math.min(...epochs)), newestEpoch: iso(Math.max(...epochs)),
      issEpoch: iss ? iso(ommEpoch(iss.omm.EPOCH)) : null,
      olderThanDisplayPolicyCount: epochs.filter(e => Math.abs(receivedAt - e) / 86400000 > MAX_ELEMENT_AGE_DAYS).length,
      displayPolicyDays: MAX_ELEMENT_AGE_DAYS,
      note: 'Orbital epoch is distinct from HTTP retrieval time. This checks structure, not orbital accuracy.' };
  }
  const json = JSON.parse(body);
  if (!Array.isArray(json.ac)) throw new Error('Expected aircraft array ac');
  const timestamp = typeof json.now === 'number' ? json.now : NaN;
  const providerTimestamp = iso(timestamp);
  return { count: json.ac.length, providerTimestamp,
    providerAgeSeconds: providerTimestamp ? (receivedAt - timestamp) / 1000 : null,
    timestampStatus: !providerTimestamp ? 'missing-or-invalid' : timestamp > receivedAt + 5000 ? 'future-clock-mismatch' :
      receivedAt - timestamp > 60000 ? 'older-than-60-seconds' : 'within-60-seconds',
    recentPositionCount: json.ac.filter(a => Number.isFinite(a.lat) && Math.abs(a.lat) <= 90 &&
      Number.isFinite(a.lon) && Math.abs(a.lon) <= 180 && Number.isFinite(a.seen_pos) && a.seen_pos >= 0 && a.seen_pos <= 60).length,
    note: 'Empty coverage is valid and does not establish an empty sky. Counts do not prove all aircraft are tracked.' };
}

function describeResult(feed, raw, mode, startedAt, receivedAt) {
  const headers = Object.fromEntries(HEADERS.map(k => [k, raw.headers?.[k] ?? null]));
  const allowed = headers['access-control-allow-origin'];
  const result = { id: feed.id, url: feed.url, requestedAt: iso(startedAt), receivedAt: iso(receivedAt),
    durationMs: receivedAt - startedAt, httpStatus: raw.status ?? null, responseHeaders: headers,
    cors: { origin: ORIGIN, declaredPermission: allowed === '*' || allowed === ORIGIN ? 'allows-origin' :
      allowed ? 'different-origin' : 'not-observed',
      browserReadable: mode === 'browser' ? raw.readable === true : null,
      verification: mode === 'browser' ? 'real Chromium fetch from synthetic page at Pages origin' :
        'Node header observation only; browser delivery unverified' },
    outcome: raw.error ? 'transport-error' : raw.status !== 200 ? 'http-error' : 'ok' };
  if (raw.error) result.error = String(raw.error).slice(0, 500);
  else if (raw.status === 200) {
    try { result.payload = describePayload(feed.id, raw.body, receivedAt); }
    catch (e) { result.outcome = 'parse-error'; result.error = e.message; }
  }
  if (mode === 'browser') result.browserExposedHeaders = raw.visibleHeaders || {};
  return result;
}

async function nodeRequest(feed) {
  const response = await fetch(feed.url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual',
    headers: { Origin: ORIGIN }, credentials: 'omit' });
  return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
}

async function browserSession() {
  let pw;
  if (process.env.PLAYWRIGHT_PKG) pw = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_PKG)).href);
  else {
    try { pw = await import('playwright'); }
    catch { pw = await import('/opt/codex/cua_node/lib/node_modules/playwright/index.mjs'); }
  }
  const browser = await pw.chromium.launch({ headless: true,
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const landing = ORIGIN + '/skylens/feed-probe.html';
    await context.route('**/*', route => route.request().url() === landing ?
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Feed delivery diagnostic</title>' }) :
      FEEDS.some(feed => feed.url === route.request().url()) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(landing, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    return { close: () => browser.close(), request: async feed => {
      let observedResponse = null;
      const capture = response => { if (response.url() === feed.url) observedResponse = response; };
      page.on('response', capture);
      let raw;
      try {
        raw = await page.evaluate(async ({ url, timeout }) => {
          try {
            const r = await fetch(url, { signal: AbortSignal.timeout(timeout), credentials: 'omit', redirect: 'error' });
            return { status: r.status, body: await r.text(), readable: true,
              visibleHeaders: Object.fromEntries(r.headers) };
          } catch (e) { return { error: String(e), readable: false }; }
        }, { url: feed.url, timeout: TIMEOUT_MS });
      } finally { page.off('response', capture); }
      if (observedResponse) {
        raw.headers = await observedResponse.allHeaders();
        raw.status ??= observedResponse.status();
      }
      return raw;
    } };
  } catch (error) { await browser.close(); throw error; }
}

function selfTest() {
  const now = Date.parse('2026-10-05T00:00:00Z');
  const sample = JSON.stringify([{ OBJECT_NAME: 'ISS (ZARYA)', NORAD_CAT_ID: 25544, EPOCH: '2026-08-22T12:00:00' }]);
  const tle = describePayload(FEEDS[0].id, sample, now);
  assert.equal(tle.count, 1);
  assert.equal(tle.olderThanDisplayPolicyCount, 1);
  assert.ok(tle.issEpoch.startsWith('2026-08-22'));
  assert.throws(() => describePayload(FEEDS[0].id, '<html>Blocked</html>', now), /No valid/);
  const aircraft = describePayload(AIR_FEED.id, JSON.stringify({ ac: [], now }), now);
  assert.equal(aircraft.count, 0);
  assert.equal(aircraft.timestampStatus, 'within-60-seconds');
  assert.equal(describePayload(AIR_FEED.id, '{"ac":[]}', now).timestampStatus, 'missing-or-invalid');
  assert.equal(describePayload(AIR_FEED.id, JSON.stringify({ ac: [], now: now + 61000 }), now).timestampStatus, 'future-clock-mismatch');
  assert.throws(() => describePayload(AIR_FEED.id, '{"detail":"limited"}', now), /Expected aircraft/);
  const limited = describeResult(AIR_FEED, { status: 429, headers: { 'retry-after': '86400' } }, 'node', now, now);
  assert.equal(limited.outcome, 'http-error');
  assert.equal(limited.responseHeaders['retry-after'], '86400');
  assert.equal(limited.cors.browserReadable, null);
  const cors = describeResult(AIR_FEED, { status: 200, body: '{"ac":[]}', headers: { 'access-control-allow-origin': '*' } }, 'node', now, now);
  assert.equal(cors.cors.declaredPermission, 'allows-origin');
  assert.equal(cors.cors.browserReadable, null, 'Node headers do not prove browser delivery');
  console.log('Live-feed diagnostic: 14 offline assertions passed; no network requests.');
}

if (process.argv.includes('--self-test')) selfTest();
else {
  const mode = process.argv.includes('--browser') ? 'browser' : 'node';
  const report = { generatedAt: new Date().toISOString(), mode, origin: ORIGIN,
    purpose: 'Non-blocking provider diagnostic; no credentials, no personal location, one request per endpoint, no retries.',
    timeoutMs: TIMEOUT_MS, feeds: [] };
  let session;
  const cachedElements = [];
  let orbitalFailure = false;
  try {
    if (mode === 'browser') session = await browserSession();
    for (const feed of FEEDS) {
      if (feed.group && orbitalFailure) { report.feeds.push({ id: feed.id, outcome: 'skipped-after-source-error' }); continue; }
      const startedAt = Date.now();
      let raw;
      try { raw = await (session ? session.request(feed) : nodeRequest(feed)); }
      catch (e) { raw = { error: `${String(e)}${e.cause?.code ? ` (${e.cause.code})` : ''}`, readable: false }; }
      const result = describeResult(feed, raw, mode, startedAt, Date.now());
      report.feeds.push(result);
      if (feed.group) {
        if (result.outcome !== 'ok') orbitalFailure = true;
        else cachedElements.push(...parseOMM(raw.body, feed.group));
      }
    }
  } catch (e) { report.environmentError = String(e).slice(0, 1000); }
  finally { await session?.close(); }
  await mkdir(resolve(ROOT, 'test-results'), { recursive: true });
  await writeFile(resolve(ROOT, 'test-results/live-feeds.json'), JSON.stringify(report, null, 2) + '\n');
  if (process.argv.includes('--cache-output') && process.argv.includes('--satellites-only') && !orbitalFailure && cachedElements.length) {
    const cache = { t: Date.now(), list: cachedElements, groupsLoaded: ['stations', 'visual'], partial: false };
    await writeFile(resolve(ROOT, 'test-results/live-orbital-cache.json'), JSON.stringify(cache) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
  // Provider or browser failures are evidence, not a failure of deterministic app tests.
}
