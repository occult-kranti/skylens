// astro.js — pure math core: time, coordinates, attitude, projection.
// No DOM access; imported by the browser app, the in-browser self-test, and the node test suite.
//
// Vector frame for attitude/projection (right-handed): x = East, y = Up, z = South.
// Azimuth convention everywhere: degrees, 0 = North, increasing clockwise (90 = East).

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const J2000 = 2451545.0;
export const EARTH_R_M = 6371000;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const norm360 = (d) => ((d % 360) + 360) % 360;
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* ---------------- time ---------------- */

export function julian(date) { return date.getTime() / 86400000 + 2440587.5; }

// Greenwich Mean Sidereal Time in hours (low-precision IAU formula, ±0.1 s).
export function gmstHours(date) {
  const d = julian(date) - J2000;
  let g = (18.697374558 + 24.06570982441908 * d) % 24;
  return g < 0 ? g + 24 : g;
}

// Local sidereal time in degrees.
export function lstDeg(date, lonDeg) { return norm360(gmstHours(date) * 15 + lonDeg); }

/* ------------- sky coordinates ------------- */

// RA/Dec (J2000 or of-date) → topocentric Alt/Az. raH in hours, dec/lat/lon in degrees.
export function radecToAltAz(raH, decDeg, latDeg, lonDeg, date) {
  const H = (lstDeg(date, lonDeg) - raH * 15) * D2R;
  const dec = decDeg * D2R, lat = latDeg * D2R;
  const sd = Math.sin(dec), cd = Math.cos(dec), sl = Math.sin(lat), cl = Math.cos(lat);
  const sH = Math.sin(H), cH = Math.cos(H);
  const up = sd * sl + cd * cl * cH;
  const east = -cd * sH;
  const north = sd * cl - cd * sl * cH;
  return { alt: Math.asin(clamp(up, -1, 1)) * R2D, az: norm360(Math.atan2(east, north) * R2D) };
}

// Alt/Az (deg) → unit vector in [E, U, S] frame.
export function vecFromAltAz(altDeg, azDeg) {
  const a = altDeg * D2R, z = azDeg * D2R;
  return [Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z)];
}

export function altAzFromVec(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return { alt: Math.asin(clamp(v[1] / n, -1, 1)) * R2D, az: norm360(Math.atan2(v[0], -v[2]) * R2D) };
}

/* ------------- device attitude (quaternions) ------------- */

function qAxisAngle(axis, rad) {
  const s = Math.sin(rad / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(rad / 2)]; // [x,y,z,w]
}

function qMul(a, b) { // a*b — composite rotation applying b first
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function qRot(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

// W3C deviceorientation (α,β,γ intrinsic Z-X'-Y'', α counterclockwise from North)
// + screen orientation angle → camera basis vectors + boresight alt/az.
// Recipe mirrors three.js DeviceOrientationControls (battle-tested on iOS/Android).
export function attitudeFromSensors(alphaDeg, betaDeg, gammaDeg, orientDeg) {
  const a = (alphaDeg || 0) * D2R, b = (betaDeg || 0) * D2R, g = (gammaDeg || 0) * D2R, o = (orientDeg || 0) * D2R;
  let q = qMul(qMul(qAxisAngle([0, 1, 0], a), qAxisAngle([1, 0, 0], b)), qAxisAngle([0, 0, 1], -g));
  q = qMul(q, qAxisAngle([1, 0, 0], -Math.PI / 2));
  q = qMul(q, qAxisAngle([0, 0, 1], -o));
  const fwd = qRot(q, [0, 0, -1]);   // camera boresight (device -z)
  const right = qRot(q, [1, 0, 0]);  // screen right
  const up = qRot(q, [0, 1, 0]);     // screen up
  const { alt, az } = altAzFromVec(fwd);
  return { fwd, right, up, az, alt };
}

/* ------------- gnomonic projection to screen pixels ------------- */

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function makeBasis(azDeg, altDeg) {
  // manual-mode basis: zero roll — right = cross(fwd, worldUp), up = cross(right, fwd)
  const fwd = vecFromAltAz(altDeg, azDeg);
  let right = cross(fwd, [0, 1, 0]);
  const rn = Math.hypot(right[0], right[1], right[2]);
  right = rn < 1e-4 ? [1, 0, 0] : right.map((c) => c / rn); // looking straight up/down: pick East
  const up = cross(right, fwd);
  return { fwd, right, up };
}

export function projectVec(v, basis, tanHalfHfov, tanHalfVfov, w, h) {
  const zf = vdot(v, basis.fwd);
  if (zf <= 0.15) return null; // behind or grazing the view plane
  const x = vdot(v, basis.right) / zf / tanHalfHfov;
  const y = vdot(v, basis.up) / zf / tanHalfVfov;
  if (Math.abs(x) > 1.25 || Math.abs(y) > 1.25) return null; // outside FOV (+ margin)
  return { x: w / 2 + x * (w / 2), y: h / 2 - y * (h / 2), depth: zf };
}

/* ------------- aircraft geometry ------------- */

// Great-circle bearing + apparent altitude (with Earth-curvature drop, no refraction).
export function planeAltAz(lat1, lon1, lat2, lon2, altM) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
  const central = Math.acos(clamp(Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl), -1, 1));
  const d = central * EARTH_R_M;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const az = norm360(Math.atan2(y, x) * R2D);
  const drop = (d * d) / (2 * EARTH_R_M);
  const alt = Math.atan2(altM - drop, Math.max(d, 1)) * R2D;
  return { alt, az, distKm: d / 1000 };
}

/* ------------- misc ------------- */

export function angularSep(a1, z1, a2, z2) { // degrees
  const v1 = vecFromAltAz(a1, z1), v2 = vecFromAltAz(a2, z2);
  return Math.acos(clamp(vdot(v1, v2), -1, 1)) * R2D;
}

export function fmtDeg(d, digits = 1) { return d.toFixed(digits) + '°'; }
export function fmtAlt(alt) { return (alt >= 0 ? '+' : '−') + Math.abs(alt).toFixed(1) + '°'; }
export function compass16(az) {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return names[Math.round(az / 22.5) % 16];
}
