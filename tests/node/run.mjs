// SkyLens node test suite — math vs astronomy-engine oracle, SGP4 structural checks,
// projection/attitude fixed cases, data integrity, stress timings.
// Run: node tests/node/run.mjs   (exit code = number of failures)
// Note: needs vendor libs present (vendor/astronomy.js, vendor/satellite.esm.js) — see vendor/README.md.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const sat = await import('../../vendor/satellite.esm.js');
const X = await import('../../js/astro.js');
const AE = await import('../../vendor/astronomy.js');
const { parseTLE } = await import('../../js/satellites.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const starCat = JSON.parse(readFileSync(path.join(root, 'data/stars.json'), 'utf8'));
const snapshot = JSON.parse(readFileSync(path.join(root, 'data/tle-snapshot.json'), 'utf8'));

let pass = 0, fail = 0;
const T = (name, cond, info = '') => {
  if (cond) { pass++; console.log('ok   ', name, info); }
  else { fail++; console.log('FAIL ', name, info); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---------- attitude fixed cases ---------- */
let r = X.attitudeFromSensors(0, 90, 0, 0);
T('attitude portrait north → az 0 alt 0', near(r.az, 0, 0.5) && near(r.alt, 0, 0.5), `az=${r.az.toFixed(2)} alt=${r.alt.toFixed(2)}`);
r = X.attitudeFromSensors(90, 90, 0, 0);
T('attitude α=90 → west az 270', near(r.az, 270, 0.5), `az=${r.az.toFixed(2)}`);
r = X.attitudeFromSensors(270, 90, 0, 0);
T('attitude α=270 → east az 90', near(r.az, 90, 0.5), `az=${r.az.toFixed(2)}`);
r = X.attitudeFromSensors(0, 0, 0, 0);
T('attitude flat screen-up → alt −90', near(r.alt, -90, 0.5), `alt=${r.alt.toFixed(2)}`);
r = X.attitudeFromSensors(45, 90, 0, 90);
T('screen rotation 90° preserves boresight az', near(r.az, 315, 0.5) && near(r.alt, 0, 0.5), `az=${r.az.toFixed(2)}`);
r = X.attitudeFromSensors(0, 45, 0, 0);
T('attitude β=45 → alt −45 (tilted forward)', near(r.alt, -45, 0.5), `alt=${r.alt.toFixed(2)}`);

/* ---------- sky coordinates ---------- */
const d = new Date('2026-10-03T22:00:00Z');
for (const lat of [20, 51.5, -30]) {
  const p = X.radecToAltAz(2.52975, 89.26411, lat, 0, d);
  if (lat > 0) T(`Polaris @${lat}°: alt≈lat, az≈0`, near(p.alt, lat, 1.0) && (p.az < 1.5 || p.az > 358.5), `alt=${p.alt.toFixed(2)} az=${p.az.toFixed(2)}`);
  else T('Polaris below horizon in S hemisphere', p.alt < lat + 1.5, `alt=${p.alt.toFixed(2)}`);
}
{
  const p = X.radecToAltAz(2.52975, 89.26411, 89.9, 100, d);
  T('Polaris @89.9°: alt≈lat (az degenerate)', near(p.alt, 89.9, 1.0), `alt=${p.alt.toFixed(2)}`);
}
{
  const ra = X.gmstHours(d), m = X.radecToAltAz(ra, 20, 40, 0, d);
  T('meridian transit alt=70 az=180', near(m.alt, 70, 0.05) && near(m.az, 180, 0.05), `alt=${m.alt.toFixed(2)} az=${m.az.toFixed(2)}`);
}

/* ---------- cross-check vs astronomy-engine ---------- */
{
  let maxd = 0;
  for (let i = 0; i < 50; i++) {
    const t = new Date(Date.UTC(2020 + (i % 10), i % 12, (i % 27) + 1, i % 24, (13 * i) % 60));
    let dd = Math.abs(X.gmstHours(t) - AE.SiderealTime(t));
    dd = Math.min(dd, 24 - dd);
    maxd = Math.max(maxd, dd);
  }
  T('GMST vs SiderealTime < 0.005 h', maxd < 0.005, `max=${maxd.toFixed(5)} h`);
}
{
  let worst = 0;
  for (let i = 0; i < 80; i++) {
    const t = new Date(Date.UTC(2026, i % 12, (i % 27) + 1, i % 24, (7 * i) % 60));
    const lat = -60 + ((i * 37) % 120), lon = -170 + ((i * 53) % 340);
    const raH = (i * 0.73) % 24, dec = -70 + ((i * 29) % 140);
    const o = new AE.Observer(lat, lon, 0);
    const h = AE.Horizon(AE.MakeTime(t), o, raH, dec, null);
    const mine = X.radecToAltAz(raH, dec, lat, lon, t);
    let daz = Math.abs(mine.az - h.azimuth); daz = Math.min(daz, 360 - daz);
    if (Math.abs(h.altitude) > 80) daz = 0; // az degenerate near zenith/nadir
    worst = Math.max(worst, daz, Math.abs(mine.alt - h.altitude));
  }
  T('alt/az vs Horizon (80 cases) < 0.6°', worst < 0.6, `worst=${worst.toFixed(3)}°`);
}

/* ---------- projection ---------- */
{
  const basis = X.makeBasis(0, 0), tanH = Math.tan(30 * X.D2R), tanV = tanH * 9 / 16;
  const pc = X.projectVec(X.vecFromAltAz(0, 0), basis, tanH, tanV, 800, 450);
  T('projection center→center', near(pc.x, 400, 0.5) && near(pc.y, 225, 0.5));
  const pr = X.projectVec(X.vecFromAltAz(0, 30), basis, tanH, tanV, 800, 450);
  T('projection +30° az → right edge', near(pr.x, 800, 2), `x=${pr.x.toFixed(1)}`);
  T('projection behind → culled', X.projectVec(X.vecFromAltAz(0, 180), basis, tanH, tanV, 800, 450) === null);
  T('projection zenith with fallback basis', X.projectVec(X.vecFromAltAz(89.9, 10), X.makeBasis(0, 90), tanH, tanV, 800, 450) !== null);
}

/* ---------- planes geometry ---------- */
{
  const pl = X.planeAltAz(40, 0, 41, 0, 10668);
  T('plane due north az≈0, alt≈5°', pl.az < 0.5 && near(pl.alt, 5.0, 0.6), `az=${pl.az.toFixed(2)} alt=${pl.alt.toFixed(2)}`);
  const pl2 = X.planeAltAz(0, 0, 0, 0.5, 12000);
  T('plane due east az≈90', near(pl2.az, 90, 0.5), `az=${pl2.az.toFixed(2)}`);
  const pl3 = X.planeAltAz(40, 0, 40, 0, 10000);
  T('plane overhead → alt≈90', pl3.alt > 80, `alt=${pl3.alt.toFixed(2)}`);
}

/* ---------- data integrity ---------- */
{
  const s = starCat.stars;
  const sorted = s.every((v, i) => i === 0 || s[i - 1][2] <= v[2]);
  const ranges = s.every((v) => v[0] >= 0 && v[0] < 24 && v[1] >= -90 && v[1] <= 90 && v[2] <= 4.61);
  T('stars.json: >900 stars, sorted, valid ranges', s.length > 900 && sorted && ranges, `${s.length} stars`);
}
{
  const list = parseTLE(snapshot.satellites.map((s) => `${s.name}\n${s.l1}\n${s.l2}`).join('\n'));
  T('tle-snapshot.json: ≥150 parseable', list.length >= 150, `${list.length}`);
}

/* ---------- SGP4 structural checks ---------- */
{
  const list = parseTLE(snapshot.satellites.map((s) => `${s.name}\n${s.l1}\n${s.l2}`).join('\n'));
  const recs = list.map((s) => { try { return { name: s.name, rec: sat.twoline2satrec(s.l1, s.l2) }; } catch { return null; } }).filter(Boolean);
  T('snapshot: all recs build', recs.length >= 150, `${recs.length} recs`);
  const now = new Date();
  const pv = sat.propagate(recs[0].rec, now);
  const rr = Math.hypot(pv.position.x, pv.position.y, pv.position.z);
  T(`SGP4: ${recs[0].name} radius in LEO bounds`, rr > 6500 && rr < 7200, `|r|=${rr.toFixed(0)} km`);
  const gmst = sat.gstime(now);
  const look = sat.ecfToLookAngles({ longitude: 0, latitude: 0.9, height: 0 }, sat.eciToEcf(pv.position, gmst));
  T('SGP4: look-angle ranges valid', look.elevation >= -Math.PI / 2 - 1e-6 && look.elevation <= Math.PI / 2 + 1e-6 && look.rangeSat > 0);
  const okEpoch = [-12, 12].every((dh) => {
    const p2 = sat.propagate(recs[0].rec, new Date(now.getTime() + dh * 3600e3));
    return p2 && p2.position && Number.isFinite(p2.position.x);
  });
  T('SGP4: propagate epoch ±12 h finite', okEpoch);
  let threw = false;
  try {
    const bad = sat.twoline2satrec('1 garbage', '2 garbage');
    const pvBad = sat.propagate(bad, now);
    threw = !pvBad || !pvBad.position || !Number.isFinite(pvBad.position.x);
  } catch { threw = true; }
  T('SGP4: malformed TLE safely rejected', threw);

  /* ---------- stress S1 ---------- */
  const synth = [];
  for (let i = 0; i < 18; i++) synth.push(...recs);
  const t0 = performance.now();
  for (let step = 0; step < 30; step++) {
    const t = new Date(now.getTime() + step * 2000);
    const g = sat.gstime(t);
    const obsGd = { longitude: 0, latitude: 0.9, height: 0 };
    for (const { rec } of synth) {
      try {
        const p = sat.propagate(rec, t);
        if (p?.position) sat.ecfToLookAngles(obsGd, sat.eciToEcf(p.position, g));
      } catch { /* decayed */ }
    }
  }
  const ms = performance.now() - t0;
  T(`S1 stress: ${synth.length} sats × 30 steps < 10 s`, ms < 10000, `${ms.toFixed(0)} ms (${(ms / 30 / synth.length * 1000).toFixed(2)} µs/sat/step)`);
}

console.log(`\nRESULT ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
