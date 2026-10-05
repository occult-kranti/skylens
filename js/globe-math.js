// Pure orthographic display geometry. Geographic markers are ground/subsatellite
// points on a spherical map, not measurements of camera direction or altitude.
// Reference: Snyder, USGS Professional Paper 1395, Orthographic projection.
// https://pubs.usgs.gov/pp/1395/report.pdf

const RAD = Math.PI / 180, DEG = 180 / Math.PI, EPS = 1e-12;
export const MIN_GLOBE_ZOOM = 1, MAX_GLOBE_ZOOM = 32;
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const longitude = value => ((value + 180) % 360 + 360) % 360 - 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const coordinates = (lat, lon) => Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180;

function unit(lat, lon) {
  if (Math.abs(lat) === 90) return [0, 0, Math.sign(lat)];
  const p = lat * RAD, l = lon * RAD, c = Math.cos(p);
  return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
}

// Cache this vector while an object's geographic position is unchanged. It is
// independent of globe rotation/zoom and does not include altitude or time.
export function geoGlobeUnitVector(lat, lon) {
  return coordinates(lat, lon) ? unit(lat, lon) : null;
}

// Width/height and pointer coordinates are CSS pixels; DPR belongs only to the
// canvas renderer. New views retain no data-fetch or observer-location state.
export function createGlobeView({ width, height, centerLat = 0, centerLon = 0, zoom = 1 } = {}) {
  if (![width, height, centerLat, centerLon, zoom].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new RangeError('Globe dimensions must be positive; centre and zoom must be finite numbers.');
  }
  centerLat = clamp(centerLat, -90, 90);
  centerLon = longitude(centerLon);
  zoom = clamp(zoom, MIN_GLOBE_ZOOM, MAX_GLOBE_ZOOM);
  const radius = Math.min(width, height) * 0.46 * zoom;
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Globe dimensions exceed the supported numeric range.');
  const p = centerLat * RAD, l = centerLon * RAD;
  return {
    width, height, centerLat, centerLon, zoom,
    cx: width / 2, cy: height / 2, radius,
    basis: {
      east: [-Math.sin(l), Math.cos(l), 0],
      north: [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
      forward: unit(centerLat, centerLon),
    },
  };
}

function validView(view) {
  return view && [view.width, view.height, view.cx, view.cy, view.radius].every(Number.isFinite)
    && view.width > 0 && view.height > 0 && view.radius > 0
    && ['east', 'north', 'forward'].every(key => Array.isArray(view.basis?.[key]) && view.basis[key].length === 3 && view.basis[key].every(Number.isFinite));
}

// Back-facing points keep their projected coordinates for diagnostics but MUST
// NOT be drawn or picked. x/y alone cannot distinguish the two hemispheres.
function projectUnit(point, view) {
  const depth = clamp(dot(point, view.basis.forward), -1, 1);
  const x = view.cx + view.radius * dot(point, view.basis.east);
  const y = view.cy - view.radius * dot(point, view.basis.north);
  return { x, y, depth, visible: depth >= -EPS,
    inViewport: x >= 0 && x <= view.width && y >= 0 && y <= view.height };
}

export function projectGlobePoint(lat, lon, view) {
  if (!coordinates(lat, lon) || !validView(view)) return null;
  return projectUnit(unit(lat, lon), view);
}

// A render batch validates/copies the view once and reuses cached geographic
// vectors. Snapshotting prevents a later control mutation from mixing frames.
// Validation here avoids silently projecting ECEF kilometres as unit vectors.
export function createGlobeProjector(view) {
  if (!validView(view)) return () => null;
  const snapshot = { width: view.width, height: view.height, cx: view.cx, cy: view.cy, radius: view.radius,
    basis: { east: [...view.basis.east], north: [...view.basis.north], forward: [...view.basis.forward] } };
  return point => {
    if (!Array.isArray(point) || point.length !== 3 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !Number.isFinite(point[2])
      || Math.abs(point[0] * point[0] + point[1] * point[1] + point[2] * point[2] - 1) > 1e-9) return null;
    return projectUnit(point, snapshot);
  };
}

// Front-hemisphere inverse only. Map points outside the visible canvas or sphere
// have no pick result; no clamping turns an ocean/background tap into a location.
export function unprojectGlobePoint(x, y, view) {
  if (![x, y].every(Number.isFinite) || !validView(view) || x < 0 || x > view.width || y < 0 || y > view.height) return null;
  const east = (x - view.cx) / view.radius, north = (view.cy - y) / view.radius;
  const radiusSquared = east * east + north * north;
  if (radiusSquared > 1 + EPS) return null;
  const forward = Math.sqrt(Math.max(0, 1 - radiusSquared));
  const point = view.basis.east.map((value, i) => value * east + view.basis.north[i] * north + view.basis.forward[i] * forward);
  const horizontal = Math.hypot(point[0], point[1]);
  return { lat: Math.atan2(point[2], horizontal) * DEG,
    // Longitude at either pole is undefined. Use the view meridian consistently.
    lon: horizontal < EPS ? view.centerLon : longitude(Math.atan2(point[1], point[0]) * DEG) };
}

// These functions change only the visual view. They cannot grant permissions,
// move the observer, activate a feed or expand an aircraft provider query.
export function rotateGlobeView(view, deltaLon, deltaLat) {
  if (!validView(view) || ![deltaLon, deltaLat].every(Number.isFinite)) throw new RangeError('Globe rotation needs a valid view and finite degree offsets.');
  return createGlobeView({ ...view, centerLon: view.centerLon + deltaLon, centerLat: view.centerLat + deltaLat });
}

export function zoomGlobeView(view, factor) {
  if (!validView(view) || !Number.isFinite(factor) || factor <= 0) throw new RangeError('Globe zoom needs a valid view and positive finite factor.');
  return createGlobeView({ ...view, zoom: Math.min(MAX_GLOBE_ZOOM, view.zoom * factor) });
}

// Input markers are {id,lat,lon,...}. Return the original row so consumers keep
// its identity, source timestamp and uncertainty fields. Selection wins only a
// distance tie, then ID order makes collocated station components deterministic.
export function hitGlobeMarkers(x, y, markers, view, { radiusPx = 20, selectedId = null } = {}) {
  if (![x, y, radiusPx].every(Number.isFinite) || radiusPx < 0 || !Array.isArray(markers) || !validView(view)
    || x < 0 || x > view.width || y < 0 || y > view.height) return null;
  let winner = null, best = Math.min(radiusPx, 80) ** 2;
  for (const marker of markers) {
    const point = marker && projectGlobePoint(marker.lat, marker.lon, view);
    if (!point?.visible || !point.inViewport) continue;
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance > best + EPS) continue;
    const tie = winner && Math.abs(distance - best) <= EPS;
    if (tie && (winner.id === selectedId && marker.id !== selectedId ||
      (winner.id === selectedId) === (marker.id === selectedId) && String(winner.id).localeCompare(String(marker.id)) <= 0)) continue;
    winner = marker; best = distance;
  }
  return winner;
}
