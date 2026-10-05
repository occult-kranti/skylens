// Canvas cartography and geographic/subsatellite symbols. Sphere shading is a
// display treatment, not a solar terminator or an estimate of optical visibility.
import { geoOrthographic, geoPath, geoGraticule10, geoCircle } from '../vendor/d3-geo.js';
import { projectGlobePoint, geoGlobeUnitVector, createGlobeProjector } from './globe-math.js';

const RAD = Math.PI / 180;
// Headroom for the satellite catalogue alongside a 60,000-row aircraft feed.
const MAX_OBJECTS = 65000;
const MAX_MARKERS = 1600;
const MAX_LABELS = 35;
const LABEL_CANDIDATES = 110;
const FONT = '500 11px system-ui, "Nirmala UI", "Noto Sans Devanagari", sans-serif';
const GRATICULE = geoGraticule10();
const WORLD_GRID_POINTS = GRATICULE.coordinates.reduce((sum, line) => sum + line.length, 0);
const MAX_GRID_POINTS = 5000;
const PLANE_SHAPE = [
  [0, 6.4], [-1.15, 1.3], [-4.8, -1.1], [-4.8, -2.3], [-1.1, -1.4],
  [-.8, -4], [-2.2, -5.1], [-2.2, -6], [0, -5.2], [2.2, -6],
  [2.2, -5.1], [.8, -4], [1.1, -1.4], [4.8, -2.3], [4.8, -1.1], [1.15, 1.3],
];
const PALETTES = {
  normal: {
    space: '#050c15', ocean: '#0b2130', land: '#244a52', coast: '#53818b',
    grid: 'rgba(133,182,199,.17)', equator: 'rgba(133,182,199,.29)',
    rim: '#4a7485', shine: 'rgba(153,205,216,.08)', shade: 'rgba(0,5,13,.38)',
    plane: '#8cddff', satellite: '#ffcc87', shadowed: '#c9a984', selected: '#ffe0a8',
    edge: '#07111c', text: '#bcd3df', label: 'rgba(5,16,26,.91)',
    observer: '#e7f5fa', coverage: '#70c8ee', coverageFill: 'rgba(92,193,233,.085)',
    trail: '#ffd391',
  },
  night: {
    space: '#0c0303', ocean: '#210a0a', land: '#47211e', coast: '#8d5145',
    grid: 'rgba(216,124,101,.15)', equator: 'rgba(216,124,101,.25)',
    rim: '#8c4b40', shine: 'rgba(233,133,105,.055)', shade: 'rgba(12,0,0,.38)',
    plane: '#ff9b87', satellite: '#eab096', shadowed: '#b67a69', selected: '#ffc0a9',
    edge: '#180604', text: '#dba28f', label: 'rgba(27,7,5,.94)',
    observer: '#ffc0ad', coverage: '#e68c78', coverageFill: 'rgba(230,140,120,.075)',
    trail: '#efad90',
  },
};

const coordinate = row => row && Number.isFinite(row.lat) && Math.abs(row.lat) <= 90
  && Number.isFinite(row.lon) && Math.abs(row.lon) <= 180;
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const now = () => globalThis.performance?.now?.() ?? Date.now();

function canvasLayer(canvas) {
  // The extra bitmap caches only cartography. Object/source changes do not
  // repeatedly tessellate the same Natural Earth geometry.
  if (canvas.ownerDocument?.createElement) return canvas.ownerDocument.createElement('canvas');
  return typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : null;
}

function projectionFor(view) {
  return geoOrthographic().scale(view.radius).translate([view.cx, view.cy])
    .rotate([-view.centerLon, -view.centerLat, 0]).clipAngle(90)
    .clipExtent([[0, 0], [view.width, view.height]]).precision(.45);
}

function graticuleFor(view) {
  const zoom = view.zoom || 1;
  const target = zoom >= 10 ? 1 : zoom >= 5 ? 2 : zoom >= 2.5 ? 5 : 10;
  if (target === 10) return { geometry: GRATICULE, step: 10, points: WORLD_GRID_POINTS };
  // A spherical cap enclosing the visible rectangle bounds the local grid.
  // At a pole the longitude span must remain a full circle. Unusual aspect
  // ratios can widen the cap; coarsen spacing rather than grow without bound.
  const diagonal = Math.max(Math.hypot(view.cx, view.cy), Math.hypot(view.width - view.cx, view.cy),
    Math.hypot(view.cx, view.height - view.cy), Math.hypot(view.width - view.cx, view.height - view.cy));
  const extent = Math.asin(Math.min(1, diagonal / view.radius)) / RAD;
  const longitudeExtent = Math.abs(view.centerLat) + extent >= 90 ? 180
    : Math.asin(Math.min(1, Math.sin(extent * RAD) / Math.cos(view.centerLat * RAD))) / RAD;
  const parallelSample = clamp(Math.sqrt(8 * .35 / view.radius) / RAD, .5, 2);
  for (const step of [1, 2, 5]) {
    if (step < target) continue;
    const south = Math.max(-90, view.centerLat - extent - step);
    const north = Math.min(90, view.centerLat + extent + step);
    const span = Math.min(180, longitudeExtent + step);
    const west = view.centerLon - span, east = view.centerLon + span;
    const firstMeridian = Math.ceil(west / step) * step;
    let lastMeridian = Math.floor(east / step) * step;
    if (lastMeridian - firstMeridian >= 360) lastMeridian -= step;
    const firstParallel = Math.max(-90 + step, Math.ceil(south / step) * step);
    const lastParallel = Math.min(90 - step, Math.floor(north / step) * step);
    const meridianSegments = Math.max(1, Math.ceil((north - south) / 10));
    const parallelSegments = Math.max(1, Math.ceil((east - west) / parallelSample));
    const meridians = Math.max(0, Math.round((lastMeridian - firstMeridian) / step) + 1);
    const parallels = Math.max(0, Math.round((lastParallel - firstParallel) / step) + 1);
    const points = meridians * (meridianSegments + 1) + parallels * (parallelSegments + 1);
    if (points > MAX_GRID_POINTS) continue;
    const lines = [];
    for (let column = 0; column < meridians; column++) {
      const lon = firstMeridian + column * step, line = [];
      for (let i = 0; i <= meridianSegments; i++) line.push([lon, south + (north - south) * i / meridianSegments]);
      lines.push(line);
    }
    for (let row = 0; row < parallels; row++) {
      const lat = firstParallel + row * step, line = [];
      for (let i = 0; i <= parallelSegments; i++) line.push([west + (east - west) * i / parallelSegments, lat]);
      lines.push(line);
    }
    return { geometry: { type: 'MultiLineString', coordinates: lines }, step, points };
  }
  return { geometry: GRATICULE, step: 10, points: WORLD_GRID_POINTS };
}

function cartography(ctx, view, land, palette) {
  const { width, height, cx, cy, radius } = view;
  const path = geoPath(projectionFor(view), ctx);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.space;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = palette.ocean;
  ctx.fillRect(0, 0, width, height);
  if (land) {
    ctx.beginPath();
    path(land);
    ctx.fillStyle = palette.land;
    ctx.fill();
    ctx.lineWidth = .85;
    ctx.strokeStyle = palette.coast;
    ctx.stroke();
  }
  const grid = graticuleFor(view);
  ctx.beginPath();
  path(grid.geometry);
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = .65;
  ctx.stroke();
  ctx.beginPath();
  path({ type: 'LineString', coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]] });
  ctx.strokeStyle = palette.equator;
  ctx.lineWidth = .8;
  ctx.stroke();
  // Fixed screen lighting gives the sphere a legible edge; it intentionally has
  // no relationship to selected time, latitude, or satellite illumination.
  const shading = ctx.createRadialGradient(cx - radius * .27, cy - radius * .3, radius * .06, cx, cy, radius);
  shading.addColorStop(0, palette.shine);
  shading.addColorStop(.65, 'rgba(0,0,0,0)');
  shading.addColorStop(1, palette.shade);
  ctx.fillStyle = shading;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  ctx.beginPath();
  // A real circle stroke avoids treating the viewport clipping rectangle as
  // part of the Earth's limb when the globe is larger than the canvas.
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = palette.rim;
  ctx.stroke();
  return { step: grid.step, points: grid.points };
}

function drawCoverage(ctx, path, coverage, palette) {
  if (coverage?.kind !== 'regional' || !coordinate(coverage.center)
    || !Number.isFinite(coverage.rangeNm) || coverage.rangeNm <= 0) return;
  const angle = Math.min(179.999, coverage.rangeNm * 1852 / 6371008.8 / RAD);
  const circle = geoCircle().center([coverage.center.lon, coverage.center.lat]).radius(angle).precision(2)();
  ctx.beginPath();
  path(circle);
  ctx.fillStyle = palette.coverageFill;
  ctx.fill();
  // Stroke the geographic boundary separately. Polygon clipping can create a
  // hemisphere closure, which is not a queried area's actual boundary.
  ctx.beginPath();
  path({ type: 'LineString', coordinates: circle.coordinates[0] });
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = palette.coverage;
  ctx.lineWidth = 1.15;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTrail(ctx, path, trail, palette) {
  if (!Array.isArray(trail) || trail.length < 2) return;
  const lines = [];
  let segment = [];
  for (const point of trail.slice(-120)) {
    if (coordinate(point)) segment.push([point.lon, point.lat]);
    else {
      if (segment.length > 1) lines.push(segment);
      segment = [];
    }
  }
  if (segment.length > 1) lines.push(segment);
  if (!lines.length) return;
  ctx.beginPath();
  path({ type: 'MultiLineString', coordinates: lines });
  ctx.lineWidth = 3.8;
  ctx.strokeStyle = palette.edge;
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = palette.trail;
  ctx.stroke();
}

function direction(object, view) {
  if (!Number.isFinite(object.track)) return null;
  const latitude = object.lat * RAD, deltaLon = (object.lon - view.centerLon) * RAD;
  const latitude0 = view.centerLat * RAD, track = object.track * RAD;
  const east = Math.sin(track), north = Math.cos(track);
  const x = east * Math.cos(deltaLon) - north * Math.sin(latitude) * Math.sin(deltaLon);
  const y = -east * Math.sin(latitude0) * Math.sin(deltaLon)
    - north * (Math.cos(latitude0) * Math.cos(latitude) + Math.sin(latitude0) * Math.sin(latitude) * Math.cos(deltaLon));
  const length = Math.hypot(x, y);
  return length > 1e-7 ? { x: x / length, y: y / length } : null;
}

function appendMarker(ctx, marker, scale = 1) {
  const { x, y, forward, object } = marker;
  if (object.kind === 'satellite') {
    const size = 4.2 * scale;
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
  } else if (forward) {
    // A true-track tangent is projected into screen space. Pointing all aircraft
    // at their compass bearing on the canvas would be incorrect away from centre.
    for (let index = 0; index < PLANE_SHAPE.length; index++) {
      const [across, along] = PLANE_SHAPE[index];
      const px = x + (-forward.y * across + forward.x * along) * scale;
      const py = y + (forward.x * across + forward.y * along) * scale;
      if (index) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else {
    // An unreported/degenerate heading must not invent a northward direction.
    const size = 3.5 * scale;
    ctx.moveTo(x + size, y);
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.closePath();
  }
}

function markerColor(marker, palette) {
  if (marker.object.kind !== 'satellite') return palette.plane;
  return marker.object.illumination === 'umbra' ? palette.shadowed : palette.satellite;
}

function drawMarkers(ctx, markers, selected, palette) {
  // A few batched paths are cheaper than save/rotate/fill for every aircraft.
  const groups = new Map();
  for (const marker of markers) {
    if (marker === selected) continue;
    const color = markerColor(marker, palette);
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color).push(marker);
  }
  ctx.lineJoin = 'round';
  for (const [color, group] of groups) {
    ctx.beginPath();
    for (const marker of group) appendMarker(ctx, marker);
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (!selected) return;
  ctx.beginPath();
  ctx.arc(selected.x, selected.y, 12, 0, Math.PI * 2);
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = palette.selected;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  appendMarker(ctx, selected, 1.2);
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = palette.selected;
  ctx.fill();
}

function collisionIndex() {
  const cells = new Map();
  function keys(rect) {
    const result = [];
    for (let x = Math.floor(rect.left / 64); x <= Math.floor(rect.right / 64); x++) {
      for (let y = Math.floor(rect.top / 32); y <= Math.floor(rect.bottom / 32); y++) result.push(`${x}:${y}`);
    }
    return result;
  }
  return {
    intersects(rect) {
      for (const key of keys(rect)) {
        for (const other of cells.get(key) || []) {
          if (rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top) return true;
        }
      }
      return false;
    },
    add(rect) {
      for (const key of keys(rect)) {
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(rect);
      }
    },
  };
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
function fitName(ctx, value, available) {
  const name = String(value || '').slice(0, 200);
  if (!name) return '';
  if (ctx.measureText(name).width <= available) return name;
  const parts = segmenter ? Array.from(segmenter.segment(name), part => part.segment) : Array.from(name);
  while (parts.length && ctx.measureText(parts.join('') + '…').width > available) parts.pop();
  return parts.length ? parts.join('') + '…' : '';
}

function drawLabels(ctx, markers, selected, view, palette, budget) {
  const candidates = selected ? [selected] : [];
  const sampleCells = new Set();
  // One candidate per screen cell prevents catalogue order from filling every
  // label slot with one crowded airport. Work stays bounded as feed size grows.
  for (const marker of markers) {
    if (candidates.length >= LABEL_CANDIDATES) break;
    if (marker === selected) continue;
    const key = `${Math.floor(marker.x / 58)}:${Math.floor(marker.y / 36)}`;
    if (sampleCells.has(key)) continue;
    sampleCells.add(key);
    candidates.push(marker);
  }
  const occupied = collisionIndex();
  let count = 0;
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const marker of candidates) {
    if (count >= budget) break;
    const label = fitName(ctx, marker.object.name || marker.object.id, Math.min(190, view.width - 28));
    if (!label) continue;
    const width = Math.ceil(ctx.measureText(label).width) + 10, height = 20;
    const gap = marker === selected ? 17 : 10;
    const options = [
      [marker.x + gap, marker.y - height / 2],
      [marker.x - gap - width, marker.y - height / 2],
      [marker.x - width / 2, marker.y + gap],
      [marker.x - width / 2, marker.y - gap - height],
    ];
    let placement = null;
    for (let index = 0; index < options.length; index++) {
      let [left, top] = options[index];
      if (marker === selected) {
        // Preserve the gap from the selected symbol: clamp the perpendicular
        // axis only, so an edge label never gets pushed over its own marker.
        if (index < 2) top = clamp(top, 4, view.height - height - 4);
        else left = clamp(left, 4, view.width - width - 4);
      }
      const rect = { left: left - 3, right: left + width + 3, top: top - 2, bottom: top + height + 2 };
      if (rect.left < 1 || rect.right > view.width - 1 || rect.top < 1 || rect.bottom > view.height - 1 || occupied.intersects(rect)) continue;
      placement = { left, top, rect };
      break;
    }
    if (!placement) continue;
    const { left, top, rect } = placement;
    occupied.add(rect);
    if (marker === selected) {
      ctx.fillStyle = palette.label;
      ctx.fillRect(left, top, width, height);
      ctx.fillStyle = palette.selected;
      ctx.fillRect(left, top + 3, 2, height - 6);
    } else {
      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = 3;
      ctx.strokeText(label, left + 5, top + height / 2 + .5);
    }
    ctx.fillStyle = marker === selected ? palette.selected : palette.text;
    ctx.fillText(label, left + 5, top + height / 2 + .5);
    count++;
  }
  return count;
}

function drawObserver(ctx, observer, view, palette) {
  if (!coordinate(observer)) return;
  const point = projectGlobePoint(observer.lat, observer.lon, view);
  if (!point?.visible || !point.inViewport) return;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = palette.observer;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = palette.observer;
  ctx.fill();
}

export function createGlobeRenderer(canvas, { land = null } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The globe needs a 2D canvas context.');
  const layer = canvasLayer(canvas);
  const layerContext = layer?.getContext('2d');
  let width = 0, height = 0, dpr = 1, backgroundKey = '';
  let gridStats = { step: 10, points: WORLD_GRID_POINTS };
  let disposed = false, projected = [], lastView = null, lastSelectedId = null;
  let cachedObjects = null, vectorCache = new Map();
  let stats = Object.freeze({ rawCount: 0, consideredCount: 0, cappedCount: 0, eligibleCount: 0, visibleCount: 0,
    drawnCount: 0, suppressedCount: 0, labelsDrawn: 0, labelBudget: 12,
    graticuleStep: 10, graticulePoints: WORLD_GRID_POINTS, renderMs: 0 });

  function resize() {
    if (disposed) return;
    const nextWidth = Math.max(1, Math.round(canvas.clientWidth || canvas.getBoundingClientRect?.().width || 1));
    const nextHeight = Math.max(1, Math.round(canvas.clientHeight || canvas.getBoundingClientRect?.().height || 1));
    const nextDpr = clamp(globalThis.devicePixelRatio || 1, 1, 2);
    if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (layer && layerContext) {
      layer.width = canvas.width;
      layer.height = canvas.height;
      layerContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    backgroundKey = '';
    projected = [];
  }

  function draw({ view, objects = [], selectedId = null, observer = null, coverage = null, trails = null, night = false } = {}) {
    if (disposed || !view || ![view.width, view.height, view.cx, view.cy, view.radius, view.centerLat, view.centerLon].every(Number.isFinite)
      || view.width <= 0 || view.height <= 0 || view.radius <= 0) return;
    const start = now();
    const palette = night ? PALETTES.night : PALETTES.normal;
    lastView = view;
    lastSelectedId = selectedId;
    const nextKey = [width, height, dpr, view.width, view.height, view.cx, view.cy, view.radius, view.zoom, view.centerLat, view.centerLon, !!night].join(':');
    if (layerContext) {
      if (backgroundKey !== nextKey) {
        gridStats = cartography(layerContext, view, land, palette);
        backgroundKey = nextKey;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(layer, 0, 0, width, height);
    } else gridStats = cartography(ctx, view, land, palette);
    const path = geoPath(projectionFor(view), ctx);
    drawCoverage(ctx, path, coverage, palette);
    if (selectedId != null) drawTrail(ctx, path, trails instanceof Map ? trails.get(selectedId) : null, palette);
    drawObserver(ctx, observer, view, palette);

    const input = Array.isArray(objects) ? objects : [];
    const consideredCount = Math.min(input.length, MAX_OBJECTS);
    const visible = [];
    const projectUnit = createGlobeProjector(view);
    const previousCache = vectorCache;
    const newObjectList = cachedObjects !== input;
    if (newObjectList) {
      // Swap, rather than accumulate, when a source update replaces its rows.
      // This drops departed IDs and never retains more than MAX_OBJECTS units.
      vectorCache = new Map();
      cachedObjects = input;
    }
    let eligibleCount = 0, selected = null;
    for (let index = 0; index < consideredCount; index++) {
      const object = input[index];
      if (!object || object.overlayEligible === false || (object.kind !== 'plane' && object.kind !== 'satellite')) continue;
      const key = object.id ?? object;
      let cached = previousCache.get(key);
      if (!cached || cached.lat !== object.lat || cached.lon !== object.lon) {
        const unit = geoGlobeUnitVector(object.lat, object.lon);
        if (!unit) continue;
        cached = { lat: object.lat, lon: object.lon, unit };
        vectorCache.set(key, cached);
      } else if (newObjectList) vectorCache.set(key, cached);
      const point = projectUnit(cached.unit);
      if (!point) continue;
      eligibleCount++;
      if (!point.visible || !point.inViewport) continue;
      const marker = { object, x: point.x, y: point.y, depth: point.depth, forward: null };
      visible.push(marker);
      if (object.id === selectedId) selected = marker;
    }
    // At world scale a dense feed otherwise becomes a solid patch. These are
    // actual representative markers, never aggregate objects/count bubbles.
    // Picking uses only the representatives that were painted, at their exact
    // original positions; stats expose how many visible records were suppressed.
    projected = visible;
    if (visible.length > MAX_MARKERS) {
      const cellSize = Math.max(12, Math.ceil(Math.sqrt(view.width * view.height / 1400)));
      const buckets = new Set();
      projected = [];
      if (selected) buckets.add(`${Math.floor(selected.x / cellSize)}:${Math.floor(selected.y / cellSize)}`);
      for (const marker of visible) {
        if (marker === selected) continue;
        const bucket = `${Math.floor(marker.x / cellSize)}:${Math.floor(marker.y / cellSize)}`;
        if (buckets.has(bucket)) continue;
        buckets.add(bucket);
        projected.push(marker);
        if (projected.length >= MAX_MARKERS - (selected ? 1 : 0)) break;
      }
      if (selected) projected.push(selected);
    }
    for (const marker of projected) {
      if (marker.object.kind === 'plane') marker.forward = direction(marker.object, view);
    }
    drawMarkers(ctx, projected, selected, palette);
    const labelBudget = view.zoom >= 5 ? MAX_LABELS : view.zoom >= 2.5 ? 22 : 12;
    const labelsDrawn = drawLabels(ctx, projected, selected, view, palette, labelBudget);
    stats = Object.freeze({ rawCount: input.length, consideredCount, cappedCount: input.length - consideredCount,
      eligibleCount, visibleCount: visible.length,
      drawnCount: projected.length, suppressedCount: visible.length - projected.length, labelsDrawn, labelBudget,
      graticuleStep: gridStats.step, graticulePoints: gridStats.points,
      renderMs: Math.round((now() - start) * 100) / 100 });
  }

  function pick(x, y) {
    if (disposed || !lastView || ![x, y].every(Number.isFinite)
      || x < 0 || y < 0 || x > lastView.width || y > lastView.height) return null;
    let winner = null, distanceSquared = 20 ** 2;
    for (const marker of projected) {
      const distance = (marker.x - x) ** 2 + (marker.y - y) ** 2;
      if (distance > distanceSquared) continue;
      if (winner && Math.abs(distance - distanceSquared) < 1e-8) {
        if (winner.object.id === lastSelectedId && marker.object.id !== lastSelectedId) continue;
        if ((winner.object.id === lastSelectedId) === (marker.object.id === lastSelectedId)
          && String(winner.object.id).localeCompare(String(marker.object.id)) <= 0) continue;
      }
      winner = marker;
      distanceSquared = distance;
    }
    return winner?.object || null;
  }

  function dispose() {
    disposed = true;
    projected = [];
    lastView = null;
    cachedObjects = null;
    vectorCache.clear();
    if (layer) { layer.width = 1; layer.height = 1; }
  }

  function setLand(nextLand) {
    if (disposed) return;
    land = nextLand;
    backgroundKey = '';
  }

  resize();
  return { draw, resize, pick, dispose, setLand, get width() { return width; }, get height() { return height; }, get stats() { return stats; } };
}
