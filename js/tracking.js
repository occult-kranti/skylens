// Camera-independent ownership of orientation permission, listeners and freshness.
import { requestMotionPermission, startOrientation } from './sensors.js';

const ACTIVE = new Set(['requesting', 'waiting', 'tracking', 'stale']);
const granted = permission => permission === 'granted' || permission === 'not-required';

export function createTrackingController({
  onSample = () => {}, onState = () => {},
  requestPermission = requestMotionPermission, subscribe = startOrientation,
  isSupported = () => typeof globalThis.DeviceOrientationEvent !== 'undefined' &&
    typeof globalThis.window?.addEventListener === 'function' && globalThis.window?.isSecureContext !== false,
  now = () => performance.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id),
  staleAfterMs = 3000,
} = {}) {
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) throw new RangeError('staleAfterMs must be positive milliseconds');
  let status = 'off', enabled = false, permission = 'unknown', reason = '';
  let generation = 0, handle = null, timer = null, pending = null;
  let lastSampleAt = null, headingSource = null, waitingSince = null;

  const snapshot = () => Object.freeze({ status, enabled, permission, lastSampleAt, headingSource, reason,
    resumeAllowed: enabled && granted(permission) });
  function publish(nextStatus, nextReason = '', force = false) {
    const changed = status !== nextStatus || reason !== nextReason;
    status = nextStatus; reason = nextReason;
    if (changed || force) onState(snapshot());
  }
  function clearWatchdog() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }
  function release() {
    clearWatchdog();
    const previous = handle; handle = null;
    try { previous?.stop(); } catch { /* one adapter failure must not retain controller timers */ }
  }
  function resetSamples() { lastSampleAt = null; headingSource = null; waitingSince = null; }
  function fail(nextStatus, message) {
    generation++; release(); resetSamples(); enabled = false;
    publish(nextStatus, message);
    return snapshot();
  }
  function watchdog(token) {
    // One deadline timer, not one allocation per sensor frame. On firing it uses
    // the latest accepted timestamp and reschedules only the remaining interval.
    if (timer !== null) return;
    if (token !== generation || !enabled || !['waiting', 'tracking'].includes(status)) return;
    const reference = lastSampleAt ?? waitingSince;
    const delay = Math.max(0, staleAfterMs - (now() - reference));
    timer = setTimer(() => {
      timer = null;
      if (token !== generation || !enabled || !['waiting', 'tracking'].includes(status)) return;
      if (now() - (lastSampleAt ?? waitingSince) < staleAfterMs) { watchdog(token); return; }
      publish('stale', lastSampleAt === null ?
        'No usable orientation samples arrived. Try moving the phone or use manual exploration.' :
        'No recent orientation update. Move the phone to check, or use manual exploration.');
      // Keep the listener, with no repeating timer, so a new real sample can recover.
    }, delay);
  }
  function validated(sample) {
    if (!sample || ![sample.alpha, sample.beta, sample.gamma, sample.orient, sample.receivedAt].every(Number.isFinite)) return null;
    if (sample.alpha < 0 || sample.alpha > 360 || Math.abs(sample.beta) > 180 || Math.abs(sample.gamma) > 90) return null;
    const age = now() - sample.receivedAt;
    if (sample.receivedAt < 0 || age < -100 || age >= staleAfterMs) return null;
    if (lastSampleAt !== null && sample.receivedAt < lastSampleAt) return null;
    const compassHeading = Number.isFinite(sample.compassHeading) && sample.compassHeading >= 0 && sample.compassHeading < 360 &&
      !(Number.isFinite(sample.compassAcc) && sample.compassAcc < 0) ? sample.compassHeading : null;
    const absolute = sample.absolute === true;
    return { alpha: sample.alpha, beta: sample.beta, gamma: sample.gamma, orient: sample.orient,
      receivedAt: sample.receivedAt, absolute, compassHeading,
      compassAcc: Number.isFinite(sample.compassAcc) && sample.compassAcc >= 0 ? sample.compassAcc : null,
      headingSource: compassHeading !== null ? 'magnetic-compass' : absolute ? 'absolute-sensor' : 'relative' };
  }
  function attach(token) {
    waitingSince = now();
    publish('waiting', 'Motion is allowed. Waiting for a usable orientation sample.');
    if (token !== generation || !enabled) return snapshot();
    try {
      const subscription = subscribe(sample => {
        if (token !== generation || !enabled || !['waiting', 'tracking', 'stale'].includes(status)) return;
        const usable = validated(sample);
        if (!usable) return;
        const sourceChanged = headingSource !== usable.headingSource;
        lastSampleAt = usable.receivedAt; headingSource = usable.headingSource;
        publish('tracking', '', sourceChanged);
        // State comes first; consumers can clear obsolete state before receiving the new sample.
        if (token !== generation || !enabled || status !== 'tracking') return;
        onSample(usable);
        if (token === generation && enabled) watchdog(token);
      });
      if (!subscription || typeof subscription.stop !== 'function') throw new Error('Orientation adapter did not return a stop handle.');
      if (token !== generation || !enabled) { subscription.stop(); return snapshot(); }
      handle = subscription;
      watchdog(token);
    } catch (error) {
      if (token === generation) fail('error', `Orientation could not start: ${error?.message || 'unknown error'}`);
    }
    return snapshot();
  }
  function start() {
    if (enabled && ACTIVE.has(status)) return pending || Promise.resolve(snapshot());
    let supported;
    try { supported = isSupported(); } catch { supported = false; }
    if (!supported) return Promise.resolve(fail('unsupported', 'Orientation is unavailable in this browser or context. Manual exploration is available.'));
    generation++; release(); resetSamples(); enabled = true;
    const token = generation;
    if (granted(permission)) return Promise.resolve(attach(token));
    publish('requesting', 'Allow motion access to follow the phone.');
    if (token !== generation || !enabled) return Promise.resolve(snapshot());
    let requested;
    // Critical: invoke the browser permission function in this direct gesture call,
    // before Promise.resolve/.then or any await. Camera permission is unrelated.
    try { requested = requestPermission(); }
    catch (error) { return Promise.resolve(fail('error', `Motion permission failed: ${error?.message || 'unknown error'}`)); }
    const operation = Promise.resolve(requested).then(result => {
      if (token !== generation || !enabled) return snapshot();
      permission = result === 'granted' || result === 'not-required' || result === 'denied' ? result : 'error';
      if (permission === 'denied') return fail('denied', 'Motion permission was denied. Use manual exploration or enable motion in browser settings.');
      if (!granted(permission)) return fail('error', 'Motion permission could not be obtained. Retry Auto AR from its button.');
      return attach(token);
    }, error => {
      if (token !== generation || !enabled) return snapshot();
      permission = 'error';
      return fail('error', `Motion permission failed: ${error?.message || 'unknown error'}`);
    });
    pending = operation;
    operation.then(() => { if (pending === operation) pending = null; }, () => { if (pending === operation) pending = null; });
    return operation;
  }
  function stop() {
    generation++; pending = null; release(); resetSamples(); enabled = false;
    publish('off');
    return snapshot();
  }
  function suspend() {
    if (!enabled) return snapshot();
    generation++; pending = null; release(); resetSamples();
    publish('paused', granted(permission) ? 'Auto AR paused while the page is hidden.' :
      'Auto AR paused before permission completed. Enable Auto AR again to request motion.');
    return snapshot();
  }
  function resume() {
    if (!enabled || status !== 'paused') return snapshot();
    if (!granted(permission)) return snapshot(); // never prompt outside a user gesture
    let supported;
    try { supported = isSupported(); } catch { supported = false; }
    if (!supported) return fail('unsupported', 'Orientation is no longer available. Manual exploration is available.');
    generation++; resetSamples();
    return attach(generation);
  }
  return { start, stop, suspend, resume, get state() { return snapshot(); } };
}
