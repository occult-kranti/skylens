// Independent live geographic view. Map centre, queried area and sky observer
// are deliberately different state. Moving the map never starts a request.
import { createGlobeView, rotateGlobeView, zoomGlobeView } from './globe-math.js';
import { createGlobeRenderer } from './globe-render.js';
import { createGlobeUI } from './globe-ui.js';
import { createTrafficFeed, refreshTrafficReports } from './traffic-feed.js';
import { initSatellites, propagateNow, satMeta } from './satellites.js';
import { getLocation } from './sensors.js';

const validPoint = p => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180;
const PREFS_KEY = 'skylens.preferences.v2';
let preferences = {};
try { preferences = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { /* optional storage */ }
const observer = validPoint(preferences.loc) ? { ...preferences.loc } : { lat: 40.7128, lon: -74.006, source: 'demo (New York)' };
const canvas = document.getElementById('globeCanvas');
const renderer = createGlobeRenderer(canvas);
const state = {
  view: createGlobeView({ width: renderer.width, height: renderer.height, centerLat: observer.lat, centerLon: observer.lon, zoom: 1 }),
  observer, layers: { planes: false, sats: false }, feed: { status: 'off', coverage: { kind: 'none', label: 'No aircraft source connected' } },
  objects: [], selectedId: null, following: false, skyURL: 'index.html?manual=1&nointro=1',
  satelliteMeta: null, satelliteStatus: 'off', night: preferences.night === true, loading: true, error: '',
};
let reports = [], satellites = [], disposed = false, timer = null, frame = null;
let aircraftConfig = null, aircraftToken = 0; // consent lasts only this page visit
let orbitalController = null, orbitalToken = 0, orbitalReady = false, lastTrailTime = 0;
const trails = new Map();
const feed = createTrafficFeed({ onUpdate(update) {
  if (disposed) return;
  state.feed = { ...state.feed, ...update };
  // Loading/backoff is not a new snapshot. Keep a selected current report until
  // its own age expires, so every normal refresh does not interrupt Follow.
  if (update.status === 'ok' || update.status === 'off') reports = update.reports || [];
  refresh();
} });

function stopFollowing() { state.following = false; }
function changedView(next) { stopFollowing(); state.view = next; requestDraw(); }
const ui = createGlobeUI({
  zoom: factor => changedView(zoomGlobeView(state.view, factor)),
  rotate: (lon, lat) => changedView(rotateGlobeView(state.view, lon, lat)),
  resetView: () => changedView(createGlobeView({ ...state.view, centerLat: 15, centerLon: 0, zoom: 1 })),
  useLocation: async () => {
    ui.announce('Requesting device location to centre the globe. This does not move your saved sky observer.');
    const location = await getLocation();
    if (disposed) return;
    if (!validPoint(location)) { ui.announce('Device location was unavailable. Drag the globe to choose an area.'); return; }
    changedView(createGlobeView({ ...state.view, centerLat: location.lat, centerLon: location.lon, zoom: Math.max(4, state.view.zoom) }));
    ui.announce('Globe centred on your device. Choose Load this area to share a regional query.');
  },
  select: selectObject,
  pick: (x, y) => { const item = renderer.pick(x, y); if (item) selectObject(item.id); },
  follow: enabled => {
    const item = state.objects.find(o => o.id === state.selectedId);
    state.following = enabled === true && !!item && item.overlayEligible !== false;
    refresh();
  },
  setLayer: (layer, enabled) => {
    if (layer === 'sats') {
      state.layers.sats = enabled === true;
      if (enabled) loadSatellites();
      else { orbitalToken++; orbitalController?.abort(); orbitalController = null; state.satelliteStatus = 'off'; satellites = []; }
    } else if (layer === 'planes') {
      if (!enabled) stopAircraft();
      else if (aircraftConfig) startAircraft(aircraftConfig);
    }
    refresh();
  },
  queryArea: ({ lat, lon, rangeNm, provider }) => startAircraft({ kind: 'regional', provider, center: { lat, lon }, rangeNm }),
  connectReceiver: ({ url, schema, coverageLabel }) => startAircraft({ kind: 'receiver', url, schema, coverageLabel }),
  stopAircraft,
  openSky: openSky,
});

function selectObject(id) {
  const item = state.objects.find(o => o.id === id);
  if (!item || !validPoint(item)) return;
  state.selectedId = id; stopFollowing(); trails.clear(); lastTrailTime = 0;
  state.view = createGlobeView({ ...state.view, centerLat: item.lat, centerLon: item.lon });
  refresh();
}
async function startAircraft(config) {
  const token = ++aircraftToken;
  aircraftConfig = null; state.aircraftConfigured = false;
  state.layers.planes = true; state.feed = { status: 'loading', coverage: { kind: config.kind, label: 'Connecting the selected source' } };
  reports = []; refresh();
  try {
    await feed.start(config);
    if (token !== aircraftToken || disposed || !state.layers.planes) return;
    aircraftConfig = { ...config, ...(config.center ? { center: { ...config.center } } : {}) }; state.aircraftConfigured = true; ui.update(state);
  } catch (error) {
    if (token !== aircraftToken || disposed) return;
    state.layers.planes = false; state.feed = { status: 'error', error: error.message, coverage: { kind: 'none', label: 'No aircraft data loaded' } }; reports = []; ui.announce(error.message); refresh();
  }
}
function stopAircraft() {
  aircraftToken++;
  feed.stop(); state.layers.planes = false; reports = [];
  state.feed = { status: 'off', coverage: { kind: 'none', label: 'Aircraft feed off' } };
  refresh();
}
async function loadSatellites() {
  if (orbitalController || !state.layers.sats || document.hidden) return;
  const token = ++orbitalToken, controller = orbitalController = new AbortController();
  state.satelliteStatus = 'loading'; ui.update(state);
  try {
    window.__satReady ||= import('../vendor/satellite.esm.js').then(lib => { window.satellite = lib; return 'local'; });
    await window.__satReady;
    const meta = await initSatellites({ signal: controller.signal });
    if (token !== orbitalToken || controller.signal.aborted || disposed) return;
    state.satelliteMeta = meta; orbitalReady = true;
    state.satelliteStatus = meta.count ? meta.stale || meta.error ? 'older data' : 'ready' : 'unavailable';
  } catch { if (token === orbitalToken) state.satelliteStatus = 'unavailable'; }
  finally { if (token === orbitalToken) { orbitalController = null; refresh(); } }
}
function refresh() {
  if (disposed || document.hidden) return;
  const now = Date.now();
  if (state.layers.planes) reports = refreshTrafficReports(reports, now);
  if (state.layers.sats && orbitalReady) {
    try {
      satellites = propagateNow(new Date(now), observer.lat, observer.lon, -90,
        { observerHeightM: Number.isFinite(observer.heightM) ? observer.heightM : 0, nextSampleSeconds: 0 })
        .filter(o => validPoint(o.geo)).map(o => ({ ...o, lat: o.geo.lat, lon: o.geo.lon, heightKm: o.geo.heightKm, overlayEligible: true }));
      state.satelliteMeta = satMeta();
      const meta = state.satelliteMeta;
      if (!meta.error && !meta.partial && ['cache', 'celestrak'].includes(meta.source) && meta.nextRefreshAt && now >= meta.nextRefreshAt && !orbitalController) loadSatellites();
    } catch { satellites = []; state.satelliteStatus = 'unavailable'; }
  }
  state.objects = [...(state.layers.planes ? reports.map(p => ({ ...p, kind: 'plane', name: p.name || p.flight || p.hex,
    overlayEligible: p.markerEligible ?? p.overlayEligible,
    lat: Number.isFinite(p.projectedLat) ? p.projectedLat : p.lat, lon: Number.isFinite(p.projectedLon) ? p.projectedLon : p.lon })) : []), ...(state.layers.sats ? satellites : [])];
  const selected = state.objects.find(o => o.id === state.selectedId);
  if (!selected || selected.overlayEligible === false) stopFollowing();
  if (!selected && state.selectedId) { state.selectedId = null; trails.clear(); }
  if (selected && state.following) state.view = createGlobeView({ ...state.view, centerLat: selected.lat, centerLon: selected.lon });
  if (selected && selected.overlayEligible !== false && now - lastTrailTime >= 10000) {
    const points = trails.get(selected.id) || [];
    points.push({ lat: selected.lat, lon: selected.lon, t: now });
    trails.set(selected.id, points.filter(p => now - p.t <= 1200000).slice(-120)); lastTrailTime = now;
  }
  state.now = now;
  requestDraw(); ui.update(state);
}
function requestDraw() {
  if (frame !== null || disposed || document.hidden) return;
  frame = requestAnimationFrame(() => {
    frame = null; renderer.resize();
    state.view = createGlobeView({ ...state.view, width: renderer.width, height: renderer.height });
    renderer.draw({ view: state.view, objects: state.objects, selectedId: state.selectedId, observer: state.observer,
      coverage: state.feed.coverage, trails, night: state.night });
    const stats = renderer.stats;
    if (stats) state.renderStats = stats;
    // Pointer streams may deliver several events before a paint. Publish the
    // final view/readout once with the rendered frame, not once per raw event.
    ui.update(state);
  });
}
function openSky(id = state.selectedId) {
  const item = state.objects.find(o => o.id === id);
  try {
    if (item) sessionStorage.setItem('skylens.globe-target.v1', JSON.stringify({ id: item.id, name: String(item.name).slice(0, 100), kind: item.kind, at: Date.now() }));
  } catch { /* destination remains usable without storage */ }
  location.assign(state.skyURL);
}
function suspend() {
  clearInterval(timer); timer = null;
  if (frame !== null) cancelAnimationFrame(frame); frame = null;
  orbitalToken++; orbitalController?.abort(); orbitalController = null;
}
function resume() {
  if (disposed || document.hidden || timer !== null) return;
  timer = setInterval(refresh, 1000);
  if (state.layers.sats && !orbitalReady) loadSatellites();
  refresh();
}
const events = new AbortController();
window.addEventListener('resize', requestDraw, { signal: events.signal });
document.addEventListener('visibilitychange', () => document.hidden ? suspend() : resume(), { signal: events.signal });
window.addEventListener('pagehide', () => { suspend(); stopAircraft(); }, { signal: events.signal });
window.addEventListener('pageshow', resume, { signal: events.signal });
window.addEventListener('beforeunload', () => { disposed = true; suspend(); feed.dispose(); ui.dispose(); renderer.dispose(); events.abort(); }, { signal: events.signal });
fetch('data/earth-land.geojson', { signal: events.signal }).then(response => {
  if (!response.ok) throw new Error('Land asset unavailable'); return response.json();
}).then(land => {
  // Renderer also accepts land on a draw to avoid needing a second instance.
  renderer.setLand?.(land); state.loading = false; requestDraw(); ui.update(state);
}).catch(() => { state.loading = false; state.error = 'Coastlines could not load. Coordinates and controls remain available.'; ui.update(state); });
resume();
