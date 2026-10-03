// events.js — "Tonight" engine: sun/moon events, planet visibility metrics, meteor showers.
// All functions take the astronomy-engine namespace (AE) explicitly → node-testable.
import { D2R, radecToAltAz, norm360 } from './astro.js';

const fmtTime = (t) => t ? t.toISOString().slice(5, 16).replace('T', ' ') + ' UTC' : null;

/* ---------- Sun ---------- */

// sunrise/sunset via SearchRiseSet; astronomical darkness (Sun ≤ −18°) via coarse scan.
export function sunEvents(AE, date, latDeg, lonDeg) {
  const obs = new AE.Observer(latDeg, lonDeg, 0);
  const t0 = AE.MakeTime(date);
  let sunrise = null, sunset = null;
  try {
    const r = AE.SearchRiseSet('Sun', obs, +1, t0, 1);
    const s = AE.SearchRiseSet('Sun', obs, -1, t0, 1);
    sunrise = r && r.date; sunset = s && s.date;
  } catch { /* circumpolar */ }
  // Geometric solar centre crossing −18°, not a 20-minute sampling approximation.
  const eq = AE.Equator('Sun', t0, obs, true, true);
  const darkNow = AE.Horizon(t0, obs, eq.ra, eq.dec, null).altitude <= -18;
  const dusk = AE.SearchAltitude('Sun', obs, -1, t0, 2, -18);
  const start = darkNow ? t0 : dusk;
  const dawn = start ? AE.SearchAltitude('Sun', obs, +1, start, 2, -18) : null;
  return { sunrise: fmtTime(sunrise), sunset: fmtTime(sunset), darkStart: darkNow ? 'Already dark' : fmtTime(dusk?.date), darkEnd: fmtTime(dawn?.date), darkNow,
    note: 'Rise/set: next 24 h; astronomical darkness: Sun below −18°, next 48 h. No crossing can occur at high latitude.' };
}

/* ---------- Moon ---------- */

const QUARTER_NAMES = ['New moon', 'First quarter', 'Full moon', 'Last quarter'];
const PHASE_NAMES = ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

export function moonEvents(AE, date) {
  const t = AE.MakeTime(date);
  let phaseDeg = null, illum = null;
  try {
    phaseDeg = AE.MoonPhase(t);
    illum = AE.Illumination('Moon', t).phase_fraction;
  } catch { /* leave null */ }
  const phaseName = phaseDeg == null ? null : PHASE_NAMES[Math.round(phaseDeg / 45) % 8];
  const quarters = [];
  try {
    let start = t;
    for (let i = 0; i < 4; i++) {
      const q = AE.SearchMoonQuarter(start);
      quarters.push({ name: QUARTER_NAMES[q.quarter], date: q.time.date, day: q.time.date.toISOString().slice(5, 10) });
      start = AE.MakeTime(new Date(q.time.date.getTime() + 3600e3));
    }
  } catch { /* rare */ }
  return { phaseName, illum, quarters };
}

/* ---------- Planets ---------- */

const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export function planetEvents(AE, date, latDeg, lonDeg) {
  const obs = new AE.Observer(latDeg, lonDeg, 0);
  const t0 = AE.MakeTime(date);
  const out = [];
  for (const name of PLANETS) {
    try {
      const eq = AE.Equator(name, t0, obs, true, true);
      const h = AE.Horizon(t0, obs, eq.ra, eq.dec, null);
      const il = AE.Illumination(name, t0);
      const el = AE.Elongation(name, t0);
      const rise = AE.SearchRiseSet(name, obs, +1, t0, 1);
      const set = AE.SearchRiseSet(name, obs, -1, t0, 1);
      // ecliptic_separation > 0 → east of Sun → visible after sunset (evening)
      const vis = el?.visibility || null;
      const transit = AE.SearchHourAngle(name, obs, 0, t0, +1);
      out.push({
        name, alt: h.altitude, az: h.azimuth, mag: il.mag,
        elong: el ? el.elongation : null, visibility: vis,
        rise: fmtTime(rise && rise.date), set: fmtTime(set && set.date), transit: fmtTime(transit?.time.date),
        up: h.altitude > 0,
      });
    } catch { /* skip body */ }
  }
  return out;
}

/* ---------- Meteor showers (annual static table) ---------- */

// [name, peakMonth, peakDay, windowDays±, radiantRaH, radiantDec, ZHR]
export const METEORS = [
  ['Quadrantids', 1, 4, 4, 15.28, 49.5, 80],
  ['Lyrids', 4, 22, 4, 18.07, 33.5, 18],
  ['Eta Aquariids', 5, 5, 7, 22.53, -1.5, 50],
  ['S. Delta Aquariids', 7, 30, 7, 22.70, -16.3, 25],
  ['Perseids', 8, 12, 14, 3.07, 57.7, 100],
  ['Draconids', 10, 8, 2, 17.47, 54.0, 10],
  ['Orionids', 10, 21, 7, 6.33, 15.8, 20],
  ['S. Taurids', 11, 5, 14, 3.63, 14.4, 7],
  ['Leonids', 11, 17, 4, 10.25, 21.8, 15],
  ['Geminids', 12, 14, 7, 7.48, 32.3, 150],
  ['Ursids', 12, 22, 3, 14.47, 74.7, 10],
];

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const doy = (m, d) => MONTH_DAYS.slice(0, m - 1).reduce((a, b) => a + b, 0) + d;

// Returns showers sorted by proximity to peak; `active` = inside window.
export function activeShowers(date, latDeg = null, lonDeg = null) {
  const utcM = date.getUTCMonth() + 1, utcD = date.getUTCDate();
  const today = doy(utcM, utcD);
  return METEORS.map(([name, pm, pd, win, raH, dec, zhr]) => {
    let diff = doy(pm, pd) - today;
    if (diff > 183) diff -= 365; if (diff < -183) diff += 365; // wrap year
    const item = {
      name, zhr, raH, dec,
      peak: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][pm - 1]} ${pd}`,
      daysToPeak: diff, active: Math.abs(diff) <= win, peaking: Math.abs(diff) <= 1,
      alt: null, az: null,
    };
    if (latDeg != null && lonDeg != null) {
      const p = radecToAltAz(raH, dec, latDeg, lonDeg, date);
      item.alt = p.alt; item.az = p.az;
    }
    return item;
  }).sort((a, b) => Math.abs(a.daysToPeak) - Math.abs(b.daysToPeak));
}
