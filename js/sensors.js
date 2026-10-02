// sensors.js — camera, device orientation (absolute → relative fallback, iOS permission),
// geolocation, and manual-mode gesture handling. Every denial path stays usable.

export function motionPermissionNeeded() {
  return typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
}

export async function requestMotionPermission() {
  if (!motionPermissionNeeded()) return 'not-required';
  try { return await DeviceOrientationEvent.requestPermission(); } catch { return 'error'; }
}

// Streams orientation samples to cb. Returns a getter for the freshest sample.
export function startOrientation(cb) {
  let lastAbs = null, lastRel = null, lastAbsAt = 0;
  const orient = () => (screen.orientation && typeof screen.orientation.angle === 'number')
    ? screen.orientation.angle
    : (typeof window.orientation === 'number' ? window.orientation : 0);

  const onAbs = (e) => {
    if (e.alpha == null) return;
    lastAbs = sample(e); lastAbsAt = performance.now();
    cb(lastAbs);
  };
  const onRel = (e) => {
    if (e.alpha == null) return;
    lastRel = sample(e);
    if (performance.now() - lastAbsAt > 1500) cb(lastRel); // use relative only if absolute is silent
  };
  function sample(e) {
    return {
      alpha: e.alpha, beta: e.beta ?? 0, gamma: e.gamma ?? 0, orient: orient(),
      absolute: performance.now() - lastAbsAt <= 1500,
      compassHeading: e.webkitCompassHeading ?? null,
      compassAcc: e.webkitCompassAccuracy ?? null,
    };
  }
  window.addEventListener('deviceorientationabsolute', onAbs, true);
  window.addEventListener('deviceorientation', onRel, true);
  return {
    latest: () => (performance.now() - lastAbsAt <= 1500 ? lastAbs : lastRel),
    stop() {
      window.removeEventListener('deviceorientationabsolute', onAbs, true);
      window.removeEventListener('deviceorientation', onRel, true);
    },
  };
}

export function getLocation(timeoutMs = 9000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, source: 'gps' }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300000 },
    );
  });
}

export async function startCamera(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'unsupported' };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e && e.name ? e.name : 'error' };
  }
}

export function secureContextOK() { return window.isSecureContext !== false; }
