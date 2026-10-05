import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrackingController } from '../js/tracking.js';
import { correctedAttitude } from '../js/astro.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(options = {}) {
  let time = 100, nextTimer = 0, permissionCalls = 0, subscriptions = 0, stopped = 0;
  const timers = new Map(), live = new Set(), callbacks = [], states = [], samples = [], order = [];
  const controller = createTrackingController({
    isSupported: () => true,
    requestPermission: () => { permissionCalls++; return 'granted'; },
    subscribe(callback) {
      subscriptions++; callbacks.push(callback); live.add(callback);
      return { stop() { if (live.delete(callback)) stopped++; } };
    },
    now: () => time,
    setTimer(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: time + delay }); return id; },
    clearTimer: id => timers.delete(id),
    onState: state => { states.push(state); order.push('state:' + state.status); },
    onSample: sample => { samples.push(sample); order.push('sample'); },
    ...options,
  });
  return { controller, timers, live, callbacks, states, samples, order,
    get permissionCalls() { return permissionCalls; }, get subscriptions() { return subscriptions; }, get stopped() { return stopped; },
    sample: (overrides = {}) => ({ alpha: 0, beta: 90, gamma: 0, orient: 0, absolute: true, receivedAt: time, ...overrides }),
    emit(overrides = {}) { for (const callback of live) callback(this.sample(overrides)); },
    advance(ms) {
      const target = time + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        time = due[1].at; timers.delete(due[0]); due[1].callback();
      }
      time = target;
    },
  };
}

test('start requests permission synchronously and deduplicates a pending gesture', async () => {
  const pending = deferred(); let calls = 0;
  const f = fixture({ requestPermission: () => { calls++; return pending.promise; } });
  const a = f.controller.start();
  assert.equal(calls, 1, 'permission must be invoked before start returns');
  assert.equal(f.controller.state.status, 'requesting'); assert.equal(f.live.size, 0);
  assert.equal(f.controller.start(), a); assert.equal(calls, 1);
  pending.resolve('granted');
  assert.equal((await a).status, 'waiting'); assert.equal(f.live.size, 1);
  assert.equal(f.controller.state.resumeAllowed, true);
  await f.controller.start(); assert.equal(f.subscriptions, 1); assert.equal(calls, 1);
  f.controller.stop();
});

test('no samples become stale after three seconds and a real sample recovers without another permission request', async () => {
  const f = fixture(); await f.controller.start();
  f.advance(2999); assert.equal(f.controller.state.status, 'waiting');
  f.advance(1); assert.equal(f.controller.state.status, 'stale');
  assert.match(f.controller.state.reason, /No usable/); assert.equal(f.live.size, 1); assert.equal(f.timers.size, 0);
  f.emit(); assert.equal(f.controller.state.status, 'tracking'); assert.equal(f.samples.length, 1);
  assert.deepEqual(f.order.slice(-2), ['state:tracking', 'sample']);
  assert.equal(f.permissionCalls, 1); f.controller.stop();
});

test('freshness follows accepted sample timestamps and continuous samples do not spam state transitions', async () => {
  const f = fixture(); await f.controller.start(); f.emit();
  const transitions = f.states.length;
  const firstTimer = [...f.timers.keys()][0];
  f.advance(1000); f.emit(); f.advance(1000); f.emit();
  assert.equal(f.states.length, transitions); assert.equal(f.samples.length, 3);
  assert.deepEqual([...f.timers.keys()], [firstTimer], 'sensor frames reuse the existing watchdog timer');
  f.advance(2999); assert.equal(f.controller.state.status, 'tracking');
  f.advance(1); assert.equal(f.controller.state.status, 'stale'); assert.match(f.controller.state.reason, /No recent/);
  await f.controller.start(); assert.equal(f.subscriptions, 1, 'stale start must not add a listener');
  f.controller.stop();
});

test('malformed, old, future and out-of-order sensor samples never establish or refresh tracking', async () => {
  const f = fixture(); await f.controller.start();
  for (const malformed of [null, {}, f.sample({ alpha: null }), f.sample({ beta: Infinity }),
    f.sample({ gamma: 91 }), f.sample({ alpha: -1 }), f.sample({ orient: NaN }),
    f.sample({ receivedAt: -1 }), f.sample({ receivedAt: 10000 })]) f.callbacks[0](malformed);
  assert.equal(f.samples.length, 0); assert.equal(f.controller.state.status, 'waiting');
  f.advance(3000); assert.equal(f.controller.state.status, 'stale');
  f.emit({ receivedAt: 100 }); assert.equal(f.samples.length, 0);
  f.emit(); assert.equal(f.samples.length, 1);
  f.advance(10); f.emit({ receivedAt: 3000 }); assert.equal(f.samples.length, 1, 'older replay cannot replace a newer sample');
  f.controller.stop();
});

test('heading provenance distinguishes relative, magnetic and absolute without claiming verified true north', async () => {
  const f = fixture(); await f.controller.start();
  f.emit({ absolute: false }); assert.equal(f.samples.at(-1).headingSource, 'relative');
  f.emit({ absolute: false, compassHeading: 135, compassAcc: 25 });
  assert.equal(f.samples.at(-1).headingSource, 'magnetic-compass'); assert.equal(f.samples.at(-1).compassAcc, 25);
  f.emit({ absolute: false, compassHeading: 135, compassAcc: -1 });
  assert.equal(f.samples.at(-1).headingSource, 'relative'); assert.equal(f.samples.at(-1).compassHeading, null);
  f.emit({ absolute: true, headingSource: 'invented-true-north' });
  assert.equal(f.samples.at(-1).headingSource, 'absolute-sensor'); assert.equal(f.controller.state.headingSource, 'absolute-sensor');
  f.controller.stop();
});

test('stop invalidates late callbacks, cancels timers and does not resume merely because session permission was granted', async () => {
  const f = fixture(); await f.controller.start(); f.emit(); const old = f.callbacks[0];
  assert.equal(f.controller.stop().status, 'off'); assert.equal(f.live.size, 0); assert.equal(f.timers.size, 0);
  old(f.sample({ alpha: 90 })); f.advance(10000); f.controller.resume();
  assert.equal(f.samples.length, 1); assert.equal(f.controller.state.status, 'off');
  assert.equal(f.controller.state.enabled, false); assert.equal(f.controller.state.resumeAllowed, false);
  f.controller.stop(); assert.equal(f.stopped, 1);
  await f.controller.start(); assert.equal(f.permissionCalls, 1, 'explicit re-enable may reuse this session grant');
  assert.equal(f.subscriptions, 2); f.controller.stop();
});

test('suspend removes all work and resume uses session grant while waiting for a new sample', async () => {
  const f = fixture(); await f.controller.start(); f.emit(); const old = f.callbacks[0];
  const paused = f.controller.suspend();
  assert.equal(paused.status, 'paused'); assert.equal(paused.enabled, true); assert.equal(paused.resumeAllowed, true);
  assert.equal(paused.lastSampleAt, null); assert.equal(f.live.size, 0); assert.equal(f.timers.size, 0);
  old(f.sample()); assert.equal(f.samples.length, 1);
  assert.equal(f.controller.resume().status, 'waiting'); assert.equal(f.controller.state.lastSampleAt, null);
  f.controller.resume(); assert.equal(f.subscriptions, 2); assert.equal(f.live.size, 1); assert.equal(f.permissionCalls, 1);
  f.emit(); assert.equal(f.samples.length, 2); f.controller.stop();
});

test('permission granted after suspension cannot activate sensors or authorize automatic resume', async () => {
  const pending = deferred(); let calls = 0;
  const f = fixture({ requestPermission: () => { calls++; return pending.promise; } });
  const start = f.controller.start(); f.controller.suspend(); pending.resolve('granted'); await start;
  assert.equal(f.controller.state.status, 'paused'); assert.equal(f.controller.state.permission, 'unknown');
  assert.equal(f.controller.state.resumeAllowed, false);
  f.controller.resume(); assert.equal(calls, 1); assert.equal(f.subscriptions, 0);
  await f.controller.start(); assert.equal(calls, 2, 'new explicit gesture is required');
  assert.equal(f.controller.state.status, 'waiting'); f.controller.stop();
});

test('out-of-order permission results cannot replace the latest request or revive Manual mode', async () => {
  const requests = [deferred(), deferred()]; let calls = 0;
  const f = fixture({ requestPermission: () => requests[calls++].promise });
  const old = f.controller.start(); f.controller.stop();
  const current = f.controller.start(); requests[1].resolve('granted'); await current;
  requests[0].resolve('denied'); await old;
  assert.equal(f.controller.state.permission, 'granted'); assert.equal(f.controller.state.status, 'waiting');
  assert.equal(f.subscriptions, 1); f.controller.stop();
  const delayed = deferred(), another = fixture({ requestPermission: () => delayed.promise });
  const late = another.controller.start(); another.controller.stop(); delayed.reject(new Error('late denial')); await late;
  assert.equal(another.controller.state.status, 'off'); assert.equal(another.subscriptions, 0);
});

test('denied, failed, unsupported and subscription-error cases retain manual fallback with no resources', async () => {
  for (const outcome of ['denied', 'error', 'unexpected']) {
    const f = fixture({ requestPermission: () => outcome });
    await f.controller.start(); assert.equal(f.controller.state.status, outcome === 'denied' ? 'denied' : 'error');
    assert.equal(f.controller.state.enabled, false); assert.equal(f.live.size, 0); assert.equal(f.timers.size, 0);
    f.controller.resume(); assert.equal(f.subscriptions, 0);
  }
  const unsupported = fixture({ isSupported: () => false });
  assert.equal((await unsupported.controller.start()).status, 'unsupported'); assert.equal(unsupported.permissionCalls, 0);
  for (const requestPermission of [() => { throw new Error('gesture lost'); }, () => Promise.reject(new Error('blocked'))]) {
    const f = fixture({ requestPermission }); assert.equal((await f.controller.start()).status, 'error'); assert.equal(f.live.size, 0);
  }
  const broken = fixture({ subscribe: () => { throw new Error('adapter failed'); } });
  assert.equal((await broken.controller.start()).status, 'error'); assert.equal(broken.timers.size, 0);
  const absentHandle = fixture({ subscribe: () => null });
  assert.equal((await absentHandle.controller.start()).status, 'error'); assert.equal(absentHandle.timers.size, 0);
});

test('no-prompt platforms can resume, but a vanished capability is reported instead of pretending to track', async () => {
  let supported = true;
  const f = fixture({ requestPermission: () => 'not-required', isSupported: () => supported });
  await f.controller.start(); assert.equal(f.controller.state.permission, 'not-required');
  f.controller.suspend(); supported = false;
  assert.equal(f.controller.resume().status, 'unsupported'); assert.equal(f.live.size, 0); assert.equal(f.timers.size, 0);
});

test('synchronous adapter samples preserve state-before-sample order and reentrant stop releases its late handle', async () => {
  const order = []; let stopped = 0, controller;
  controller = createTrackingController({ isSupported: () => true, requestPermission: () => 'granted', now: () => 100,
    onState: state => order.push(state.status),
    onSample: () => { order.push('sample'); controller.stop(); },
    subscribe(callback) {
      callback({ alpha: 0, beta: 90, gamma: 0, orient: 0, receivedAt: 100 });
      return { stop() { stopped++; } };
    },
    setTimer() { throw new Error('Stopped controller must not create timers'); }, clearTimer() {},
  });
  await controller.start();
  assert.deepEqual(order, ['requesting', 'waiting', 'tracking', 'sample', 'off']); assert.equal(stopped, 1);
});

test('real orientation adapter works with no camera request and preserves the rear-phone pointing convention', async t => {
  const saved = { window: globalThis.window, event: globalThis.DeviceOrientationEvent, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const handlers = new Map(); let cameraCalls = 0;
  globalThis.window = { isSecureContext: true, orientation: 0,
    addEventListener(name, callback) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(callback); },
    removeEventListener(name, callback) { handlers.get(name)?.delete(callback); } };
  globalThis.DeviceOrientationEvent = function () {};
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia() { cameraCalls++; throw new Error('Auto AR must not open camera'); },
  } } });
  t.after(() => {
    globalThis.window = saved.window;
    if (saved.event === undefined) delete globalThis.DeviceOrientationEvent; else globalThis.DeviceOrientationEvent = saved.event;
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator); else delete globalThis.navigator;
  });
  const delivered = [], controller = createTrackingController({ onSample: sample => delivered.push(sample) });
  t.after(() => controller.stop());
  assert.equal((await controller.start()).permission, 'not-required');
  for (const callback of handlers.get('deviceorientationabsolute')) callback({ alpha: 0, beta: 90, gamma: 0 });
  assert.equal(controller.state.status, 'tracking'); assert.equal(cameraCalls, 0);
  const north = correctedAttitude(delivered[0]);
  assert.ok(Math.abs(north.az) < 1e-10); assert.ok(Math.abs(north.alt) < 1e-10);
  controller.suspend(); assert.ok([...handlers.values()].every(set => set.size === 0));
  controller.resume(); assert.ok([...handlers.values()].every(set => set.size === 1));
  controller.stop(); assert.ok([...handlers.values()].every(set => set.size === 0)); assert.equal(cameraCalls, 0);
});

test('fresh controller has no remembered grant and invalid timer configuration is rejected', async () => {
  const a = fixture(); await a.controller.start(); a.controller.stop();
  const b = fixture(); assert.equal(b.controller.state.permission, 'unknown'); assert.equal(b.controller.state.resumeAllowed, false);
  b.controller.resume(); assert.equal(b.permissionCalls, 0); assert.equal(b.subscriptions, 0);
  for (const staleAfterMs of [0, -1, NaN, Infinity]) assert.throws(() => createTrackingController({ staleAfterMs }), RangeError);
  assert.equal(Object.isFrozen(b.controller.state), true);
});
