// sky.js — stars (HYG J2000 catalog) + Sun/Moon/planets (astronomy-engine).
import { D2R, lstDeg, norm360 } from './astro.js';

// astronomy-engine: vendored locally, pinned CDN fallback (see index.html loader)
const AE = await (window.__aeReady || import('../vendor/astronomy.js'));

let stars = []; // {raH, dec, mag, name, ra15deg, sd, cd}
export const starCount = () => stars.length;

export async function loadStars(url = 'data/stars.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('stars.json ' + res.status);
  const j = await res.json();
  stars = j.stars.map(([ra, dec, mag, name]) => ({
    raH: ra, dec, mag, name: name || null,
    ra15: ra * 15, sd: Math.sin(dec * D2R), cd: Math.cos(dec * D2R),
  }));
  return stars.length;
}

// Fast per-frame path: ENU components per star from cached sin/cos(dec).
// Returns array of {alt, az, mag, name} for stars above the horizon band and within magLimit.
export function visibleStars(date, latDeg, lonDeg, magLimit, minAlt = -6) {
  const lst = lstDeg(date, lonDeg);
  const lat = latDeg * D2R, sl = Math.sin(lat), cl = Math.cos(lat);
  const out = [];
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    if (s.mag > magLimit) continue;
    const H = (lst - s.ra15) * D2R;
    const sH = Math.sin(H), cH = Math.cos(H);
    const up = s.sd * sl + s.cd * cl * cH;
    if (up < Math.sin(minAlt * D2R)) continue;
    const east = -s.cd * sH;
    const north = s.sd * cl - s.cd * sl * cH;
    out.push({ alt: Math.asin(up > 1 ? 1 : up < -1 ? -1 : up) / D2R, az: norm360(Math.atan2(east, north) / D2R), mag: s.mag, name: s.name });
  }
  return out;
}

const BODIES = [
  { id: 'Sun', kind: 'sun' },
  { id: 'Moon', kind: 'moon' },
  { id: 'Mercury', kind: 'planet' }, { id: 'Venus', kind: 'planet' }, { id: 'Mars', kind: 'planet' },
  { id: 'Jupiter', kind: 'planet' }, { id: 'Saturn', kind: 'planet' },
  { id: 'Uranus', kind: 'planet' }, { id: 'Neptune', kind: 'planet' },
];

// Slower path (VSOP ephemerides) — call at ~1 Hz, not per frame.
export function computeBodies(date, latDeg, lonDeg) {
  const time = AE.MakeTime(date);
  const obs = new AE.Observer(latDeg, lonDeg, 0);
  const out = [];
  for (const b of BODIES) {
    try {
      const eq = AE.Equator(b.id, time, obs, true, true);
      const h = AE.Horizon(time, obs, eq.ra, eq.dec, null);
      let mag = null, phase = null;
      if (b.kind === 'planet' || b.kind === 'moon') {
        try { const il = AE.Illumination(b.id, time); mag = il.mag; phase = il.phase_fraction; } catch { /* Sun has no illumination */ }
      }
      out.push({ name: b.id, kind: b.kind, alt: h.altitude, az: h.azimuth, mag, phase });
    } catch { /* body not computable — skip */ }
  }
  return out;
}

// Sun altitude only — drives the time-adaptive chrome (day/dusk/night).
export function sunAltitude(date, latDeg, lonDeg) {
  const time = AE.MakeTime(date);
  const obs = new AE.Observer(latDeg, lonDeg, 0);
  const eq = AE.Equator('Sun', time, obs, true, true);
  return AE.Horizon(time, obs, eq.ra, eq.dec, null).altitude;
}
