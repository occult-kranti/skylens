// Offline feed normalization and adversarial lifecycle checks. All fetches below
// are mocked; no public provider or user receiver is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as ThreadWorker } from 'node:worker_threads';
import { normalizeTrafficPayload, normalizeTrafficText, refreshTrafficReports, validateTrafficReceiverURL, TRAFFIC_LIMITS } from '../js/traffic-feed.js';

const AT = Date.parse('2026-10-15T00:00:00Z');
const row = (hex = 'abc123', patch = {}) => ({ hex, lat: 37, lon: -122, seen_pos: 0, alt_geom: 10000, flight: 'TEST', ...patch });
const json = (aircraft = [row()], at = AT) => ({ now: at / 1000, aircraft });
const options = (patch = {}) => ({ schema: 'readsb-aircraft-json', source: { id: 'receiver', name: 'Owned receiver' }, receivedAt: AT, coverage: { kind: 'receiver', label: 'Operator-declared coverage, unverified' }, ...patch });
const receiver = (patch = {}) => ({ kind: 'receiver', url: 'https://receiver.example.org/aircraft.json', schema: 'readsb-aircraft-json', coverageLabel: 'Owned receiver coverage', ...patch });
const regional = (patch = {}) => ({ kind: 'regional', provider: 'avioadsb', center: { lat: 51.5, lon: 0 }, rangeNm: 50, ...patch });

test('Absolute normalization retains dateline, opposite-hemisphere and polar reports without a sky observer', () => {
  const records = [row('abc001', { lat: 0, lon: 179.9 }), row('abc002', { lat: 0, lon: -179.9 }), row('abc003', { lat: -89, lon: 45 }), row('abc004', { lat: 51.5, lon: 0 })];
  const out = normalizeTrafficPayload(json(records), options());
  assert.equal(out.reports.length, 4); assert.deepEqual(out.reports.map(p => [p.lat, p.lon]), records.map(p => [p.lat, p.lon]));
  assert.equal(out.coverage.kind, 'receiver'); assert.equal(out.providerAt, AT); assert.equal(out.receivedAt, AT);
  for (const p of out.reports) { assert.equal(p.alt, undefined); assert.equal(p.az, undefined); assert.equal(p.distKm, undefined); assert.equal(p.positionMode, 'reported'); }
});

test('The two timestamp schemas are explicit; wrong units, stale and future payloads fail closed', () => {
  const a = normalizeTrafficPayload(json(), options());
  const b = normalizeTrafficPayload({ now: AT, ac: [row()] }, options({ schema: 'readsb-v2' }));
  assert.equal(a.reports[0].positionAt, b.reports[0].positionAt);
  assert.throws(() => normalizeTrafficPayload({ now: AT / 1000, ac: [] }, options({ schema: 'readsb-v2' })), /stale/);
  assert.throws(() => normalizeTrafficPayload({ now: AT, aircraft: [] }, options()), /stale/);
  for (const at of [AT - 60001, AT + 5001]) assert.throws(() => normalizeTrafficPayload(json([], at), options()), /stale/);
  for (const schema of [undefined, 'auto', 'seconds']) assert.throws(() => normalizeTrafficPayload(json(), options({ schema })));
  assert.throws(() => normalizeTrafficPayload({ aircraft: [] }, options()));
  assert.throws(() => normalizeTrafficPayload(json(), options({ receivedAt: NaN })));
});

test('Unknown height and ground are explicit; geometric units win without inventing positions or destinations', () => {
  const out = normalizeTrafficPayload(json([
    row('abc001', { alt_geom: 5000, alt_baro: 25000, origin: 'UNTRUSTED', destination: 'INVENTED', r: 'N123', t: 'A320' }),
    row('abc002', { alt_geom: undefined, alt_baro: 12000 }),
    row('abc003', { alt_geom: undefined, alt_baro: undefined }),
    row('abc004', { alt_geom: undefined, alt_baro: 'ground' }),
    row('abc005', { lat: undefined, lon: undefined, lastPosition: { lat: 20, lon: 20 }, rr_lat: 20, rr_lon: 20 }),
  ]), options());
  assert.equal(out.reports.length, 4);
  const [geometric, pressure, unknown, ground] = out.reports;
  assert.equal(geometric.altM, 1524); assert.equal(geometric.altitudeKind, 'geometric-wgs84');
  assert.ok(Math.abs(pressure.altM - 3657.6) < 1e-9); assert.equal(pressure.altitudeKind, 'barometric-approximate');
  assert.equal(unknown.altM, null); assert.equal(unknown.altFt, null); assert.equal(unknown.altitudeKind, 'unknown'); assert.equal(unknown.overlayEligible, false); assert.equal(unknown.markerEligible, true);
  assert.equal(ground.ground, true); assert.equal(ground.overlayEligible, false);
  assert.equal(geometric.aircraftType, 'A320'); assert.ok(!JSON.stringify(out).includes('INVENTED')); assert.ok(!JSON.stringify(out).includes('UNTRUSTED'));
});

test('Duplicates choose the newest position and freshness combines payload delay with seen_pos', () => {
  const out = normalizeTrafficPayload(json([
    row('ABC001', { seen_pos: 30, lon: 20 }), row('abc001', { seen_pos: 2, lon: 21 }), row('abc001', { seen_pos: 10, lon: 22 }),
    row('abc002', { seen_pos: 56 }), row('abc003', { seen_pos: 0, seen: 9999 }), row('bad', { seen_pos: 0 }),
  ], AT - 5000), options());
  assert.equal(out.reports.length, 2); assert.equal(out.reports[0].lon, 21); assert.equal(out.reports[0].positionAt, AT - 7000);
  assert.equal(out.reports[1].hex, 'abc003', '`seen` does not replace position age');
  assert.equal(refreshTrafficReports(out.reports, AT + 13000)[0].markerEligible, true);
  assert.equal(refreshTrafficReports(out.reports, AT + 13001)[0].markerEligible, false);
  assert.equal(refreshTrafficReports(out.reports, AT + 53000).length, 2);
  assert.equal(refreshTrafficReports(out.reports, AT + 53001).length, 1);
  assert.equal(refreshTrafficReports(out.reports, AT + 55001).length, 0);
});

test('Response row bounds fail explicitly and source/coverage input is whitelisted', () => {
  assert.throws(() => normalizeTrafficPayload(json(Array(TRAFFIC_LIMITS.rows + 1).fill(row())), options()), /bounded/);
  const source = { id: 'receiver', name: 'Owned receiver', token: 'SECRET' }, coverage = { kind: 'regional', center: { lat: 1, lon: 2, secret: 'PRIVATE' }, rangeNm: 50, label: 'Selected region', extra: 'SECRET' };
  const out = normalizeTrafficPayload(json([]), options({ source, coverage }));
  assert.deepEqual(out.reports, []); assert.ok(!JSON.stringify(out).includes('SECRET')); assert.ok(!JSON.stringify(out).includes('PRIVATE'));
  coverage.center.lat = 80; assert.equal(out.coverage.center.lat, 1);
});

test('Reported map coordinates override inherited regional motion projections without changing raw telemetry', () => {
  const report = normalizeTrafficPayload(json(), options()).reports[0];
  const [current] = refreshTrafficReports([{ ...report, projectedLat: -70, projectedLon: 170, projectedAltitudeM: 99999, positionMode: 'extrapolated', extrapolatedSeconds: 15 }], AT + 10000);
  assert.equal(current.positionMode, 'reported'); assert.equal(current.extrapolatedSeconds, 0);
  assert.equal(current.projectedLat, report.lat); assert.equal(current.projectedLon, report.lon); assert.equal(current.projectedAltitudeM, report.altM);
  assert.equal(current.positionAt, report.positionAt);
});

test('A50000-track receiver snapshot stays complete within the advertised bound and records CPU cost', t => {
  const records = Array.from({ length: 50000 }, (_, i) => row((i + 1).toString(16).padStart(6, '0'), {
    lat: i % 17000 / 100 - 85, lon: i * 137.5 % 360 - 180, seen_pos: i % 30,
  }));
  // This measures a synthetic Node workload, not mobile/browser performance.
  normalizeTrafficPayload(json(records.slice(0, 1000)), options());
  const normalizeMs = [], refreshMs = []; let out;
  for (let repeat = 0; repeat < 3; repeat++) {
    let start = performance.now(); out = normalizeTrafficPayload(json(records), options()); normalizeMs.push(performance.now() - start);
    start = performance.now(); const refreshed = refreshTrafficReports(out.reports, AT + 1000); refreshMs.push(performance.now() - start);
    assert.equal(refreshed.length, records.length);
  }
  assert.equal(out.inputCount, 50000); assert.equal(out.retainedCount, 50000); assert.equal(out.excludedCount, 0); assert.equal(out.truncated, false);
  const median = values => [...values].sort((a, b) => a - b)[1];
  t.diagnostic(JSON.stringify({ environment: `${process.version} ${process.platform}/${process.arch}`, tracks: records.length, samples: 3,
    normalizationMedianMs: +median(normalizeMs).toFixed(2), refreshMedianMs: +median(refreshMs).toFixed(2), note: 'Synthetic Node CPU only; no mobile or network claim.' }));
});

test('Receiver URLs require HTTPS and reject embedded credentials, query secrets and fragments', () => {
  assert.equal(validateTrafficReceiverURL('https://receiver.example.org/aircraft.json'), 'https://receiver.example.org/aircraft.json');
  for (const url of ['http://receiver.example.org/a.json', 'javascript:alert(1)', 'https://user:password@example.org/a.json', 'https://example.org/a.json?key=SECRET', 'https://example.org/a.json#SECRET', '/aircraft.json', '']) assert.throws(() => validateTrafficReceiverURL(url));
});

test('Worker-less fallback reports its processing mode and respects the same validation', async () => {
  const out = await normalizeTrafficText(JSON.stringify(json()), options(), { Worker: null });
  assert.equal(out.processingMode, 'main-thread-fallback'); assert.equal(out.reports[0].hex, 'abc123');
  await assert.rejects(normalizeTrafficText('SECRET malformed JSON', options(), { Worker: null }), /not valid JSON/);
  await assert.rejects(normalizeTrafficText('x'.repeat(TRAFFIC_LIMITS.responseBytes + 1), options(), { Worker: null }), /bound/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(normalizeTrafficText(JSON.stringify(json()), options(), { Worker: null, signal: abort.signal }), { name: 'AbortError' });
});

test('The actual worker module parses and normalizes in a separate Node thread without feed requests', async () => {
  const instances = [];
  class BrowserWorkerAdapter {
    constructor(url, opts) {
      assert.equal(opts.type, 'module'); assert.match(url.pathname, /traffic-worker\.js$/);
      this.ready = false; this.pending = []; this.terminated = 0; instances.push(this);
      const script = `const { parentPort } = require('node:worker_threads');
        globalThis.fetch = () => { throw new Error('Worker must not fetch'); };
        globalThis.addEventListener = (name, callback) => { if (name === 'message') parentPort.on('message', data => callback({data})); };
        globalThis.postMessage = data => parentPort.postMessage(data);
        import(${JSON.stringify(url.href)}).then(() => parentPort.postMessage({ready:true}));`;
      this.thread = new ThreadWorker(script, { eval: true });
      this.thread.on('message', data => {
        if (data.ready) { this.ready = true; this.pending.splice(0).forEach(value => this.thread.postMessage(value)); }
        else this.onmessage?.({ data });
      });
      this.thread.on('error', error => this.onerror?.({ error, preventDefault() {} }));
    }
    postMessage(value) { if (this.ready) this.thread.postMessage(value); else this.pending.push(value); }
    terminate() { this.terminated++; this.thread.terminate(); }
  }
  const out = await normalizeTrafficText(JSON.stringify(json([row(), row('abc002', { lat: -40, lon: 175 })])), options(), { Worker: BrowserWorkerAdapter });
  assert.equal(out.processingMode, 'worker'); assert.equal(out.reports.length, 2); assert.equal(out.reports[1].lon, 175); assert.equal(instances[0].terminated, 1);
  await assert.rejects(normalizeTrafficText('PRIVATE bad JSON', options(), { Worker: BrowserWorkerAdapter }), /validation/);
  assert.equal(instances[1].terminated, 1);
});

test('Worker abort terminates immediately and late posts cannot resolve an obsolete request', async () => {
  const instances = [];
  class PendingWorker {
    constructor() { this.terminated = 0; instances.push(this); }
    postMessage(value) { this.job = value; }
    terminate() { this.terminated++; }
  }
  const controller = new AbortController();
  const promise = normalizeTrafficText(JSON.stringify(json()), options(), { Worker: PendingWorker, signal: controller.signal });
  const late = instances[0].onmessage; controller.abort();
  await assert.rejects(promise, { name: 'AbortError' }); assert.equal(instances[0].terminated, 1);
  assert.equal(instances[0].onmessage, null);
  late({ data: { id: 1, ok: true, result: normalizeTrafficPayload(json(), options()) } });
  assert.equal(instances[0].terminated, 1, 'late result cannot settle or clean up twice');
  const firstError = normalizeTrafficText(JSON.stringify(json()), options(), { Worker: PendingWorker });
  instances[1].onerror({ preventDefault() {} }); await assert.rejects(firstError, /could not run/); assert.equal(instances.length, 2, 'failed workers are not respawned or silently retried');
  class BrokenWorker { constructor() { throw new Error('Blocked worker'); } }
  await assert.rejects(normalizeTrafficText(JSON.stringify(json()), options(), { Worker: BrokenWorker }), /could not be started/);
});

const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
const realDelay = globalThis.setTimeout;
const until = async predicate => {
  for (let i = 0; i < 300; i++) { if (predicate()) return; await new Promise(resolve => realDelay(resolve, 1)); }
  assert.ok(predicate(), 'Asynchronous fixture did not reach its expected request state.');
};
let fixtureIndex = 0;
async function harness(fn) {
  const names = ['fetch', 'setTimeout', 'clearTimeout', 'localStorage', 'document', 'navigator', 'Worker'];
  const saved = new Map(names.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)])), realNow = Date.now;
  const base = AT + (++fixtureIndex) * 86400000; let now = base, nextId = 0;
  const storage = new Map(), timers = new Map(), requests = [], controllers = [];
  const doc = new EventTarget(); doc.hidden = false;
  const s = { base, storage, timers, requests, doc, now: () => now,
    advance(ms) { now += ms; },
    run(ms) { const found = [...timers].find(([, task]) => task.ms === ms); assert.ok(found, `No timer for${ms}ms`); timers.delete(found[0]); found[1].fn(); },
    response: (aircraft = [row()], opts = {}) => new Response(JSON.stringify(json(aircraft, now)), { status: 200, headers: { 'Content-Type': 'application/json' }, ...opts }),
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) } });
  Date.now = () => now;
  globalThis.setTimeout = (fn, ms) => { timers.set(++nextId, { fn, ms }); return nextId; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.fetch = async (url, opts) => { requests.push({ url, opts }); return s.response(); };
  const module = await import(`../js/traffic-feed.js?traffic-test=${fixtureIndex}`);
  s.create = opts => { const c = module.createTrafficFeed({ document: doc, ...opts }); controllers.push(c); return c; };
  s.planes = await import('../js/planes.js');
  s.startPlane = (...args) => { const c = s.planes.startPlanes(...args); controllers.push({ dispose: () => c.stop() }); return c; };
  try { await fn(s); } finally {
    controllers.forEach(c => c.dispose()); await flush(); Date.now = realNow;
    for (const [k, desc] of saved) { if (desc) Object.defineProperty(globalThis, k, desc); else delete globalThis[k]; }
  }
}

test('Construction and validation send nothing; own receiver fetch discloses no query center or authorization', () => harness(async s => {
  const updates = [], c = s.create({ onUpdate: u => updates.push(u) });
  assert.equal(s.requests.length, 0);
  assert.throws(() => c.start(receiver({ url: 'http://insecure.example.org/aircraft.json' })));
  assert.equal(s.requests.length, 0);
  await c.start(receiver());
  assert.equal(s.requests.length, 1); const { url, opts } = s.requests[0];
  assert.equal(url, receiver().url); assert.equal(opts.credentials, 'omit'); assert.equal(opts.redirect, 'error'); assert.equal(opts.referrerPolicy, 'no-referrer'); assert.equal(opts.headers, undefined);
  assert.equal(updates.at(-1).status, 'ok'); assert.equal(updates.at(-1).sourceName, 'Receiver · receiver.example.org');
  assert.ok([...s.timers.values()].some(t => t.ms === 15000));
  assert.ok(![...s.storage.values()].join('').includes(receiver().url)); assert.ok(![...s.storage.keys()].join('').includes('receiver.example.org'));
  c.stop(); assert.equal(s.timers.size, 0);
}));

test('Regional query centers are frozen independently from the sky observer and retain absolute raw positions', () => harness(async s => {
  const skyObserver = Object.freeze({ lat: 10, lon: 20 }), center = { lat: 51.5, lon: 0 }, updates = [];
  globalThis.fetch = async (url, opts) => { s.requests.push({ url, opts }); return { ok: true, status: 200, headers: new Headers(), json: async () => ({ now: s.now(), ac: [row('abc123', { lat: 51.6, lon: .1 })] }) }; };
  const c = s.create({ onUpdate: u => updates.push(u) }); await c.start(regional({ center })); center.lat = 0; await flush();
  assert.equal(s.requests.length, 1); assert.match(s.requests[0].url, /51\.500\/0\.000\/50$/);
  assert.deepEqual(skyObserver, { lat: 10, lon: 20 }); assert.equal(updates.at(-1).coverage.center.lat, 51.5);
  assert.equal(updates.at(-1).reports[0].lat, 51.6); assert.equal(updates.at(-1).reports[0].lon, .1);
  c.stop();
}));

test('Sky and map requests share the same reservation across controller restart and persisted reload', () => harness(async s => {
  globalThis.fetch = async (url, opts) => { s.requests.push({ url, opts }); return { ok: true, status: 200, headers: new Headers(), json: async () => ({ now: s.now(), ac: [] }) }; };
  const sky = s.startPlane(() => ({ lat: 51.5, lon: 0 }), () => {}); await flush(); sky.stop();
  assert.equal(s.requests.length, 1);
  const updates = [], map = s.create({ onUpdate: u => updates.push(u) }); await map.start(regional()); await flush();
  assert.equal(s.requests.length, 1); assert.equal(updates.at(-1).status, 'waiting'); assert.equal(updates.at(-1).retryAt, s.now() + 12000);
  s.advance(12000); s.run(12000); await flush(); assert.equal(s.requests.length, 2); map.stop();
  const reloaded = await import(`../js/planes.js?traffic-reload=${fixtureIndex}`); let result, locations = 0;
  const late = reloaded.startPlanes(() => { locations++; return { lat: 1, lon: 2 }; }, u => { result = u; });
  await flush(); assert.equal(result.status, 'waiting'); assert.equal(locations, 0); assert.equal(s.requests.length, 2); late.stop();
  const saved = [...s.storage.values()].join(''); assert.ok(!saved.includes('51.5') && !saved.includes('lon'));
}));

test('Available Web Locks serialize concurrent reservations; storage failure retains process protection', () => harness(async s => {
  const lockNames = [], chains = new Map();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request(name, opts, callback) {
    lockNames.push(name); const previous = chains.get(name) || Promise.resolve();
    const next = previous.then(() => opts.signal?.aborted ? { allowed: false, cancelled: true } : callback()); chains.set(name, next.catch(() => {})); return next;
  } } } });
  const results = await Promise.all([s.planes.reserveAircraftRequest('adsbfi'), s.planes.reserveAircraftRequest('adsbfi')]);
  assert.equal(results.filter(r => r.allowed).length, 1); assert.equal(results.filter(r => r.status === 'waiting').length, 1); assert.ok(lockNames.every(n => n === 'skylens-aircraft-request:adsbfi'));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  s.advance(5000); assert.equal(s.planes.reserveAircraftRequest('adsbfi').allowed, true); assert.equal(s.planes.reserveAircraftRequest('adsbfi').status, 'waiting');
}));

test('Receiver hidden-start/resume and stop suppress old responses and remove all work', () => harness(async s => {
  let resolve, signal; const updates = [];
  globalThis.fetch = (_url, opts) => { signal = opts.signal; s.requests.push({ opts }); return new Promise(r => { resolve = r; }); };
  s.doc.hidden = true; const c = s.create({ onUpdate: u => updates.push(u) }); await c.start(receiver()); assert.equal(s.requests.length, 0);
  s.doc.hidden = false; s.doc.dispatchEvent(new Event('visibilitychange')); await until(() => s.requests.length === 1);
  s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange')); assert.equal(signal.aborted, true); const before = updates.length;
  resolve(s.response()); await flush(); assert.equal(updates.length, before); assert.equal(s.timers.size, 0);
  s.advance(15000); s.doc.hidden = false; s.doc.dispatchEvent(new Event('visibilitychange')); await until(() => s.requests.length === 2);
  c.stop(); assert.equal(signal.aborted, true); resolve(s.response()); await flush();
  s.doc.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(s.requests.length, 2); assert.equal(s.timers.size, 0);
}));

test('Changing receiver rejects late old data; invalid replacement cancels prior disclosure', () => harness(async s => {
  const pending = [], updates = [];
  globalThis.fetch = (url, opts) => new Promise(resolve => pending.push({ url, opts, resolve }));
  const c = s.create({ onUpdate: u => updates.push(u) }); const first = c.start(receiver()); await until(() => pending.length === 1);
  const second = c.start(receiver({ url: 'https://second.example.org/aircraft.json' })); await until(() => pending.length === 2); assert.equal(pending[0].opts.signal.aborted, true);
  pending[0].resolve(s.response([row('abc001')])); await first;
  pending[1].resolve(s.response([row('abc002')])); await second;
  assert.equal(updates.at(-1).reports[0].hex, 'abc002'); assert.ok(!updates.some(u => u.reports?.some(p => p.hex === 'abc001')));
  s.advance(15000); const third = c.start(receiver()); await until(() => pending.length === 3);
  assert.throws(() => c.start(receiver({ url: 'https://bad.example.org/?key=SECRET' })));
  assert.equal(pending[2].opts.signal.aborted, true); pending[2].resolve(s.response()); await third; assert.equal(s.timers.size, 0);
}));

test('Hiding the page during worker normalization terminates work and suppresses its buffered reply', () => harness(async s => {
  const workers = [], updates = [];
  class PendingWorker {
    constructor() { this.terminated = 0; workers.push(this); }
    postMessage(value) { this.job = value; }
    terminate() { this.terminated++; }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: PendingWorker });
  const feed = s.create({ onUpdate: value => updates.push(value) }); const task = feed.start(receiver());
  await until(() => workers.length === 1 && workers[0].job);
  const late = workers[0].onmessage, before = updates.length;
  s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange')); await task;
  assert.equal(workers[0].terminated, 1); assert.equal(s.timers.size, 0);
  late({ data: { id: 1, ok: true, result: normalizeTrafficPayload(json([], s.now()), options({ receivedAt: s.now() })) } });
  assert.equal(updates.length, before); feed.stop();
}));

test('Receiver401/403/429 pauses across restart, keeps URL out of persistence and uses standard Retry-After', () => harness(async s => {
  for (const status of [401, 403, 429]) {
    const config = receiver({ url: `https://receiver${status}.example.org/aircraft.json` }), updates = [];
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('PRIVATE server body', { status, headers: { 'Retry-After': '3600' } }); };
    const c = s.create({ onUpdate: u => updates.push(u) }); await c.start(config); assert.equal(calls, 1); assert.equal(updates.at(-1).httpStatus, status); c.stop();
    await c.start(config); assert.equal(calls, 1); assert.equal(updates.at(-1).retryAt, s.now() + 3600000); c.stop();
    assert.ok(![...s.storage.values()].join('').includes(config.url)); assert.ok(!JSON.stringify(updates).includes('PRIVATE'));
  }
}));

test('Receiver byte cap applies to streamed bytes without Content-Length, and malformed/empty bodies stay errors', () => harness(async s => {
  const cases = [
    () => new Response('{}', { headers: { 'Content-Length': String(TRAFFIC_LIMITS.responseBytes + 1) } }),
    () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(TRAFFIC_LIMITS.responseBytes + 1)); c.close(); } })),
    () => new Response('<html>notJSON</html>'), () => new Response(''),
    () => s.response(Array(TRAFFIC_LIMITS.rows + 1).fill(row())),
  ];
  for (let i = 0; i < cases.length; i++) {
    const updates = [], c = s.create({ onUpdate: u => updates.push(u) }); globalThis.fetch = async () => cases[i]();
    await c.start(receiver({ url: `https://bounded${i}.example.org/aircraft.json` })); assert.equal(updates.at(-1).status, 'error'); assert.deepEqual(updates.at(-1).reports, []); c.stop();
  }
  assert.equal(s.timers.size, 0);
}));
