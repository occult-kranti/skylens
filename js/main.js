// Application coordination: owned lifecycles, one observer/time, slow sky and fast projection.
import * as X from './astro.js';
import { loadStars, visibleStars, computeBodies, engineReady } from './sky.js';
import { loadConstellations, loadDSOs, constellationFrame, dsoFrame } from './objects.js';
import { sunEvents, moonEvents, planetEvents, activeShowers } from './events.js';
import { initSatellites, propagateNow, satMeta } from './satellites.js';
import { startPlanes, refreshAircraftPositions, AIRCRAFT_PROVIDERS, DEFAULT_AIRCRAFT_PROVIDER } from './planes.js';
import * as S from './sensors.js';
import { createTrackingController } from './tracking.js';
import { createRenderer, PALETTES } from './render.js';
import { createUI } from './ui.js';
import { displayName, searchNames, NAME_MODES } from './names.js';
import { calculateObjectEvents } from './observing.js';
import { buildSkyHandoff, parseSkyHandoff } from './handoff.js';
import { interpolateDirection, aimingCandidates, selectMovingMarkers } from './nearby.js';

const PREFS_KEY = 'skylens.preferences.v2';
const DEMO_LOC = { lat: 40.7128, lon: -74.006, source: 'demo (New York)' };
const DEFAULT_LAYERS = { grid: true, labels: true, stars: true, bodies: true, constellations: true, dsos: true, sats: false, planes: false };
const SAVABLE_ID = /^(star|body|dso|const|sat):/;
export function validLocation(loc) {
  return !!loc && Number.isFinite(loc.lat) && Math.abs(loc.lat) <= 90 && Number.isFinite(loc.lon) && Math.abs(loc.lon) <= 180;
}
const validHeight = height => Number.isFinite(height) && height >= -500 && height <= 10000;
function observerLocation(loc) {
  const result = validLocation(loc) ? { ...loc } : { ...DEMO_LOC };
  result.source = typeof result.source === 'string' ? result.source : 'manual';
  if (!validHeight(result.heightM)) delete result.heightM;
  if (!(Number.isFinite(result.heightAccuracyM) && result.heightAccuracyM >= 0)) delete result.heightAccuracyM;
  return result;
}
export function normalizeSavedLocations(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap(item => {
    if (!item || !validLocation(item) || typeof item.id !== 'string' || !/^place:[\w-]{1,80}$/.test(item.id) || seen.has(item.id)) return [];
    const name = typeof item.name === 'string' ? item.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) : '';
    if (!name) return [];
    seen.add(item.id);
    return [{ id: item.id, name, lat: item.lat, lon: item.lon,
      ...(validHeight(item.heightM) ? { heightM: item.heightM } : {}) }];
  }).slice(0, 12);
}
export function addSavedLocation(locations, name, loc, id) {
  const list = normalizeSavedLocations(locations);
  const clean = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
  if (!clean || clean.length > 40) return { ok: false, message: 'Enter a location name of 1–40 characters.' };
  if (!validLocation(loc)) return { ok: false, message: 'Choose valid coordinates before saving.' };
  if (list.some(item => item.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) return { ok: false, message: 'That name is already saved. Choose a different name.' };
  if (list.length >= 12) return { ok: false, message: 'Twelve locations are saved. Remove one before adding another.' };
  const next = normalizeSavedLocations([...list, { id, name: clean, lat: loc.lat, lon: loc.lon, heightM: loc.heightM }]);
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
  return { loc: observerLocation(raw.loc),
    aircraftProvider: Object.hasOwn(AIRCRAFT_PROVIDERS, raw.aircraftProvider) ? raw.aircraftProvider : DEFAULT_AIRCRAFT_PROVIDER,
    aircraftRangeNm: [25, 50, 100].includes(raw.aircraftRangeNm) ? raw.aircraftRangeNm : 50,
    satelliteVisibility: raw.satelliteVisibility === 'all' ? 'all' : 'night',
    nameMode: NAME_MODES.includes(raw.nameMode) ? raw.nameMode : 'bilingual',
    savedLocations: normalizeSavedLocations(raw.savedLocations),
    fov: finite(raw.fov, 70, 30, 120), magLimit: finite(raw.magLimit, 4.6, 2, 4.6),
    headingOffset: finite(raw.headingOffset, 0, -180, 180), pitchOffset: finite(raw.pitchOffset, 0, -45, 45),
    night: raw.night === true, refraction: raw.refraction === true, layers, selectedTime,
    favourites: Array.isArray(raw.favourites) ? [...new Set(raw.favourites.filter(x => typeof x === 'string' && SAVABLE_ID.test(x)))].slice(0, 200) : [] };
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

// A deliberate capture, not a stream. Only whitelisted observing context crosses
// applications; browser/device time zone, frames and sensor state never do.
export function captureSkyObservation(state, item = null, now = Date.now()) {
  const at = new Date(state.selectedTime || now);
  at.setUTCMilliseconds(0);
  const object = item?.id ? { id: item.id, name: item.name, kind: item.kind } : null;
  const value = { dateISO: at.toISOString(), lat: state.loc.lat, lon: state.loc.lon,
    mode: state.selectedTime ? 'simulated' : 'current',
    locationSource: state.loc.source?.startsWith('demo') ? 'demo' : 'selected', object, names: state.nameMode };
  // The same validation gates outgoing values and untrusted incoming fragments.
  return parseSkyHandoff(new URL(buildSkyHandoff(value, 'studio')).hash);
}

export function resolveHandoffObject(object, catalogue) {
  if (!object) return null;
  const byId = catalogue.find(row => row.id === object.id && row.kind === object.kind && row.name === object.name);
  if (byId) return byId;
  // Index-based star/figure IDs can move in a future catalogue release. Require
  // one exact canonical-name/category match; never merge Serpens' two parts.
  if (!['star', 'constellation'].includes(object.kind)) return null;
  const byName = catalogue.filter(row => row.kind === object.kind && row.name === object.name);
  return byName.length === 1 ? byName[0] : null;
}

export function createApplication() {
  const $ = id => document.getElementById(id), qp = new URLSearchParams(location.search);
  let storage = null;
  try { storage = localStorage; } catch { /* storage blocked */ }
  const prefs = readPreferences(storage);
  let incomingHandoff = null, handoffError = '';
  try { incomingHandoff = parseSkyHandoff(location.hash); }
  catch (error) { handoffError = error.message; }
  // A previous session never silently resumes external aircraft location sharing.
  prefs.layers.planes = false;
  prefs.layers.sats = false; // fresh visits never start an optional network feed
  if (qp.has('lat') && qp.has('lon')) {
    const urlLoc = { lat: Number(qp.get('lat')), lon: Number(qp.get('lon')), source: 'URL' };
    if (qp.get('lat')?.trim() && qp.get('lon')?.trim() && validLocation(urlLoc)) prefs.loc = urlLoc;
  }
  if (qp.has('fov') && Number.isFinite(Number(qp.get('fov')))) prefs.fov = X.clamp(Number(qp.get('fov')), 30, 120);
  if (incomingHandoff) {
    prefs.loc = { lat: incomingHandoff.lat, lon: incomingHandoff.lon,
      source: incomingHandoff.locationSource === 'demo' ? 'demo (shared snapshot)' : 'shared snapshot' };
    prefs.selectedTime = incomingHandoff.dateISO; // even a captured current sky opens frozen
    prefs.nameMode = incomingHandoff.names;
    prefs.layers.sats = false; // a URL never opts this visit into external feeds
  }
  const state = { ...prefs, mode: 'manual', az: 200, alt: 30, sensor: null,
    bodies: [], sats: [], satelliteCatalogue: [], planes: [], aircraftReports: [], aimingCandidates: [], planeStatus: 'off', planeAge: null, planeInfo: null, tleMeta: null,
    highlight: null, selectedId: null, cameraStatus: 'off', trackingStatus: 'off', trackingRequested: false, savedObjects: [] };
  const canvas = $('sky'), video = $('cam'), renderer = createRenderer(canvas);
  let cameraSession = null, cameraToken = 0, cameraStarting = false, disposed = false;
  let animation = null, clockTimer = null, aircraft = null, aircraftGeneration = 0, satelliteController = null, satelliteReady = false;
  let engine = null, snapshot = { stars: [], renderStars: [], visibleCount: 0, constellations: [], dsos: [], renderDSOs: [], bodies: [], catalogue: [] };
  let smoothed = null, previousFrame = null, lastTelemetry = 0, lastMessage = '', lastTrackingMessage = '', lastEventsKey = '', query = '';
  let catalogueSettled = false, engineSettled = false, pendingHandoffObject = incomingHandoff?.object || null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ui = createUI({ relocate, locate, toggleTracking, startTracking, startCamera: enableCamera, stopCamera: () => stopCamera('off'),
    setTime, search, toggleFavourite, saveLocation, useLocation, removeLocation, objectEvents, refreshSatellites,
    toggleSatellites: () => applySettings({ layers: { ...state.layers, sats: !state.layers.sats } }),
    setAircraftEnabled: enabled => applySettings({ layers: { ...state.layers, planes: enabled === true } }),
    selectNearby: id => {
      const item = [...state.satelliteCatalogue, ...state.aircraftReports].find(row => row.id === id);
      if (item) ui.showInfo(item.id.startsWith('plane:') ? { ...item, kind: 'plane', name: item.flight } : item);
    },
    captureObservation: item => captureSkyObservation(state, item),
    castObservation: record => {
      try { location.assign(buildSkyHandoff(record || captureSkyObservation(state), 'studio')); }
      catch (error) { ui.toast(error.message, 6000); }
    } });
  const tracking = createTrackingController({
    onSample(sample) {
      if (disposed || document.hidden) return;
      state.sensor = sample; state.mode = sample.absolute ? 'ar' : 'ar-rel';
      trackingChanged(tracking.state);
    },
    onState: trackingChanged,
  });
  const observingCache = new Map();
  const dateNow = () => state.selectedTime ? new Date(state.selectedTime) : new Date();
  const cache = createSkyCache((date, loc, settings) => {
    const stars = visibleStars(date, loc.lat, loc.lon, 4.6, -90, settings.refraction);
    const dsos = dsoFrame(date, loc.lat, loc.lon, Infinity, -90, settings.refraction);
    const bodies = computeBodies(date, loc.lat, loc.lon, settings.refraction);
    const constellations = constellationFrame(date, loc.lat, loc.lon, settings.refraction);
    return { stars, dsos, bodies,
      renderStars: stars.filter(s => s.mag <= settings.magLimit && s.alt > -6),
      visibleCount: stars.filter(s => s.mag <= settings.magLimit && s.alt > 0).length,
      renderDSOs: dsos.filter(d => d.alt > -4 && (d.mag == null || d.mag <= 10)),
      constellations,
      catalogue: [...bodies, ...stars.filter(s => s.name), ...dsos, ...constellations] };
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
    applySettings({ loc: { lat: loc.lat, lon: loc.lon, heightM: loc.heightM, name: loc.name, source: 'saved' } });
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
  async function objectEvents(item, observation = null) {
    const date = observation ? new Date(observation.dateISO) : dateNow();
    const loc = observation ? { lat: observation.lat, lon: observation.lon } : { ...state.loc };
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
  function allObjects() { return [...snapshot.catalogue, ...state.satelliteCatalogue, ...state.planes.map(p => ({ ...p, kind: 'plane', name: p.flight }))]; }
  function restoreHandoffSelection() {
    if (!pendingHandoffObject || disposed || document.hidden || !catalogueSettled || !engineSettled) return;
    const object = pendingHandoffObject;
    pendingHandoffObject = null;
    const target = resolveHandoffObject(object, allObjects());
    if (target) {
      locate(target);
      ui.showInfo(target);
    } else ui.handoffStatus(incomingHandoff, `The shared object “${object.name}” is unavailable in the loaded catalogue. The instant, observer and naming preference were restored. Optional feeds remain off.`);
  }
  function updateSaved() {
    state.savedObjects = allObjects().filter(o => state.favourites.includes(o.id));
    ui.saved?.(state);
  }
  function search(value) { query = String(value || ''); return searchCatalogue(allObjects(), query, state.favourites); }
  function locate(target) {
    pendingHandoffObject = null; // a deliberate new target supersedes late import selection
    if (!target) { state.highlight = null; state.selectedId = null; return; }
    if (target.kind === 'plane' || target.id?.startsWith('plane:')) {
      const fresh = state.planes.find(row => row.id === target.id);
      if (!fresh || fresh.overlayEligible === false || Date.now() - fresh.positionAt > 20000) {
        state.highlight = null; state.selectedId = null;
        ui.toast('That aircraft position is too old for sky guidance. Wait for a fresh report.'); return;
      }
      target = fresh;
    }
    if (!target || !Number.isFinite(target.alt) || !Number.isFinite(target.az)) return;
    const known = allObjects().find(o => o.id === target.id || o.name === (target.label || target.name));
    state.selectedId = known?.id || null;
    state.highlight = { ...target, label: target.name || target.label || 'Selected object' };
    if (state.mode === 'manual') { state.az = target.az; state.alt = X.clamp(target.alt, -89, 89); }
    const title = displayName(state.highlight, state.nameMode);
    ui.toast(target.alt < 0 ? `${title} is below the horizon.` : `Guiding to ${title}.`);
  }
  function toggleFavourite(item) {
    const id = typeof item === 'string' ? item : item?.id;
    if (!id || !SAVABLE_ID.test(id)) return false;
    const has = state.favourites.includes(id);
    state.favourites = has ? state.favourites.filter(x => x !== id) : [...state.favourites, id].slice(-200);
    persist(); updateSaved(); ui.searchResults?.(search(query));
    return !has;
  }
  function clearIncomingHandoff() {
    if (!incomingHandoff) return;
    incomingHandoff = null; pendingHandoffObject = null;
    ui.handoffStatus(null);
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* optional URL cleanup */ }
  }
  function setTime(value) {
    try {
      const nextTime = parseSimulationTime(value);
      clearIncomingHandoff(); state.selectedTime = nextTime; persist(); refreshSky(true); syncFeeds();
      ui.toast(state.selectedTime ? 'Simulated UTC time. Camera still shows the present.' : 'Returned to the live sky.');
      return state.selectedTime;
    } catch (e) { ui.toast(e.message, 5000); return false; }
  }
  function applySettings(patch) {
    if (patch.loc && !validLocation(patch.loc)) { ui.toast('Enter valid latitude and longitude.'); return; }
    if (patch.loc) clearIncomingHandoff();
    if ('selectedTime' in patch) { setTime(patch.selectedTime); delete patch.selectedTime; }
    const providerChanged = 'aircraftProvider' in patch && patch.aircraftProvider !== state.aircraftProvider;
    if (providerChanged) patch.layers = { ...(patch.layers || state.layers), planes: false };
    if (patch.loc || providerChanged || 'aircraftRangeNm' in patch) stopAircraft();
    const next = normalizePreferences({ ...state, ...patch });
    Object.assign(state, next);
    document.body.classList.toggle('night', state.night);
    smoothed = null; persist();
    if (patch.loc || 'magLimit' in patch || 'refraction' in patch) refreshSky(true);
    ui.syncSettings?.(state);
    if ('nameMode' in patch) { lastEventsKey = ''; refreshSky(); }
    syncFeeds(); refreshSky();
  }
  async function relocate() {
    ui.toast('Requesting your location…');
    const loc = await S.getLocation();
    if (validLocation(loc)) applySettings({ loc });
    else ui.toast('Location unavailable. Enter coordinates in Settings; the demo location remains labelled.', 6000);
  }
  function trackingChanged(snapshot) {
    state.trackingStatus = snapshot.status; state.trackingRequested = snapshot.enabled;
    // Silence is not evidence the phone levelled itself: retain the full last
    // attitude (including roll) while showing a stale warning. A new session or
    // explicit Manual clears it; stale time is never renewed by screen rotation.
    if (!['tracking', 'stale'].includes(snapshot.status)) { state.sensor = null; state.mode = 'manual'; smoothed = null; }
    else if (snapshot.status === 'stale') state.mode = state.sensor ? 'ar-stale' : 'manual';
    const source = snapshot.headingSource;
    const quality = state.sensor?.compassAcc > 20 ? 'Heading uncertainty is high. Align against a known object.' :
      source === 'magnetic-compass' ? 'Magnetic compass direction. Use Align to correct north.' :
      source === 'absolute-sensor' ? 'Following sensor direction. True north is not independently verified.' :
      'Relative orientation only. Use Align against a known object.';
    const message = snapshot.status === 'tracking' ? quality : snapshot.reason ||
      'Drag or use arrow keys to explore. Auto AR follows the phone with or without camera.';
    const key = [snapshot.status, snapshot.enabled, source, message].join('|');
    if (key !== lastTrackingMessage) {
      lastTrackingMessage = key;
      ui.trackingState?.({ status: snapshot.status, message, active: snapshot.status === 'tracking',
        requested: snapshot.enabled, source });
    }
  }
  function startTracking() {
    if (disposed || document.hidden) return Promise.resolve(tracking.state);
    // The controller invokes browser permission immediately in this gesture.
    return tracking.start();
  }
  function stopTracking() {
    tracking.stop(); state.sensor = null; state.mode = 'manual'; smoothed = null;
  }
  function toggleTracking() {
    if (tracking.state.enabled && tracking.state.status !== 'paused') stopTracking();
    else return startTracking();
  }
  function cameraStatus(status, message) {
    state.cameraStatus = status;
    if (status + message !== lastMessage) { ui.cameraState?.({ status, message }); lastMessage = status + message; }
  }
  function stopCamera(status = 'off', message = '') {
    const wasFront = cameraSession?.facingMode === 'user';
    cameraToken++; cameraStarting = false;
    cameraSession?.stop(); cameraSession = null; S.stopCamera(video);
    // Motion has its own owner. A lens-axis transition must not blend opposite views.
    smoothed = null;
    document.body.classList.remove('camera-on');
    ui.statusDot('cam', 'off', 'Camera off');
    cameraStatus(status, message || (status === 'paused' ? 'Camera paused in background. Tap Enable camera to restart.' :
      wasFront && state.trackingRequested ? 'Camera off. Auto AR now follows the rear-facing direction of the phone.' :
      state.trackingRequested ? 'Camera off. Auto AR continues in the rendered sky.' : 'Rendered sky. Enable camera for a live backdrop.'));
  }
  function enableCamera() {
    if (disposed || document.hidden || cameraStarting) return;
    stopCamera('off');
    // Both requests begin in the user gesture. Motion denial never blocks video,
    // and camera denial never removes a granted orientation listener.
    if (!tracking.state.enabled || tracking.state.status === 'paused') void startTracking();
    const token = ++cameraToken; cameraStarting = true;
    cameraStatus('starting', 'Allow camera access for a live backdrop. Frames stay on this device.');
    (async () => {
      const session = await S.startCamera(video, { onEnded: () => stopCamera('error', 'Camera access ended. Auto AR remains available; tap Retry camera.') });
      if (token !== cameraToken || document.hidden || disposed) { session.stop?.(); return; }
      cameraStarting = false;
      if (!session.ok) { stopCamera('error', `Camera unavailable (${session.reason}). Auto AR and manual exploration remain available.`); return; }
      cameraSession = session; smoothed = null;
      document.body.classList.add('camera-on'); ui.statusDot('cam', 'ok', 'Camera on; frames stay local');
      cameraStatus('on', session.facingMode === 'user' ?
        'Front camera, unmirrored. Auto AR follows the front lens; camera off returns to the rear-facing sky.' :
        'Camera on. Auto AR follows phone direction; drag to switch to manual alignment.');
    })().catch(e => { if (token === cameraToken) stopCamera('error', `Camera could not start: ${e.message || 'unknown error'}`); });
  }

  function stopAircraft() {
    aircraftGeneration++;
    aircraft?.stop(); aircraft = null;
    state.planes = []; state.aircraftReports = []; state.planeStatus = 'off'; state.planeInfo = null;
  }
  function syncFeeds(refreshOrbitalData = false) {
    const active = !document.hidden;
    const shareAircraft = active && state.layers.planes && !state.selectedTime && !state.loc.source?.startsWith('demo');
    if (!shareAircraft && (aircraft || state.aircraftReports.length)) stopAircraft();
    if (shareAircraft && !aircraft) {
      const generation = ++aircraftGeneration;
      state.planeStatus = 'loading';
      aircraft = startPlanes(() => state.loc, update => {
        if (generation !== aircraftGeneration || !state.layers.planes || document.hidden || state.selectedTime) return;
        state.planeStatus = update.status; state.planeAge = update.ageMs; state.planeInfo = update;
        state.aircraftReports = update.planes || [];
        refreshSky();
      }, { provider: state.aircraftProvider, rangeNm: state.aircraftRangeNm });
    }
    if (state.layers.planes && !shareAircraft) {
      state.planeStatus = state.selectedTime ? 'simulated' : state.loc.source?.startsWith('demo') ? 'location-needed' : 'off';
    }
    if ((!active || !state.layers.sats) && satelliteController) { satelliteController.abort(); satelliteController = null; }
    if (active && state.layers.sats && (refreshOrbitalData || !satelliteReady) && !satelliteController) {
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
  async function refreshSatellites() {
    if (satelliteController) return { ok: false, message: 'Orbital data is already loading. Please wait.' };
    const controller = satelliteController = new AbortController();
    try {
      // Fresh two-hour cache is intentionally reused to respect source rate limits.
      const meta = await initSatellites({ signal: controller.signal });
      if (controller.signal.aborted) return { ok: false, message: 'Orbital data check was cancelled.' };
      state.tleMeta = meta; satelliteReady = true;
      refreshSky(); ui.satList(state.sats, state.tleMeta);
      const ok = (meta.source === 'celestrak' || meta.source === 'cache') && !meta.cacheStale && !meta.error;
      const message = ok ? `${meta.count} orbital records available (${meta.source}). Checks are limited to once every two hours; enable satellites to display them.`
        : 'Live orbital data could not be fully refreshed. Previously retrieved or bundled records may remain; old elements are hidden. See source and retry times below.';
      return { ok, meta, message };
    } catch { return { ok: false, message: 'Orbital data could not load. Check the connection and try again.' }; }
    finally { if (satelliteController === controller) satelliteController = null; }
  }
  function refreshSky(force = false) {
    if (document.hidden) return;
    const date = dateNow();
    // Expire moving reports between polls as well as at receipt (1 Hz UI cadence).
    const receivedNow = Date.now();
    const orbital = satMeta();
    // Successful orbital feeds may refresh once the source interval elapses.
    // A failed/partial attempt needs an explicit human check, not automatic
    // retries against a provider that asked this client to stop.
    if (state.layers.sats && satelliteReady && !satelliteController && !orbital?.error && !orbital?.partial &&
        ['celestrak', 'cache'].includes(orbital?.source) && Number.isFinite(orbital.nextRefreshAt) && receivedNow >= orbital.nextRefreshAt) syncFeeds(true);
    state.aircraftReports = refreshAircraftPositions(state.aircraftReports, state.loc, receivedNow);
    const nextPlanes = new Map(refreshAircraftPositions(state.aircraftReports, state.loc, receivedNow + 1000).map(p => [p.id, p]));
    state.planes = state.aircraftReports.filter(p => p.overlayEligible && p.alt >= 0).map(p => {
      const next = nextPlanes.get(p.id);
      return { ...p, kind: 'plane', name: p.flight, sampleTimeISO: new Date(receivedNow).toISOString(),
        ...(next ? { next: { dateISO: new Date(receivedNow + 1000).toISOString(), alt: next.alt, az: next.az, rangeKm: next.slantKm } } : {}) };
    });
    snapshot = cache.get(date, state.loc, state, force); state.bodies = snapshot.bodies;
    if (state.layers.sats && satelliteReady) {
      try {
        state.satelliteCatalogue = propagateNow(date, state.loc.lat, state.loc.lon, -90, { observerHeightM: state.loc.heightM || 0 });
        state.sats = state.satelliteCatalogue.filter(item => item.alt >= 0 && (state.satelliteVisibility === 'all' || item.visibility?.candidate)); state.tleMeta = satMeta();
      } catch { state.sats = []; state.satelliteCatalogue = []; }
    } else { state.sats = []; state.satelliteCatalogue = []; }
    if (state.selectedId) {
      const selected = allObjects().find(o => o.id === state.selectedId);
      state.highlight = selected ? { ...selected, label: selected.name } : null;
      if (!selected && /^(plane|sat):/.test(state.selectedId)) state.selectedId = null;
    }
    const sun = snapshot.bodies.find(b => b.kind === 'sun');
    document.body.dataset.sun = (sun?.alt ?? -30) > 0 ? 'day' : (sun?.alt ?? -30) > -6 ? 'dusk' : 'night';
    ui.skyList(snapshot.bodies.filter(b => b.alt > -6), snapshot.stars.filter(s => s.name && s.alt > 0).slice(0, 8));
    ui.satList(state.sats, state.tleMeta); ui.planeList(state.aircraftReports, state.planeStatus, state.planeAge, state.planeInfo);
    ui.nearbyState?.(state);
    ui.statusDot('adsb', !state.layers.planes ? 'off' : state.planeStatus === 'ok' ? 'ok' : 'warn', `Aircraft: ${state.layers.planes ? state.planeStatus : 'off'}`);
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
    restoreHandoffSelection();
  }

  function frame(timestamp) {
    if (disposed || document.hidden) { animation = null; return; }
    animation = requestAnimationFrame(frame);
    if (!shouldRenderFrame(timestamp, previousFrame, reducedMotion.matches)) return;
    const delta = previousFrame == null ? 16 : timestamp - previousFrame;
    previousFrame = timestamp;
    let basis, az = state.az, alt = state.alt;
    if (state.sensor && ['tracking', 'stale'].includes(tracking.state.status)) {
      // Screen rotation can change without a new motion event. It changes the
      // camera basis but never refreshes the original sensor sample timestamp.
      const screenAngle = globalThis.screen?.orientation?.angle ?? window.orientation ?? state.sensor.orient;
      const target = X.correctedAttitude({ ...state.sensor, orient: screenAngle }, {
        headingOffset: state.headingOffset, pitchOffset: state.pitchOffset,
        frontCamera: cameraSession?.facingMode === 'user' });
      smoothed = X.smoothAttitude(smoothed, target, delta);
      basis = smoothed; az = basis.az; alt = basis.alt;
      state.az = az; state.alt = X.clamp(alt, -89, 89);
    } else basis = X.makeBasis(az, alt);
    const w = renderer.width, h = renderer.height;
    const fov = X.cameraFov(state.fov, w, h, cameraSession ? video.videoWidth : w, cameraSession ? video.videoHeight : h);
    const instant = dateNow().getTime();
    const movingSatellites = state.sats.map(o => interpolateDirection(o, instant));
    const movingPlanes = state.planes.filter(o => Date.now() - o.positionAt <= 20000).map(o => interpolateDirection(o, instant));
    const movingHighlight = [...movingSatellites, ...movingPlanes].find(o => o.id === state.selectedId);
    const highlight = state.highlight?.kind === 'plane' && !movingHighlight ? null : movingHighlight || state.highlight;
    renderer.draw({ basis, ...fov, stars: snapshot.renderStars,
      bodies: state.bodies, sats: selectMovingMarkers(movingSatellites, alt, az, state.selectedId), planes: selectMovingMarkers(movingPlanes, alt, az, state.selectedId),
      constellations: state.layers.constellations ? snapshot.constellations : null,
      dsos: state.layers.dsos ? snapshot.renderDSOs : null,
      highlight, layers: state.layers, palette: state.night ? PALETTES.night : PALETTES.normal,
      centerAz: az, centerAlt: alt, cameraActive: !!cameraSession, horizonOnly: !!cameraSession, reducedMotion: reducedMotion.matches, nameMode: state.nameMode });
    if (timestamp - lastTelemetry > 250) {
      lastTelemetry = timestamp;
      ui.telemetry({ loc: state.loc, az, alt, date: dateNow(), isLive: !state.selectedTime,
        counts: `${snapshot.visibleCount} stars · ${state.sats.length} satellites` });
      ui.compassTape(az);
      state.aimingCandidates = aimingCandidates([...movingSatellites, ...movingPlanes], alt, az);
      ui.nearbyAim?.(state.aimingCandidates);
    }
  }
  function resumeClock() {
    if (disposed || document.hidden) return;
    tracking.resume();
    refreshSky(true); syncFeeds();
    if (!clockTimer) clockTimer = setInterval(refreshSky, 1000);
    if (!animation) animation = requestAnimationFrame(frame);
  }
  function suspend() {
    tracking.suspend();
    if (cameraSession || cameraStarting) stopCamera('paused');
    clearInterval(clockTimer); clockTimer = null;
    cancelAnimationFrame(animation); animation = null; previousFrame = null;
    stopAircraft();
    satelliteController?.abort(); satelliteController = null;
  }
  const gestureController = new AbortController(), listen = (element, name, fn) => element.addEventListener(name, fn, { signal: gestureController.signal });
  // A slow catalogue import must not steal focus after the user starts a task.
  listen(document, 'pointerdown', () => { pendingHandoffObject = null; });
  listen(document, 'keydown', () => { pendingHandoffObject = null; });
  let pointer = null;
  listen(canvas, 'pointerdown', event => {
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, total: 0, at: performance.now() };
    canvas.setPointerCapture(event.pointerId);
  });
  listen(canvas, 'pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer.total += Math.abs(dx) + Math.abs(dy); pointer.x = event.clientX; pointer.y = event.clientY;
    if (pointer.total > 6 && tracking.state.enabled) stopTracking();
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
    if (!event.key.startsWith('Arrow')) return;
    if (tracking.state.enabled) stopTracking();
    event.preventDefault(); const step = event.shiftKey ? 10 : 3;
    if (event.key === 'ArrowLeft') state.az = X.norm360(state.az - step);
    if (event.key === 'ArrowRight') state.az = X.norm360(state.az + step);
    if (event.key === 'ArrowUp') state.alt = X.clamp(state.alt + step, -89, 89);
    if (event.key === 'ArrowDown') state.alt = X.clamp(state.alt - step, -89, 89);
  });
  listen(document, 'visibilitychange', () => document.hidden ? suspend() : resumeClock());
  listen(window, 'pagehide', suspend);
  listen(window, 'pageshow', resumeClock);
  listen(window, 'hashchange', () => {
    let record;
    try { record = parseSkyHandoff(location.hash); }
    catch (error) { ui.handoffStatus(null, `${error.message} No shared inputs were applied.`); ui.setTab('sky'); return; }
    if (!record) return;
    stopTracking(); stopCamera('off');
    incomingHandoff = record; pendingHandoffObject = record.object;
    Object.assign(state, { loc: { lat: record.lat, lon: record.lon, source: record.locationSource === 'demo' ? 'demo (shared snapshot)' : 'shared snapshot' },
      selectedTime: record.dateISO, nameMode: record.names, selectedId: null, highlight: null });
    state.layers.sats = false; state.layers.planes = false;
    ui.syncSettings(state); ui.handoffStatus(record); ui.setTab('sky');
    refreshSky(true); syncFeeds();
  });
  ui.bindSettings(state, applySettings); ui.bindChips(state, applySettings);
  document.body.classList.toggle('night', state.night);
  cameraStatus('off', 'Rendered sky. Camera is optional and stays off until enabled.');
  trackingChanged(tracking.state);
  resumeClock();
  Promise.allSettled([loadStars(), loadConstellations(), loadDSOs()]).then(results => {
    if (disposed) return;
    catalogueSettled = true;
    if (results.some(r => r.status === 'rejected')) ui.toast('Some sky data could not load. Reload to retry.', 6000);
    refreshSky(true);
    restoreHandoffSelection();
  });
  engineReady.then(value => {
    if (disposed) return;
    engineSettled = true;
    engine = value;
    if (!engine) { ui.toast('Planet engine unavailable. Catalogue positions are approximate.', 6000); ui.tonight(null); }
    refreshSky(true);
    restoreHandoffSelection();
  });
  if (incomingHandoff || handoffError) {
    ui.handoffStatus(incomingHandoff, handoffError ? `${handoffError} No shared inputs were applied; this is your previous or demo sky.` : '');
    ui.setTab('sky');
  } else if (qp.has('dock')) ui.setTab(qp.get('dock'));
  if (!incomingHandoff && !handoffError && !qp.has('manual') && !qp.has('nointro')) ui.onboarding();
  return { state, stop() { disposed = true; stopTracking(); suspend(); gestureController.abort(); ui.dispose?.(); renderer.dispose?.(); } };
}

if (globalThis.document?.getElementById('sky')) createApplication();
