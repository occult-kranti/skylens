// WGS84 geographic -> ECEF (EPSG9602), then local ENU (ESA Navipedia).
// Geometry is exact for the supplied ellipsoid coordinates; input telemetry,
// pressure-altitude substitution and short motion estimates are not exact.
// References checked 2026-10-05:
// https://epsg.io/9602-method
// https://gssc.esa.int/navipedia/index.php/Transformations_between_ECEF_and_ENU_coordinates
export const WGS84 = Object.freeze({ a: 6378137, f: 1 / 298.257223563 });
export const MAX_POSITION_AGE_MS = 60000, MAX_EXTRAPOLATION_SECONDS = 15;
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const E2 = WGS84.f * (2 - WGS84.f), B = WGS84.a * (1 - WGS84.f);
const wrap = x => ((x % 360) + 360) % 360;
function coordinates(lat, lon, height = 0) {
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || !Number.isFinite(height) || height < -2000 || height > 100000) throw new RangeError('Invalid WGS84 coordinates or ellipsoid height.');
}
export function geodeticToECEF(lat, lon, heightM = 0) {
  coordinates(lat, lon, heightM);
  const p = lat * RAD, l = lon * RAD, s = Math.sin(p), c = Math.cos(p);
  const n = WGS84.a / Math.sqrt(1 - E2 * s * s);
  return { x: (n + heightM) * c * Math.cos(l), y: (n + heightM) * c * Math.sin(l), z: (n * (1 - E2) + heightM) * s };
}
function basis(lat, lon) {
  const p = lat * RAD, l = lon * RAD, sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
  return { east: [-sl, cl, 0], north: [-sp * cl, -sp * sl, cp], up: [cp * cl, cp * sl, sp] };
}
export function ecefToENU(delta, lat, lon) {
  coordinates(lat, lon);
  if (!delta || !['x', 'y', 'z'].every(k => Number.isFinite(delta[k]))) throw new RangeError('ECEF vector must be finite metres.');
  const b = basis(lat, lon), dot = v => v[0] * delta.x + v[1] * delta.y + v[2] * delta.z;
  return { east: dot(b.east), north: dot(b.north), up: dot(b.up) };
}
function fromECEF({ x, y, z }) {
  const radius = Math.hypot(x, y);
  if (radius < 1e-8) return { lat: z < 0 ? -90 : 90, lon: 0, heightM: Math.abs(z) - B };
  let p = Math.atan2(z, radius * (1 - E2));
  for (let i = 0; i < 12; i++) {
    const n = WGS84.a / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
    const next = Math.atan2(z + E2 * n * Math.sin(p), radius);
    if (Math.abs(next - p) < 1e-14) { p = next; break; }
    p = next;
  }
  const n = WGS84.a / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
  return { lat: p * DEG, lon: Math.atan2(y, x) * DEG, heightM: radius / Math.cos(p) - n };
}
// Vincenty's inverse ellipsoid distance. Nearby queries are <=250nm; very distant
// antipodal nonconvergence returns Infinity and is excluded, never fabricated.
export function groundDistanceM(a, b) {
  coordinates(a.lat, a.lon); coordinates(b.lat, b.lon);
  const u1 = Math.atan((1 - WGS84.f) * Math.tan(a.lat * RAD)), u2 = Math.atan((1 - WGS84.f) * Math.tan(b.lat * RAD));
  const s1 = Math.sin(u1), c1 = Math.cos(u1), s2 = Math.sin(u2), c2 = Math.cos(u2);
  const L = ((b.lon - a.lon + 540) % 360 - 180) * RAD;
  let lambda = L, sinSigma, cosSigma, sigma, sinAlpha, cosSqAlpha, cos2SigmaM, converged = false;
  for (let i = 0; i < 80; i++) {
    sinSigma = Math.hypot(c2 * Math.sin(lambda), c1 * s2 - s1 * c2 * Math.cos(lambda));
    cosSigma = s1 * s2 + c1 * c2 * Math.cos(lambda);
    if (sinSigma < 1e-15) return cosSigma > 0 ? 0 : Infinity;
    sigma = Math.atan2(sinSigma, cosSigma); sinAlpha = c1 * c2 * Math.sin(lambda) / sinSigma;
    cosSqAlpha = Math.max(0, 1 - sinAlpha * sinAlpha);
    cos2SigmaM = cosSqAlpha > 1e-15 ? cosSigma - 2 * s1 * s2 / cosSqAlpha : 0;
    const C = WGS84.f / 16 * cosSqAlpha * (4 + WGS84.f * (4 - 3 * cosSqAlpha));
    const next = L + (1 - C) * WGS84.f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    if (Math.abs(next - lambda) < 1e-12) { converged = true; break; }
    lambda = next;
  }
  if (!converged) return Infinity;
  const uSq = cosSqAlpha * (WGS84.a ** 2 - B ** 2) / B ** 2;
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const C = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const delta = C * sinSigma * (cos2SigmaM + C / 4 * (cosSigma * (-1 + 2 * cos2SigmaM ** 2) - C / 6 * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
  return B * A * (sigma - delta);
}
function lookECEF(observer, targetECEF, target) {
  const observerHeightM = observer.heightM ?? 0;
  const origin = geodeticToECEF(observer.lat, observer.lon, observerHeightM);
  const enu = ecefToENU({ x: targetECEF.x - origin.x, y: targetECEF.y - origin.y, z: targetECEF.z - origin.z }, observer.lat, observer.lon);
  const horizontal = Math.hypot(enu.east, enu.north), slantM = Math.hypot(horizontal, enu.up);
  return { alt: slantM < 1e-7 ? null : Math.atan2(enu.up, horizontal) * DEG,
    az: horizontal < 1e-7 ? 0 : wrap(Math.atan2(enu.east, enu.north) * DEG), azimuthDefined: horizontal >= 1e-7,
    distKm: groundDistanceM(observer, target) / 1000, slantKm: slantM / 1000,
    observerHeightM, observerHeightKind: observer.heightM == null ? 'assumed-zero' : 'provided-ellipsoid', geometryMethod: 'wgs84-ecef-enu' };
}
export function aircraftLook(observer, target) {
  return lookECEF(observer, geodeticToECEF(target.lat, target.lon, target.heightM), target);
}
export function projectAircraft(report, observer, now) {
  if (!Number.isFinite(now) || !Number.isFinite(report.positionAt)) return null;
  const age = now - report.positionAt;
  if (age < -5000 || age > MAX_POSITION_AGE_MS) return null;
  const positionAgeMs = Math.max(0, age), origin = geodeticToECEF(report.lat, report.lon, report.altM);
  const speed = report.gsKt, track = report.track;
  const canPredict = Number.isFinite(speed) && speed >= 0 && speed <= 1500 && Number.isFinite(track) && track >= 0 && track < 360;
  const dt = canPredict ? Math.min(MAX_EXTRAPOLATION_SECONDS, positionAgeMs / 1000) : 0;
  let target = { lat: report.lat, lon: report.lon, heightM: report.altM }, point = origin;
  if (dt) {
    const b = basis(report.lat, report.lon), mps = speed * 1852 / 3600;
    const east = mps * Math.sin(track * RAD), north = mps * Math.cos(track * RAD);
    const up = Number.isFinite(report.verticalRateFpm) && Math.abs(report.verticalRateFpm) <= 12000 ? report.verticalRateFpm * .3048 / 60 : 0;
    const v = i => b.east[i] * east + b.north[i] * north + b.up[i] * up;
    point = { x: origin.x + dt * v(0), y: origin.y + dt * v(1), z: origin.z + dt * v(2) };
    target = fromECEF(point);
  }
  const geometry = lookECEF(observer, point, target);
  if (!Number.isFinite(geometry.alt) || !Number.isFinite(geometry.distKm)) return null;
  return { ...report, ...geometry, positionAgeMs, positionMode: dt > 0 ? positionAgeMs > 15000 ? 'estimate-paused' : 'extrapolated' : 'reported', extrapolatedSeconds: dt, overlayEligible: positionAgeMs <= 20000,
    projectedLat: target.lat, projectedLon: target.lon, projectedAltitudeM: target.heightM,
    freshness: positionAgeMs <= 15000 ? 'recent' : 'ageing',
    motionNote: dt > 0 ? 'At most 15s of constant true-track/ground-speed motion; turns and acceleration are unknown. Estimate pauses after 15s.' : 'Reported location, not a current-position guarantee.' };
}
