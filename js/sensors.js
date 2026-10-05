// Browser hardware adapters. Streams never leave the device; callers own lifecycle.
export function motionPermissionNeeded() {
  return typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
}

// Invoke directly inside a click handler, before awaiting any other permission.
export async function requestMotionPermission() {
  if (!motionPermissionNeeded()) return 'not-required';
  try { return await DeviceOrientationEvent.requestPermission(true); } catch { return 'error'; }
}

export function startOrientation(cb) {
  let latest = null, lastAbsoluteAt = -Infinity, stopped = false;
  const orient = () => globalThis.screen?.orientation?.angle ?? window.orientation ?? 0;
  const receive = (event, absoluteEvent = false) => {
    if (stopped || ![event.alpha, event.beta, event.gamma].every(Number.isFinite)) return;
    const receivedAt = performance.now();
    const compassHeading = Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0
      && !(Number.isFinite(event.webkitCompassAccuracy) && event.webkitCompassAccuracy < 0)
      ? event.webkitCompassHeading : null;
    const absolute = absoluteEvent || event.absolute === true;
    if (absolute) lastAbsoluteAt = receivedAt;
    else if (compassHeading == null && receivedAt - lastAbsoluteAt < 1500) return;
    latest = {
      alpha: event.alpha, beta: event.beta, gamma: event.gamma, orient: orient(),
      absolute, compassHeading,
      compassAcc: Number.isFinite(event.webkitCompassAccuracy) ? event.webkitCompassAccuracy : null,
      headingSource: compassHeading != null ? 'magnetic-compass' : absolute ? 'absolute-sensor' : 'relative',
      receivedAt,
    };
    cb(latest);
  };
  const onAbsolute = (event) => receive(event, true);
  const onRelative = (event) => receive(event);
  window.addEventListener('deviceorientationabsolute', onAbsolute, true);
  window.addEventListener('deviceorientation', onRelative, true);
  return {
    latest: () => latest,
    stop() {
      stopped = true; latest = null;
      window.removeEventListener('deviceorientationabsolute', onAbsolute, true);
      window.removeEventListener('deviceorientation', onRelative, true);
    },
  };
}

export function getLocation(timeoutMs = 9000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(Number.isFinite(p.coords.latitude) && Number.isFinite(p.coords.longitude)
        && Math.abs(p.coords.latitude) <= 90 && Math.abs(p.coords.longitude) <= 180
        ? { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, source: 'gps',
          ...(Number.isFinite(p.coords.altitude) && p.coords.altitude >= -500 && p.coords.altitude <= 10000 ? { heightM: p.coords.altitude } : {}),
          ...(Number.isFinite(p.coords.altitudeAccuracy) && p.coords.altitudeAccuracy >= 0 ? { heightAccuracyM: p.coords.altitudeAccuracy } : {}) } : null),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

const cameraRequests = new WeakMap();
export function stopCamera(videoEl) {
  cameraRequests.delete(videoEl);
  const stream = videoEl.srcObject;
  stream?.getTracks().forEach((track) => track.stop());
  videoEl.srcObject = null;
  videoEl.pause?.();
}

// Calls can overlap after a slow permission prompt. Only the newest call may attach video.
export async function startCamera(videoEl, { onEnded } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'unsupported' };
  const request = {};
  stopCamera(videoEl);
  cameraRequests.set(videoEl, request);
  let stream;
  const release = () => {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoEl.srcObject === stream) { videoEl.srcObject = null; videoEl.pause?.(); }
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
    });
    if (cameraRequests.get(videoEl) !== request) { release(); return { ok: false, reason: 'cancelled' }; }
    videoEl.srcObject = stream;
    await videoEl.play();
    if (cameraRequests.get(videoEl) !== request) { release(); return { ok: false, reason: 'cancelled' }; }
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState === 'ended') { release(); return { ok: false, reason: 'ended' }; }
    const settings = track.getSettings?.() || {};
    let stopped = false;
    const ended = () => { stop(); onEnded?.(); };
    function stop() {
      if (stopped) return;
      stopped = true;
      stream.getTracks().forEach((t) => t.removeEventListener?.('ended', ended));
      release();
    }
    stream.getTracks().forEach((t) => t.addEventListener?.('ended', ended, { once: true }));
    return { ok: true, stream, settings, facingMode: settings.facingMode || 'unknown', stop };
  } catch (error) {
    release();
    return { ok: false, reason: error?.name || 'error' };
  }
}

// Invalidates a pending permission result as well as an attached stream.
export function cancelCamera(videoEl) {
  cameraRequests.delete(videoEl);
  stopCamera(videoEl);
}

export function secureContextOK() { return window.isSecureContext !== false; }
