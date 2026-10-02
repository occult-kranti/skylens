// main.js — bootstrap, state store, rAF render loop, schedulers, gestures.
import * as X from './astro.js';
import { loadStars, visibleStars, computeBodies, sunAltitude, starCount } from './sky.js';
import { initSatellites, propagateNow, satMeta } from './satellites.js';
import { startPlanes } from './planes.js';
import * as S from './sensors.js';
import { createRenderer, PALETTES } from './render.js';
import { createUI } from './ui.js';

const $ = (id) => document.getElementById(id);
const qp = new URLSearchParams(location.search);
const FALLBACK_LOC = { lat: 40.7128, lon: -74.006, source: 'default (NYC)' };

const state = {
  loc: qp.has('lat') && qp.has('lon') ? { lat: +qp.get('lat'), lon: +qp.get('lon'), source: 'url' } : null,
  mode: 'manual',            // 'ar' | 'ar-rel' | 'manual'
  fov: Math.min(100, Math.max(30, +(qp.get('fov') || 60))),
  magLimit: 4.6,
  layers: { grid: true, labels: true, sats: true, planes: true },
  night: false,
  az: 200, alt: 30,          // manual aim
  sensor: null,
  bodies: [], sats: [], planes: [], planeStatus: 'off', planeAge: 0,
  tleMeta: null,
};

const canvas = $('sky'), video = $('cam');
const renderer = createRenderer(canvas);
const ui = createUI({ relocate });

const loc = () => state.loc || FALLBACK_LOC;

async function relocate() {
  const g = await S.getLocation();
  if (g) { state.loc = g; ui.toast(`location: ${g.lat.toFixed(3)}, ${g.lon.toFixed(3)}`); }
  else ui.toast('location unavailable — set it manually in Settings');
}

function applySettings(patch) {
  Object.assign(state, patch);
  if (patch.night !== undefined) document.body.classList.toggle('night', state.night);
}

/* ---------------- onboarding & sensors ---------------- */

async function boot() {
  if (!S.secureContextOK()) ui.toast('HTTPS is required for camera & motion sensors', 6000);

  try { await loadStars(); } catch { ui.toast('star catalog failed to load', 5000); }

  if (!qp.has('manual') && !qp.has('nointro')) {
    const choice = await ui.onboarding();
    if (choice === 'ar') await enableAR();
    else ui.toast('Manual mode — drag the sky to look around');
  } else if (qp.get('ar') === '1') await enableAR();

  relocate();

  // satellites: load TLEs, then propagate at 1 Hz
  state.tleMeta = await initSatellites();
  feedDot('tle', state.tleMeta.source === 'none' ? 'err' : state.tleMeta.stale ? 'warn' : 'ok',
    `TLE source: ${state.tleMeta.source}`);
  setInterval(() => { state.sats = propagateNow(new Date(), loc().lat, loc().lon); }, 1000);

  // planes: 12 s poller with backoff
  startPlanes(loc, (u) => {
    state.planeStatus = u.status;
    state.planeAge = u.ageMs;
    if (u.planes) state.planes = u.planes;
    feedDot('adsb', u.status === 'ok' ? 'ok' : u.status === 'limited' ? 'warn' : 'err', `ADS-B: ${u.status}`);
  });

  // planets/sun/moon at 1 Hz (VSOP is too heavy for per-frame)
  setInterval(() => { state.bodies = computeBodies(new Date(), loc().lat, loc().lon); }, 1000);

  // time-adaptive chrome every minute
  const sunTheme = () => {
    const a = sunAltitude(new Date(), loc().lat, loc().lon);
    document.body.dataset.sun = a > 0 ? 'day' : a > -6 ? 'dusk' : 'night';
  };
  sunTheme(); setInterval(sunTheme, 60000);

  bindGestures();
  ui.bindSettings(state, applySettings);
  requestAnimationFrame(frame);
}

async function enableAR() {
  const perm = await S.requestMotionPermission();
  if (perm === 'granted' || perm === 'not-required') {
    S.startOrientation((smp) => {
      state.sensor = smp;
      state.mode = smp.absolute ? 'ar' : 'ar-rel';
      feedDot('motion', smp.absolute ? 'ok' : 'warn', smp.absolute ? 'absolute orientation' : 'relative orientation (no compass abs)');
      if (smp.compassAcc != null && smp.compassAcc > 20) ui.toast('compass accuracy low — wave phone in a figure-8', 4000);
    });
  } else {
    feedDot('motion', 'err', 'motion permission denied');
    ui.toast('motion sensors unavailable — drag to look around', 4000);
  }
  const cam = await S.startCamera(video);
  if (cam.ok) { document.body.classList.add('camera-on'); feedDot('cam', 'ok', 'camera on'); }
  else { feedDot('cam', 'err', 'camera: ' + cam.reason); ui.toast('camera unavailable — sky overlay still works', 4000); }
}

/* ---------------- gestures ---------------- */

function bindGestures() {
  let down = null, moved = 0, t0 = 0;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; moved = 0; t0 = performance.now(); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down[0], dy = e.clientY - down[1];
    moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    if (state.mode === 'manual' || !state.sensor) {
      const tanH = Math.tan((state.fov / 2) * X.D2R);
      const vfov = 2 * Math.atan(tanH * canvas.clientHeight / canvas.clientWidth) * X.R2D;
      state.az = X.norm360(state.az - (dx / canvas.clientWidth) * state.fov);
      state.alt = X.clamp(state.alt + (dy / canvas.clientHeight) * vfov, -89, 89);
      down = [e.clientX, e.clientY];
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasTap = down && moved < 6 && performance.now() - t0 < 400;
    down = null;
    if (wasTap) ui.showInfo(renderer.hitTest(e.clientX, e.clientY));
  });
  window.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === 'ArrowLeft') state.az = X.norm360(state.az - step);
    else if (e.key === 'ArrowRight') state.az = X.norm360(state.az + step);
    else if (e.key === 'ArrowUp') state.alt = X.clamp(state.alt + step, -89, 89);
    else if (e.key === 'ArrowDown') state.alt = X.clamp(state.alt - step, -89, 89);
  });
}

/* ---------------- feed dots ---------------- */

function feedDot(which, st, title) { ui.statusDot(which, st, title); }

/* ---------------- render loop ---------------- */

let lastTelemetry = 0, lastLists = 0;

function frame() {
  const now = new Date();
  const l = loc();

  // attitude → basis
  let az = state.az, alt = state.alt, basis;
  if ((state.mode === 'ar' || state.mode === 'ar-rel') && state.sensor) {
    const s = state.sensor;
    const att = X.attitudeFromSensors(s.alpha, s.beta, s.gamma, s.orient);
    basis = att; az = s.compassHeading ?? att.az; alt = att.alt;
  } else {
    basis = X.makeBasis(state.az, state.alt);
  }

  const tanH = Math.tan((state.fov / 2) * X.D2R);
  const w = renderer.width, h = renderer.height;
  const stars = visibleStars(now, l.lat, l.lon, state.magLimit);

  renderer.draw({
    basis, tanH, tanV: tanH * (h / w),
    stars, bodies: state.bodies, sats: state.sats, planes: state.planes,
    layers: state.layers, palette: state.night ? PALETTES.night : PALETTES.normal,
    centerAz: az,
  });

  if (now - lastTelemetry > 250) {
    lastTelemetry = now;
    const counts = `${stars.length} ST · ${state.sats.length} SAT · ${state.planes.length} AC`;
    ui.telemetry({ loc: state.loc, az, alt, counts });
    ui.compassTape(az);
  }
  if (now - lastLists > 1000) {
    lastLists = now;
    const named = stars.filter((s) => s.name && s.alt > 0).sort((a, b) => a.mag - b.mag).slice(0, 8);
    ui.skyList(state.bodies.filter((b) => b.alt > -6), named);
    ui.satList(state.sats, state.tleMeta);
    ui.planeList(state.planes, state.planeStatus, state.planeAge);
  }
  requestAnimationFrame(frame);
}

boot();
