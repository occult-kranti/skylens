// Shared astronomy adapter. Fixed catalogues are J2000; rotation includes precession/nutation.
import { D2R, norm360, radecToAltAz } from './astro.js';

let AE = null;
export const engineReady = Promise.resolve(globalThis.__aeReady || import('../vendor/astronomy.js'))
  .then((engine) => { AE = engine; return engine; }).catch(() => null);
export const engineAvailable = () => !!AE;
let stars = [];
export const starCount = () => stars.length;

export async function loadStars(url = 'data/stars.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('stars.json ' + res.status);
  const j = await res.json();
  stars = j.stars.filter(([ra, dec, mag]) => [ra, dec, mag].every(Number.isFinite))
    .map(([ra, dec, mag, name], index) => ({ id: `star:${index}`, raH: ra, dec, mag, name: name || null }));
  return stars.length;
}

// Rotation_EQJ_HOR's frame is [north, west, zenith], not our camera [east, up, south].
// One matrix per observer/time, then only trigonometry per catalogue point.
export function horizontalProjector(date, lat, lon, refraction = false) {
  if (!AE) return (ra, dec) => radecToAltAz(ra, dec, lat, lon, date);
  const r = AE.Rotation_EQJ_HOR(date, new AE.Observer(lat, lon, 0)).rot;
  return (raH, decDeg) => {
    const a = raH * 15 * D2R, d = decDeg * D2R;
    const x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d);
    const north = r[0][0] * x + r[1][0] * y + r[2][0] * z;
    const west = r[0][1] * x + r[1][1] * y + r[2][1] * z;
    const up = r[0][2] * x + r[1][2] * y + r[2][2] * z;
    let alt = Math.atan2(up, Math.hypot(north, west)) / D2R;
    if (refraction) alt += AE.Refraction('normal', alt);
    return { alt, az: norm360(Math.atan2(-west, north) / D2R) };
  };
}

// Call at 1 Hz; use minAlt=-90 for accessible search, including below-horizon targets.
export function visibleStars(date, lat, lon, magLimit = 4.6, minAlt = -6, refraction = false) {
  const project = horizontalProjector(date, lat, lon, refraction);
  return stars.filter(s => s.mag <= magLimit).map(s => ({ ...s, kind: 'star', ...project(s.raH, s.dec) }))
    .filter(s => s.alt >= minAlt);
}

export const BODIES = [
  { id: 'Sun', kind: 'sun' }, { id: 'Moon', kind: 'moon' },
  ...['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].map(id => ({ id, kind: 'planet' })),
];

export function computeBodies(date, lat, lon, refraction = false) {
  if (!AE) return [];
  const time = AE.MakeTime(date), obs = new AE.Observer(lat, lon, 0);
  return BODIES.flatMap(b => {
    try {
      const eq = AE.Equator(b.id, time, obs, true, true);
      const h = AE.Horizon(time, obs, eq.ra, eq.dec, refraction ? 'normal' : null);
      const illumination = b.kind === 'sun' ? null : AE.Illumination(b.id, time);
      return [{ id: `body:${b.id}`, name: b.id, kind: b.kind, alt: h.altitude, az: h.azimuth,
        mag: illumination?.mag ?? null, phase: illumination?.phase_fraction ?? null }];
    } catch { return []; }
  });
}

export function sunAltitude(date, lat, lon) {
  return computeBodies(date, lat, lon).find(b => b.kind === 'sun')?.alt ?? -30;
}
