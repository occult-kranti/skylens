// Observer-direction helpers. These compare reported/calculated directions;
// they do not analyse camera pixels or establish an object's optical identity.
import { angularSep, clamp, norm360, vecFromAltAz, R2D } from './astro.js';

export const MAX_AIM_CANDIDATES = 3;

// Short unit-vector interpolation crosses north and the zenith without an
// azimuth-wrap jump. Samples are supplied by the slower propagation cadence.
export function interpolateDirection(object, nowMs) {
  const start = Date.parse(object?.sampleTimeISO), end = Date.parse(object?.next?.dateISO);
  if (!Number.isFinite(nowMs) || !Number.isFinite(start) || !(end > start && end - start <= 5000) ||
      ![object.alt, object.az, object.next.alt, object.next.az].every(Number.isFinite)) return object;
  const t = clamp((nowMs - start) / (end - start), 0, 1);
  const a = vecFromAltAz(object.alt, object.az), b = vecFromAltAz(object.next.alt, object.next.az);
  const dot = clamp(a.reduce((sum, v, i) => sum + v * b[i], 0), -1, 1);
  // An opposite sample is not a plausible one-second sky track. Keep the
  // current measurement rather than inventing a route through the singularity.
  if (dot < -.999) return object;
  const angle = Math.acos(dot), sine = Math.sin(angle);
  const weights = sine > 1e-8 ? [Math.sin((1 - t) * angle) / sine, Math.sin(t * angle) / sine] : [1 - t, t];
  const v = a.map((x, i) => x * weights[0] + b[i] * weights[1]), length = Math.hypot(...v);
  if (!(length > 0)) return object;
  const range = Number.isFinite(object.rangeKm) && Number.isFinite(object.next.rangeKm)
    ? object.rangeKm + t * (object.next.rangeKm - object.rangeKm) : object.rangeKm;
  return { ...object, alt: Math.asin(clamp(v[1] / length, -1, 1)) * R2D,
    az: Math.hypot(v[0], v[2]) < 1e-12 ? object.az : norm360(Math.atan2(v[0], -v[2]) * R2D), rangeKm: range };
}

export function aimingCandidates(objects, altitude, azimuth, { maxAngle = 12, limit = MAX_AIM_CANDIDATES } = {}) {
  if (![altitude, azimuth].every(Number.isFinite)) return [];
  return objects.filter(o => o && o.alt >= 0 && Number.isFinite(o.az) && o.overlayEligible !== false)
    .map(o => ({ ...o, angularDistance: angularSep(altitude, azimuth, o.alt, o.az) }))
    .filter(o => o.angularDistance <= maxAngle)
    .sort((a, b) => a.angularDistance - b.angularDistance || String(a.id).localeCompare(String(b.id)))
    .slice(0, clamp(limit, 0, MAX_AIM_CANDIDATES));
}

// Limit moving markers without dropping searchable records. Selected targets
// keep their slot. Label collision suppression is still owned by the renderer.
export function selectMovingMarkers(objects, altitude, azimuth, selectedId, limit = 80) {
  return objects.filter(o => Number.isFinite(o.alt) && Number.isFinite(o.az) && o.alt >= 0 && o.overlayEligible !== false)
    .sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) ||
      angularSep(altitude, azimuth, a.alt, a.az) - angularSep(altitude, azimuth, b.alt, b.az))
    .slice(0, limit);
}
