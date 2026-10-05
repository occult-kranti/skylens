// Application coordination: owned lifecycles, one observer/time, slow sky and fast projection.
import * as X from './astro.js';
import { loadStars, visibleStars, computeBodies, engineReady } from './sky.js';
import { loadConstellations, loadDSOs, constellationFrame, dsoFrame } from './objects.js';
import { sunEvents, moonEvents, planetEvents, activeShowers } from './events.js';
import { initSatellites, propagateNow, satMeta } from './satellites.js';
import { startPlanes } from './planes.js';
import * as S from './sensors.js';
import { createRenderer, PALETTES } from './render.js';
import { createUI } from './ui.js';
import { displayName, searchNames, NAME_MODES } from './names.js';
import { calculateObjectEvents } from './observing.js';

const PREFS_KEY = 'skylens.preferences.v2';
const DEMO_LOC = { lat: 40.7128, lon: -74.006, source: 'demo (New York)' };
const DEFAULT_LAYERS = { grid: true, labels: true, stars: true, bodies: true, constellations: true, dsos: true, sats: false, planes: false };
export function validLocation(loc) {
  return !!loc && Number.isFinite(loc.lat) && Math.abs(loc.lat) <= 90 && Number.isFinite(loc.lon) && Math.abs(loc.lon) <= 180;
}
export function normalizeSavedLocations(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap(item => {
    if (!item || !validLocation(item) || typeof item.id !== 'string' || !/^place:[\w-]{1,80}$/.test(item.id) || seen.has(item.id)) return [];
    const name = typeof item.name === 'string' ? item.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) : '';
    if (!name) return [];
    seen.add(item.id);
    return [{ id: item.id, name, lat: item.lat, lon: item.lon }];
  }).slice(0, 12);
}
export function addSavedLocation(locations, name, loc, id) {
  const list = normalizeSavedLocations(locations);
  const clean = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
  if (!clean || clean.length > 40) return { ok: false, message: 'Enter a location name of 1–40 characters.' };
  if (!validLocation(loc)) return { ok: false, message: 'Choose valid coordinates before saving.' };
  if (list.some(item => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) return { ok: false, message: 'That name is already saved. Choose a different name.' };
  if (list.length >= 12) return { ok: false, message: 'Twelve locations are saved. Remove one before adding another.' };
  const next = normalizeSavedLocations([...list, { id, name: clean, lat: loc.lat, lon: loc.lon }]);
  if (next.length !== list.length + 1) return { ok: false, message: 'The location could not be saved. Try again.' };
  return { ok: true, locations: next, message: `${clean} saved on this device.` };
}
export function parseSimulationTime(value) {
  if (value == null || value === '' || value === 'now') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)) throw new Error('Enter a UTC date and time.');
  const explicit = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + 'Z';
  const date = new Date(explicit);
  const calendarPart = explicit.slice(0, 10), midnight = new Date(calendarPart + 'T00:00:00Z');
  const clock = value.slice(11, 19).split(':').map(Number);
  if (clock[0] > 23 || clock[1] > 59 || (clock[2] ?? 0) > 59 || !Number.isFinite(date.getTime()) || !Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== calendarPart ||
      date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) throw new Error('Use a valid date from 1900 to 2100.');
  return date.toISOString();
}
export function normalizePreferences(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const finite = (v, fallback, min, max) => Number.isFinite(v) ? X.clamp(v, min, max) : fallback;
  const layers = { ...DEFAULT_LAYERS };
  for (const key of Object.keys(layers)) if (typeof raw.layers?.[key] === 'boolean') layers[key] = raw.layers[key];
  let selectedTime = null;
  try { selectedTime = parseSimulationTime(raw.selectedTime); } catch { /* corrupt saved time -> live */ }
  return { loc: validLocation(raw.loc) ? { ...raw.loc } : { ...DEMO_LOC },
    nameMode: NAME_MODES.includes(raw.nameMode) ? raw.nameMode : 'bilingual',
    savedLocations: normalizeSavedLocations(raw.savedLocations),
    fov: finite(raw.fov, 70, 30, 120), magLimit: finite(raw.magLimit, 4.6, 2, 4.6),
    headingOffset: finite(raw.headingOffset, 0, -180, 180), pitchOffset: finite(raw.pitchOffset, 0, -45, 45),
    night: raw.night === true, refraction: raw.refraction === true, layers, selectedTime,
    favourites: Array.isArray(raw.favourites) ? [...new Set(raw.favourites.filter(x => typeof x === 'string' && /^(star|body|dso):/.test(x)))].slice(0, 200) : [] };
}
export function readPreferences(storage) {
  try { return normalizePreferences(JSON.parse(storage?.getItem(PREFS_KEY) || '{}')); }
  catch { return normalizePreferences(); }
}
export function searchCatalogue(objects, query, favourites = []) {
  const q = String(query || '').trim().toLocaleLowerCase();
  return objects.filter(o => o.name && (!q || searchNames(o, q) || [o.altName, o.kind].some(x => String(x || '').toLocaleLowerCase().includes(q))))
    .sort((a, b) => Number(favourites.includes(b.id)) - Number(favourites.includes(a.id)) ||
      Number(b.alt >= 0) - Number(a.alt >= 0) || (a.mag ?? 99) - (b.mag ?? 99) || a.name.localeCompare(b.name))
    .slice(0, 50).map(o => ({ ...o, belowHorizon: o.alt < 0, favourite: favourites.includes(o.id) }));
}

// The cache key includes observer, visibility controls and the integral simulated second.
// Viewport changes never invalidate the astronomical snapshot.
export function createSkyCache(compute) {
  let key = null, snapshot = null;
  return { get(date, loc, settings, force = false) {
    const nextKey = [Math.floor(date.getTime() / 1000), loc.lat, loc.lon, settings.magLimit, settings.refraction].join('|');
    if (force || nextKey !== key) { snapshot = compute(date, loc, settings); key = nextKey; }
    return snapshot;
  }, clear() { key = null; } };
}

// A reduced-motion cap must still draw its first frame, including timestamp zero.
// null means no frame has rendered yet (also after returning from a hidden tab).
export function shouldRenderFrame(timestamp, previousFrame, reducedMotion) {
  return previousFrame == null || !reducedMotion || timestamp - previousFrame >= 32;
}

export function createApplication() {
  const $ = id => document.getElementById(id), qp = new URLSearchParams(location.search);
  let storage = null;
  try { storage = localStorage; } catch { /* storage blocked */ }
  const prefs = readPreferences(storage);
  // A previous session never silently resumes external aircraft location sharing.
  prefs.layers.planes = false;
  if (qp.has('lat') && qp.has('lon')) {
    const urlLoc = { lat: Number(qp.get('lat')), lon: Number(qp.get('lon')), source: 'URL' };
    if (qp.get('lat')?.trim() && qp.get('lon')?.trim() && validLocation(urlLoc)) prefs.loc = urlLoc;
  }
  if (qp.has('fov') && Number.isFinite(Number(qp.get('fov')))) prefs.fov = X.clamp(Number(qp.get('fov')), 30, 120);
  const state = { ...prefs, mode: 'manual', az: 200, alt: 30, sensor: null,
    bodies: [], sats: [], planes: [], planeStatus: 'off', planeAge: null, tleMeta: null,
    highlight: null, selectedId: null, cameraStatus: 'off', savedObjects: [] };
  const canvas = $('sky'), video = $('cam'), renderer = createRenderer(canvas);
  let cameraSession = null, orientation = null, cameraToken = 0, cameraStarting = false;
  let animation = null, clockTimer = null, aircraft = null, satelliteController = null, satelliteReady = false;
  let engine = null, snapshot = { stars: [], renderStars: [], visibleCount: 0, constellations: [], dsos: [], renderDSOs: [], bodies: [], catalogue: [] };
  let smoothed = null, previousFrame = null, lastTelemetry = 0, lastMessage = '', lastEventsKey = '', query = '';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ui = createUI({ relocate, locate, startCamera: enableCamera, stopCamera: () => stopCamera('off'),
    setTime, search, toggleFavourite, saveLocation, useLocation, removeLocation, objectEvents });
  const observingCache = new Map();
  const dateNow = () => state.selectedTime ? new Date(state.selectedTime) : new Date();
  const cache = createSkyCache((date, loc, settings) => {
    const stars = visibleStars(date, loc.lat, loc.lon, 4.6, -90, settings.refraction);
    const dsos = dsoFrame(date, loc.lat, loc.lon, Infinity, -90, settings.refraction);
    const bodies = computeBodies(date, loc.lat, loc.lon, settings.refraction);
    return { stars, dsos, bodies,
      renderStars: stars.filter(s => s.mag <= settings.magLimit && s.alt > -6),
      visibleCount: stars.filter(s => s.mag <= settings.magLimit && s.alt > 0).length,
      renderDSOs: dsos.filter(d => d.alt > -4 && (d.mag == null || d.mag <= 10)),
      constellations: constellationFrame(date, loc.lat, loc.lon, settings.refraction),
      catalogue: [...bodies, ...stars.filter(s => s.name), ...dsos] };
  });

  function persist() {
    try {
      if (!storage) return false;
      storage.setItem(PREFS_KEY, JSON.stringify(normalizePreferences(state)));
      return true;
    } catch { return false; }
  }
  function saveLocation(name) {
    const id = `place:${globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)}`;
    const result = addSavedLocation(state.savedLocations, name, state.loc, id);
    if (!result.ok) return result;
    state.savedLocations = result.locations;
    const stored = persist(); updateSaved();
    return { ok: true, message: stored ? result.message : 'Saved for this session only. Browser storage is unavailable.' };
  }
  function useLocation(id) {
    const loc = state.savedLocations.find(item => item.id === id);
    if (!loc) return { ok: false, message: 'That saved location is unavailable.' };
    applySettings({ loc: { lat: loc.lat, lon: loc.lon, name: loc.name, source: 'saved' } });
    ui.toast(`Using ${loc.name}.`);
    return { ok: true, message: `Using ${loc.name}.` };
  }
  function removeLocation(id) {
    const before = state.savedLocations.length;
    state.savedLocations = state.savedLocations.filter(item => item.id !== id);
    if (before === state.savedLocations.length) return { ok: false, message: 'That saved location is unavailable.' };
    const stored = persist(); updateSaved();
    return { ok: true, message: stored ? 'Saved location removed.' : 'Removed for this session only. Browser storage is unavailable.' };
  }
  async function objectEvents(item) {
    const date = dateNow(), loc = { ...state.loc };
    const source = snapshot.catalogue.find(o => o.id === item.id) || item;
    // A rise/set can cross "now" within a single minute. Reuse only the exact
    // selected instant so a cached event can never become a past "next" event.
    const key = [source.id || source.name, date.getTime(), loc.lat, loc.lon].join('|');
    if (observingCache.has(key)) return observingCache.get(key);
    const ae = engine || await engineReady;
    if (!ae) return { error: 'The astronomy engine is unavailable.', note: 'Reload to retry.' };
    const result = calculateObjectEvents(ae, source, date, loc);
    if (observingCache.size >= 32) observingCache.delete(observingCache.keys().next().value);
    observingCache.set(key, result);
    return result;
  }
  function updateSaved() {
    state.savedObjects = snapshot.catalogue.filter(o => state.favourites.includes(o.id));
    ui.saved?.(state);
  }
  function search(value) { query = String(value || ''); return searchCatalogue(snapshot.catalogue, query, state.favourites); }
  function locate(target) {
    if (!target) { state.highlight = null; state.selectedId = null; return; }
    if (!target || !Number.isFinite(target.alt) || !Number.isFinite(target.az)) return;
    const known = snapshot.catalogue.find(o => o.id === target.id || o.name === (target.label || target.name));
    state.selectedId = known?.id || null;
    state.highlight = { ...target, label: target.name || target.label || 'Selected object' };
    if (state.mode === 'manual') { state.az = target.az; state.alt = X.clamp(target.alt, -89, 89); }
    const title = displayName(state.highlight, state.nameMode);
    ui.toast(target.alt < 0 ? `${title} is below the horizon.` : `Guiding to ${title}.`);
  }
  function toggleFavourite(item) {
    const id = typeof item === 'string' ? item : item?.id;
    if (!id || !/^(star|body|dso):/.test(id)) return false;
    const has = state.favourites.includes(id);
    state.favourites = has ? state.favourites.filter(x => x !== id) : [...state.favourites, id].slice(-200);
    persist(); updateSaved(); ui.searchResults?.(search(query));
    return !has;
  }
  function setTime(value) {
    try {
      state.selectedTime = parseSimulationTime(value); persist(); refreshSky(true); syncFeeds();
      ui.toast(state.selectedTime ? 'Simulated UTC time. Camera still shows the present.' : 'Returned to the live sky.');
      return state.selectedTime;
    } catch (e) { ui.toast(e.message, 5000); return false; }
  }
  function applySettings(patch) {
    if (patch.loc && !validLocation(patch.loc)) { ui.toast('Enter valid latitude and longitude.'); return; }
    if ('selectedTime' in patch) { setTime(patch.selectedTime); delete patch.selectedTime; }
    const next = normalizePreferences({ ...state, ...patch });
    Object.assign(state, next);
    document.body.classList.toggle('night', state.night);
    smoothed = null; persist();
    if (patch.loc || 'magLimit' in patch || 'refraction' in patch) refreshSky(true);
    ui.syncSettings?.(state);
    if ('nameMode' in patch) { lastEventsKey = ''; refreshSky(); }
    if (patch.loc && aircraft) { aircraft.stop(); aircraft = null; state.planes = []; }
    syncFeeds();
  }
  async function relocate() {
    ui.toast('Requesting your location…');
    const loc = await S.getLocation();
    if (validLocation(loc)) applySettings({ loc });
    else ui.toast('Location unavailable. Enter coordinates in Settings; the demo location remains labelled.', 6000);
  }
  function cameraStatus(status, message) {
    state.cameraStatus = status;
    if (status + message !== lastMessage) { ui.cameraState?.({ status, message }); lastMessage = status + message; }
  }
  function stopCamera(status = 'off', message = '') {
    cameraToken++; cameraStarting = false;
    orientation?.stop(); orientation = null;
    cameraSession?.stop(); cameraSession = null; S.stopCamera(video);
    state.sensor = null; state.mode = 'manual'; smoothed = null;
    document.body.classList.remove('camera-on');
    ui.statusDot('cam', 'off', 'Camera off'); ui.statusDot('motion', 'off', 'Motion stopped');
    cameraStatus(status, message || (status === 'paused' ? 'Camera paused in background. Tap Open camera to resume.' : 'Explore by dragging, or open the camera.'));
  }
  function enableCamera() {
    if (cameraStarting) return;
    stopCamera('off');
    // This call must stay synchronous within the UI click: iOS consumes transient activation.
    const permission = S.requestMotionPermission();
    const token = ++cameraToken; cameraStarting = true;
    cameraStatus('starting', 'Allow motion and camera when prompted. Camera frames stay on this device.');
    (async () => {
      const result = await permission;
      if (token !== cameraToken || document.hidden) return;
      const session = await S.startCamera(video, { onEnded: () => stopCamera('error', 'Camera access ended. Tap Open camera to retry.') });
      if (token !== cameraToken || document.hidden) { session.stop?.(); return; }
      cameraStarting = false;
      if (!session.ok) { stopCamera('error', `Camera unavailable (${session.reason}). Manual exploration remains available.`); return; }
      cameraSession = session;
      document.body.classList.add('camera-on'); ui.statusDot('cam', 'ok', 'Camera on; frames stay local');
      if (result === 'granted' || result === 'not-required') {
        orientation = S.startOrientation(sample => {
          if (token !== cameraToken) return;
          state.sensor = sample; state.mode = sample.absolute ? 'ar' : 'ar-rel';
          ui.statusDot('motion', sample.absolute ? 'ok' : 'warn', sample.headingSource || 'Orientation received');
        });
      } else ui.statusDot('motion', 'err', 'Motion permission denied');
      cameraStatus('on', session.facingMode === 'user' ? 'Front camera, unmirrored. Calibrate alignment in Settings.' : 'Camera on. Move the phone; use Settings to correct alignment.');
    })().catch(e => { if (token === cameraToken) stopCamera('error', `Camera could not start: ${e.message || 'unknown error'}`); });
  }

  function syncFeeds() {
    const active = !document.hidden;
    const shareAircraft = active && state.layers.planes && !state.selectedTime && !state.loc.source?.startsWith('demo');
    if (!shareAircraft && aircraft) { aircraft.stop(); aircraft = null; state.planes = []; state.planeStatus = 'off'; }
    if (shareAircraft && !aircraft) {
      aircraft = startPlanes(() => state.loc, update => {
        state.planeStatus = update.status; state.planeAge = update.ageMs; state.planes = update.planes || [];
        ui.statusDot('adsb', update.status === 'ok' ? 'ok' : 'warn', `Aircraft: ${update.status}`);
      });
    }
    if (state.layers.planes && !shareAircraft) {
      state.planeStatus = state.selectedTime ? 'simulated' : state.loc.source?.startsWith('demo') ? 'location-needed' : 'off';
    }
    if ((!active || !state.layers.sats) && satelliteController) { satelliteController.abort(); satelliteController = null; }
    if (active && state.layers.sats && !satelliteReady && !satelliteController) {
      const controller = satelliteController = new AbortController();
      // Remote data never blocks controls, stars, camera or the animation loop.
      initSatellites({ signal: controller.signal }).then(meta => {
        if (controller.signal.aborted) return;
        state.tleMeta = meta; satelliteReady = true;
        ui.statusDot('tle', meta.source === 'none' ? 'err' : meta.stale ? 'warn' : 'ok', `Satellite data: ${meta.source}`);
      }).catch(() => ui.statusDot('tle', 'err', 'Satellite data unavailable'))
        .finally(() => { if (satelliteController === controller) satelliteController = null; });
    }
  }
  function refreshSky(force = false) {
    if (document.hidden) return;
    const date = dateNow();
    snapshot = cache.get(date, state.loc, state, force); state.bodies = snapshot.bodies;
    if (state.selectedId) {
      const selected = snapshot.catalogue.find(o => o.id === state.selectedId);
      if (selected) state.highlight = { ...selected, label: selected.name };
    }
    if (state.layers.sats && satelliteReady) {
      try { state.sats = propagateNow(date, state.loc.lat, state.loc.lon); state.tleMeta = satMeta(); }
      catch { state.sats = []; }
    } else state.sats = [];
    const sun = snapshot.bodies.find(b => b.kind === 'sun');
    document.body.dataset.sun = (sun?.alt ?? -30) > 0 ? 'day' : (sun?.alt ?? -30) > -6 ? 'dusk' : 'night';
    ui.skyList(snapshot.bodies.filter(b => b.alt > -6), snapshot.stars.filter(s => s.name && s.alt > 0).slice(0, 8));
    ui.satList(state.sats, state.tleMeta); ui.planeList(state.planes, state.planeStatus, state.planeAge);
    ui.searchResults?.(search(query)); updateSaved();
    const eventKey = [state.selectedTime || Math.floor(date.getTime() / 60000), state.loc.lat, state.loc.lon, state.nameMode].join('|');
    if (engine && eventKey !== lastEventsKey) {
      lastEventsKey = eventKey;
      try {
        ui.tonight({ sun: sunEvents(engine, date, state.loc.lat, state.loc.lon), moon: moonEvents(engine, date),
          planets: planetEvents(engine, date, state.loc.lat, state.loc.lon), showers: activeShowers(date, state.loc.lat, state.loc.lon), date });
        ui.orbit?.(date, engine);
      } catch { ui.toast('Observing events unavailable for these inputs.'); }
    }
  }

  function frame(timestamp) {
    if (document.hidden) { animation = null; return; }
    animation = requestAnimationFrame(frame);
    if (!shouldRenderFrame(timestamp, previousFrame, reducedMotion.matches)) return;
    const delta = previousFrame == null ? 16 : timestamp - previousFrame;
    previousFrame = timestamp;
    let basis, az = state.az, alt = state.alt;
    if (state.sensor && cameraSession) {
      const target = X.correctedAttitude(state.sensor, { headingOffset: state.headingOffset, pitchOffset: state.pitchOffset,
        frontCamera: cameraSession.facingMode === 'user' });
      smoothed = X.smoothAttitude(smoothed, target, delta);
      basis = smoothed; az = basis.az; alt = basis.alt;
      state.az = az; state.alt = X.clamp(alt, -89, 89);
      const sampleAge = performance.now() - state.sensor.receivedAt;
      const quality = sampleAge > 3000 ? 'No recent motion update — move the phone to check.' :
        state.sensor.compassAcc > 20 ? 'Compass uncertainty is high. Correct alignment in Settings.' :
        state.sensor.headingSource === 'magnetic-compass' ? 'Magnetic compass; use north correction in Settings.' :
        state.sensor.absolute ? 'Sensor heading; true north is not independently verified.' : 'Relative motion only — align a known object in Settings.';
      cameraStatus('on', quality + (state.selectedTime ? ' Simulated sky over present camera.' : ''));
    } else {
      basis = X.makeBasis(az, alt);
      if (cameraSession && !cameraStarting) cameraStatus('on', 'Camera on; no motion sample. Drag to align manually or retry motion permission.');
    }
    const w = renderer.width, h = renderer.height;
    const fov = X.cameraFov(state.fov, w, h, cameraSession ? video.videoWidth : w, cameraSession ? video.videoHeight : h);
    renderer.draw({ basis, ...fov, stars: snapshot.renderStars,
      bodies: state.bodies, sats: state.sats, planes: state.planes,
      constellations: state.layers.constellations ? snapshot.constellations : null,
      dsos: state.layers.dsos ? snapshot.renderDSOs : null,
      highlight: state.highlight, layers: state.layers, palette: state.night ? PALETTES.night : PALETTES.normal,
      centerAz: az, centerAlt: alt, horizonOnly: !!cameraSession, reducedMotion: reducedMotion.matches, nameMode: state.nameMode });
    if (timestamp - lastTelemetry > 250) {
      lastTelemetry = timestamp;
      ui.telemetry({ loc: state.loc, az, alt, date: dateNow(), isLive: !state.selectedTime,
        counts: `${snapshot.visibleCount} stars · ${state.sats.length} satellites` });
      ui.compassTape(az);
    }
  }
  function resumeClock() {
    if (document.hidden) return;
    refreshSky(true); syncFeeds();
    if (!clockTimer) clockTimer = setInterval(refreshSky, 1000);
    if (!animation) animation = requestAnimationFrame(frame);
  }
  function suspend() {
    if (cameraSession || cameraStarting || orientation) stopCamera('paused');
    clearInterval(clockTimer); clockTimer = null;
    cancelAnimationFrame(animation); animation = null; previousFrame = null;
    aircraft?.stop(); aircraft = null; state.planes = [];
    satelliteController?.abort(); satelliteController = null;
  }
  const gestureController = new AbortController(), listen = (element, name, fn) => element.addEventListener(name, fn, { signal: gestureController.signal });
  let pointer = null;
  listen(canvas, 'pointerdown', event => {
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, total: 0, at: performance.now() };
    canvas.setPointerCapture(event.pointerId);
  });
  listen(canvas, 'pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer.total += Math.abs(dx) + Math.abs(dy); pointer.x = event.clientX; pointer.y = event.clientY;
    if (state.mode === 'manual') {
      const fov = X.cameraFov(state.fov, canvas.clientWidth, canvas.clientHeight, canvas.clientWidth, canvas.clientHeight);
      state.az = X.norm360(state.az - dx / canvas.clientWidth * 2 * Math.atan(fov.tanH) * X.R2D);
      state.alt = X.clamp(state.alt + dy / canvas.clientHeight * 2 * Math.atan(fov.tanV) * X.R2D, -89, 89);
    }
  });
  listen(canvas, 'pointerup', event => {
    if (pointer?.id === event.pointerId && pointer.total < 6 && performance.now() - pointer.at < 450) {
      const hit = renderer.hitTest(event.clientX, event.clientY);
      ui.showInfo(hit);
      if (!hit) { state.highlight = null; state.selectedId = null; }
    }
    pointer = null;
  });
  listen(canvas, 'pointercancel', () => { pointer = null; });
  listen(canvas, 'keydown', event => {
    if (state.mode !== 'manual' || !event.key.startsWith('Arrow')) return;
    event.preventDefault(); const step = event.shiftKey ? 10 : 3;
    if (event.key === 'ArrowLeft') state.az = X.norm360(state.az - step);
    if (event.key === 'ArrowRight') state.az = X.norm360(state.az + step);
    if (event.key === 'ArrowUp') state.alt = X.clamp(state.alt + step, -89, 89);
    if (event.key === 'ArrowDown') state.alt = X.clamp(state.alt - step, -89, 89);
  });
  listen(document, 'visibilitychange', () => document.hidden ? suspend() : resumeClock());
  listen(window, 'pagehide', suspend);
  listen(window, 'pageshow', resumeClock);
  ui.bindSettings(state, applySettings); ui.bindChips(state, applySettings);
  document.body.classList.toggle('night', state.night);
  cameraStatus('off', 'Open camera to begin. Manual exploration works without permissions.');
  resumeClock();
  Promise.allSettled([loadStars(), loadConstellations(), loadDSOs()]).then(results => {
    if (results.some(r => r.status === 'rejected')) ui.toast('Some sky data could not load. Reload to retry.', 6000);
    refreshSky(true);
  });
  engineReady.then(value => {
    engine = value;
    if (!engine) { ui.toast('Planet engine unavailable. Catalogue positions are approximate.', 6000); ui.tonight(null); }
    refreshSky(true);
  });
  if (qp.has('dock')) ui.setTab(qp.get('dock'));
  if (!qp.has('manual') && !qp.has('nointro')) ui.onboarding();
  return { state, stop() { suspend(); gestureController.abort(); renderer.dispose?.(); } };
}

if (globalThis.document?.getElementById('sky')) createApplication();
