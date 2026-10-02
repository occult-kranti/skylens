// objects.js — constellation lines/labels and Messier deep-sky objects.
// Data: d3-celestial (BSD, © Olaf Frohn), converted to compact {ra hours, dec deg} form.
import { D2R, lstDeg, norm360 } from './astro.js';

let constellations = [];
let dsos = [];

export const counts = () => ({ constellations: constellations.length, dsos: dsos.length });

export async function loadConstellations(url = 'data/constellations.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error('constellations.json ' + r.status);
  constellations = await r.json();
  return constellations.length;
}

export async function loadDSOs(url = 'data/dsos.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error('dsos.json ' + r.status);
  dsos = await r.json();
  return dsos.length;
}

// RA/Dec(hours,deg) → alt/az with cached per-call lst/lat terms (same fast path as sky.js).
function projector(date, latDeg, lonDeg) {
  const lst = lstDeg(date, lonDeg);
  const lat = latDeg * D2R, sl = Math.sin(lat), cl = Math.cos(lat);
  return (raH, decDeg) => {
    const sd = Math.sin(decDeg * D2R), cd = Math.cos(decDeg * D2R);
    const H = (lst - raH * 15) * D2R;
    const up = sd * sl + cd * cl * Math.cos(H);
    const east = -cd * Math.sin(H);
    const north = sd * cl - cd * sl * Math.cos(H);
    return { alt: Math.asin(up > 1 ? 1 : up < -1 ? -1 : up) / D2R, az: norm360(Math.atan2(east, north) / D2R) };
  };
}

// Per-frame conversion. Lines: segments of [alt, az]; labels only above horizon.
export function constellationFrame(date, latDeg, lonDeg) {
  const toAA = projector(date, latDeg, lonDeg);
  const out = [];
  for (const c of constellations) {
    const segs = c.lines.map((seg) => seg.map(([ra, dec]) => { const p = toAA(ra, dec); return [p.alt, p.az]; }));
    const label = c.label ? toAA(c.label[0], c.label[1]) : null;
    out.push({ name: c.name, id: c.id, segs, label: label && label.alt > -5 ? { ...label, name: c.name } : null });
  }
  return out;
}

export function dsoFrame(date, latDeg, lonDeg, magLimit = 10) {
  const toAA = projector(date, latDeg, lonDeg);
  const out = [];
  for (const d of dsos) {
    if (d.mag != null && d.mag > magLimit) continue;
    const p = toAA(d.ra, d.dec);
    if (p.alt < -4) continue;
    out.push({ name: d.name, altName: d.alt, type: d.type, mag: d.mag, dim: d.dim, alt: p.alt, az: p.az });
  }
  return out;
}
