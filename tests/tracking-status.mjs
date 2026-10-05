// Deterministic provider policy/lifecycle tests; all HTTP and storage are mocked.
import test from 'node:test';
import assert from 'node:assert/strict';

const CACHE = 'skylens.tle.v1', ATTEMPT = 'skylens.tle.attempt.v1', TWO_HOURS = 7200000;
const START = Date.parse('2026-10-05T00:00:00Z');
const TLE = 'ISS (ZARYA)\n1 25544U 98067A   26278.00000000  .00009133  00000+0  17025-3 0  9997\n2 25544  51.6331 331.8814 0007668  72.6488 287.5339 15.49570248582031\n';
const lines = TLE.trim().split('\n');
const item = { name: lines[0], l1: lines[1], l2: lines[2] };
let sequence = 0;
const moduleFresh = () => import(`../js/satellites.js?tracking-test=${++sequence}`);
const ok = (body = TLE) => ({ status: 200, ok: true, text: async () => body });
const snapshot = () => ({ status: 200, ok: true, json: async () => ({ fetchedAt: '2026-08-22T12:00:00Z', satellites: [item] }) });

async function environment(t, initial = {}) {
  const before = { fetch: globalThis.fetch, window: globalThis.window, storage: globalThis.localStorage, now: Date.now };
  let now = START;
  const values = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  const writes = [];
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => { writes.push(key); values.set(key, value); } };
  globalThis.window = { satellite: { twoline2satrec: () => ({ no: 1 }), gstime: () => 0,
    propagate: () => ({ position: { x: 6800, y: 0, z: 0 } }), eciToEcf: value => value,
    ecfToLookAngles: () => ({ elevation: 1, azimuth: 1, rangeSat: 500 }) } };
  Date.now = () => now;
  t.after(() => {
    globalThis.fetch = before.fetch; globalThis.window = before.window;
    globalThis.localStorage = before.storage; Date.now = before.now;
  });
  return { module: await moduleFresh(), values, writes, setNow: value => { now = value; } };
}

test('simultaneous requests share one sequence; successful groups and manual checks respect two-hour cache', async t => {
  const env = await environment(t), requests = [];
  globalThis.fetch = async url => { requests.push(url); return ok(); };
  const a = env.module.initSatellites(), b = env.module.initSatellites();
  assert.equal(a, b);
  const result = await a;
  assert.equal(requests.length, 2);
  assert.equal(result.count, 1, 'duplicate ISS in groups is deduplicated');
  assert.deepEqual(result.groupsLoaded, ['stations', 'visual']);
  assert.equal(result.partial, false); assert.equal(result.fetchedAt, START);
  assert.equal(result.nextRefreshAt, START + TWO_HOURS);
  assert.equal((await env.module.initSatellites()).source, 'cache');
  assert.equal(requests.length, 2);
});

test('HTTP 403 stops remaining groups, retains expired successful cache, and persists cooldown across reload', async t => {
  const oldTime = START - 3 * 3600000;
  const env = await environment(t, { [CACHE]: { t: oldTime, list: [item], groupsLoaded: ['stations', 'visual'] } });
  let requests = 0;
  globalThis.fetch = async () => { requests++; return { status: 403, ok: false }; };
  const result = await env.module.initSatellites();
  assert.equal(requests, 1); assert.equal(result.source, 'cache'); assert.equal(result.fetchedAt, oldTime);
  assert.match(result.error, /403/); assert.equal(result.cacheStale, true); assert.equal(result.stale, true);
  assert.equal(result.lastAttemptAt, START); assert.equal(result.nextRefreshAt, START + TWO_HOURS);
  assert.equal(JSON.parse(env.values.get(CACHE)).t, oldTime, 'error never rewrites successful cache timestamp');
  const reloaded = await moduleFresh();
  assert.equal((await reloaded.initSatellites()).source, 'cache');
  assert.equal(requests, 1, 'a new module/page cannot evade persisted cooldown');
});

test('expired cooldown allows one new sequence and replaces cache only on complete success', async t => {
  const env = await environment(t, { [ATTEMPT]: { t: START - TWO_HOURS, error: 'CelesTrak HTTP 503' } });
  let requests = 0;
  globalThis.fetch = async () => { requests++; return ok(); };
  const result = await env.module.initSatellites();
  assert.equal(requests, 2); assert.equal(result.source, 'celestrak'); assert.equal(result.error, null);
  assert.equal(JSON.parse(env.values.get(CACHE)).t, START);
});

test('partial success is explicit and does not destroy last complete persisted cache', async t => {
  const oldCache = { t: START - 3 * 3600000, list: [item], groupsLoaded: ['stations', 'visual'] };
  const env = await environment(t, { [CACHE]: oldCache });
  let requests = 0;
  globalThis.fetch = async () => ++requests === 1 ? ok() : { status: 503, ok: false };
  const result = await env.module.initSatellites();
  assert.equal(result.source, 'celestrak'); assert.equal(result.partial, true);
  assert.deepEqual(result.groupsLoaded, ['stations']); assert.match(result.error, /503/);
  assert.deepEqual(JSON.parse(env.values.get(CACHE)), oldCache);
  const sessionCache = await env.module.initSatellites();
  assert.equal(sessionCache.partial, true); assert.equal(sessionCache.fetchedAt, START); assert.equal(requests, 2);
});

test('unparseable success body is an error; next provider group is not requested', async t => {
  const env = await environment(t, { [CACHE]: { t: START - 3 * 3600000, list: [item] } });
  let requests = 0;
  globalThis.fetch = async () => { requests++; return ok('<html>Temporarily unavailable</html>'); };
  const result = await env.module.initSatellites();
  assert.equal(requests, 1); assert.match(result.error, /No valid orbital elements/); assert.equal(result.source, 'cache');
});

test('local fallback retains bundled timestamp and recent element epochs never clear cache-stale warning', async t => {
  const env = await environment(t);
  let remote = 0, local = 0;
  globalThis.fetch = async url => {
    if (String(url).startsWith('https:')) { remote++; throw new TypeError('network blocked'); }
    local++; return snapshot();
  };
  const result = await env.module.initSatellites();
  assert.equal(result.source, 'snapshot'); assert.equal(result.fetchedAt, Date.parse('2026-08-22T12:00:00Z'));
  assert.equal(result.stale, true); assert.equal(result.nextRefreshAt, START + TWO_HOURS);
  assert.equal(env.module.propagateNow(new Date(START), 0, 0).length, 1);
  assert.equal(env.module.satMeta().stale, true);
  assert.equal(env.module.propagateNow(new Date(START + 8 * 86400000), 0, 0).length, 0);
  assert.equal(env.module.satMeta().suppressed, 1);
  await env.module.initSatellites();
  assert.equal(remote, 1); assert.equal(local, 2, 'local fallback read does not hit provider');
});

test('blocked storage still retains the successful cache and request cooldown in memory', async t => {
  const env = await environment(t);
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  let requests = 0;
  globalThis.fetch = async () => { requests++; return ok(); };
  await env.module.initSatellites(); await env.module.initSatellites();
  assert.equal(requests, 2);
  env.setNow(START + TWO_HOURS);
  globalThis.fetch = async () => { requests++; return { status: 429, ok: false }; };
  assert.equal((await env.module.initSatellites()).source, 'cache');
  await env.module.initSatellites(); assert.equal(requests, 3);
});

test('aborting a pending provider request suppresses late cache, metadata, and second-group writes', async t => {
  const env = await environment(t);
  let resolveRequest, requests = 0;
  globalThis.fetch = async () => { requests++; return new Promise(resolve => { resolveRequest = resolve; }); };
  const controller = new AbortController(), previous = env.module.satMeta();
  const request = env.module.initSatellites({ signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort(); const writesAtAbort = env.writes.length;
  resolveRequest(ok()); await request;
  assert.equal(env.module.satMeta(), previous); assert.equal(requests, 1);
  assert.equal(env.writes.length, writesAtAbort); assert.equal(env.values.has(CACHE), false);
});

test('aborting during fallback JSON prevents late state writes; pre-aborted calls do no work', async t => {
  const env = await environment(t, { [ATTEMPT]: { t: START, error: 'CelesTrak HTTP 403' } });
  let resolveJSON, requests = 0;
  globalThis.fetch = async () => { requests++; return { status: 200, ok: true, json: () => new Promise(resolve => { resolveJSON = resolve; }) }; };
  const previous = env.module.satMeta(), controller = new AbortController();
  const request = env.module.initSatellites({ signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  resolveJSON({ fetchedAt: new Date(START).toISOString(), satellites: [item] }); await request;
  assert.equal(env.module.satMeta(), previous); assert.equal(env.module.satTotal(), 0);
  await env.module.initSatellites({ signal: controller.signal }); assert.equal(requests, 1);
});

test('rapid return after background cancellation waits for cleanup and loads fallback without another provider call', async t => {
  const env = await environment(t);
  let resolveRemote, remote = 0, local = 0;
  globalThis.fetch = async url => {
    if (String(url).startsWith('https:')) { remote++; return new Promise(resolve => { resolveRemote = resolve; }); }
    local++; return snapshot();
  };
  const controller = new AbortController();
  const oldRequest = env.module.initSatellites({ signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  const resumed = env.module.initSatellites({ signal: new AbortController().signal });
  resolveRemote(ok()); await oldRequest;
  assert.equal((await resumed).source, 'snapshot'); assert.equal(remote, 1); assert.equal(local, 1);
});

test('corrupt stored records and future cache timestamps are rejected instead of crashing or suppressing a request', async t => {
  const env = await environment(t, { [CACHE]: { t: START + TWO_HOURS, list: [item] },
    [ATTEMPT]: { t: START + TWO_HOURS, error: 'corrupt clock' } });
  let requests = 0;
  globalThis.fetch = async () => { requests++; return ok(); };
  assert.equal((await env.module.initSatellites()).source, 'celestrak'); assert.equal(requests, 2);
  const invalid = env.module.loadRecsFromList([null, {}, { l1: 2, l2: [] }, item]);
  assert.equal(invalid.count, 1); assert.equal(invalid.bad, 3);
});
