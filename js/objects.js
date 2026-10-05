// d3-celestial J2000 catalogue; the shared sky adapter rotates every layer to the same date.
import { horizontalProjector } from './sky.js';

let constellations = [], dsos = [];
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

export function constellationFrame(date, lat, lon, refraction = false) {
  const project = horizontalProjector(date, lat, lon, refraction);
  return constellations.map((c, index) => {
    const label = c.label ? project(c.label[0], c.label[1]) : null;
    return { name: c.name, id: `const:${c.id}:${index}`, catalogueId: c.id, kind: 'constellation',
      alt: label?.alt ?? null, az: label?.az ?? null,
      description: 'Guidance targets the catalogue label anchor, not a single star or full boundary. Stick figures are illustrative.',
      segs: c.lines.map(seg => seg.map(([ra, dec]) => { const p = project(ra, dec); return [p.alt, p.az]; })),
      label: label && label.alt > -5 ? { ...label, name: c.name } : null };
  });
}

export function dsoFrame(date, lat, lon, magLimit = 10, minAlt = -4, refraction = false) {
  const project = horizontalProjector(date, lat, lon, refraction);
  return dsos.filter(d => d.mag == null || d.mag <= magLimit)
    .map(d => ({ id: `dso:${d.name}`, kind: 'dso', name: d.name, altName: d.alt,
      type: d.type, mag: d.mag, dim: d.dim, ...project(d.ra, d.dec) }))
    .filter(d => d.alt >= minAlt);
}
