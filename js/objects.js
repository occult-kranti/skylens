// d3-celestial J2000 catalogue; the shared sky adapter rotates every layer to the same date.
import { horizontalProjector } from './sky.js';

let constellations = [], dsos = [];
export const counts = () => ({ constellations: constellations.length, dsos: dsos.length });

const isSerpensPart = c => c.id === 'Ser' && ['Serpens Caput', 'Serpens Cauda'].includes(c.name);

// The source repeats one label coordinate for both disconnected Serpens drawings.
// Each part instead uses the direction of the unweighted mean of its unique J2000
// line-vertex unit vectors. These are drawing anchors, not official IAU centres,
// area centroids, or additional constellations. RA hours are normalized to [0, 24).
export function constellationLabelAnchor(c) {
  if (!isSerpensPart(c)) return c.label;
  const unique = new Map(c.lines.flat().map(vertex => [vertex.join(','), vertex]));
  let x = 0, y = 0, z = 0;
  for (const [ra, dec] of unique.values()) {
    const a = ra * Math.PI / 12, d = dec * Math.PI / 180;
    x += Math.cos(d) * Math.cos(a); y += Math.cos(d) * Math.sin(a); z += Math.sin(d);
  }
  if (!unique.size || Math.hypot(x, y, z) < 1e-12) return c.label;
  return [((Math.atan2(y, x) * 12 / Math.PI) % 24 + 24) % 24,
    Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI];
}

export async function loadConstellations(url = 'data/constellations.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error('constellations.json ' + r.status);
  constellations = (await r.json()).map(c => ({ ...c, label: constellationLabelAnchor(c) }));
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
      description: isSerpensPart(c) ? 'Guidance targets this part’s drawing anchor, the mean direction of its unique line vertices, not an official centre or boundary. Caput and Cauda are parts of one IAU constellation, Serpens.' :
        'Guidance targets the catalogue label anchor, not a single star or full boundary. Stick figures are illustrative.',
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
