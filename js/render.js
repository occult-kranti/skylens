// render.js — canvas overlay: alt-az grid, constellation figures, stars, DSOs,
// bodies, satellites, planes, locate guidance. Markers are readable symbols,
// not angular diameters, resolved planetary surfaces or camera detections.
import { vecFromAltAz, projectVec, clamp } from './astro.js';
import { displayName } from './names.js';

const labelFont = size => `500 ${size}px system-ui, "Nirmala UI", "Noto Sans Devanagari", sans-serif`;
const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('hi', { granularity: 'grapheme' }) : null;
export function fitLabel(value, maxWidth, measure) {
  const text = String(value || '');
  if (measure(text) <= maxWidth) return text;
  const parts = graphemes ? Array.from(graphemes.segment(text), part => part.segment) : Array.from(text);
  while (parts.length && measure(parts.join('') + '…') > maxWidth) parts.pop();
  return parts.length ? parts.join('') + '…' : '';
}

export const PALETTES = {
  normal: {
    grid: 'rgba(160,190,225,0.16)', gridText: '#a6b7cf', horizon: '#a2bedb',
    star: (a) => `rgba(255,244,228,${a})`, starLabel: 'rgba(235,230,218,0.92)',
    planet: '#ffca80', sun: '#ffe9b0', moon: '#e7edf5',
    sat: '#ffca80', plane: '#71d0ff',
    constLine: 'rgba(140,170,215,0.34)', constLabel: '#96b0d4', dso: '#c4aaff',
    highlight: '#71d0ff',
    shadow: 'rgba(2,7,14,0.94)', markerEdge: '#080e18', labelSurface: 'rgba(5,11,20,0.88)',
    crosshair: 'rgba(198,216,237,0.6)',
  },
  night: { // Warm red instrument palette; display brightness still matters outdoors.
    grid: 'rgba(230,84,62,0.14)', gridText: '#c07865', horizon: '#d58b74',
    star: (a) => `rgba(255,120,90,${a})`, starLabel: 'rgba(255,140,110,0.92)',
    planet: '#ff9a6a', sun: '#ff7a50', moon: '#ff9a80',
    sat: '#ff9a6a', plane: '#ff9b87',
    constLine: 'rgba(235,99,73,0.30)', constLabel: '#c07865', dso: '#db947e',
    highlight: '#ff9b87',
    shadow: 'rgba(10,2,0,0.96)', markerEdge: '#120502', labelSurface: 'rgba(20,5,2,0.9)',
    crosshair: 'rgba(225,130,106,0.55)',
  },
};

// Deterministic priority order prevents catalogue order from hiding bright objects.
// Dimensions are measured from the real canvas font; hidden labels remain tappable.
export function layoutLabels(candidates, width, height, limit = 45) {
  const placed = [];
  const ordered = [...candidates].sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
  for (const item of ordered) {
    if (placed.length >= limit) break;
    const left = item.align === 'left' ? item.x : item.x - item.width / 2;
    const rect = { left: left - 4, right: left + item.width + 4, top: item.y - item.height - 3, bottom: item.y + 4 };
    if (rect.left < 4 || rect.right > width - 4 || rect.top < 4 || rect.bottom > height - 4) continue;
    if (placed.some((p) => rect.left < p.rect.right && rect.right > p.rect.left && rect.top < p.rect.bottom && rect.bottom > p.rect.top)) continue;
    placed.push({ ...item, rect });
  }
  return placed;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  let drawn = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // DPR cap — perf budget
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function text(str, x, y, color, size = 11, align = 'center', surface = false, width = 0) {
    ctx.font = labelFont(size);
    ctx.textAlign = align;
    if (surface) {
      // Only selected labels and compass tags get a compact scrim over video.
      const left = align === 'left' ? x : x - width / 2;
      ctx.fillStyle = PAL.labelSurface; ctx.fillRect(left - 4, y - size - 3, width + 8, size + 7);
    }
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.shadow;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  let PAL = PALETTES.normal;

  function draw(scene) {
    PAL = scene.palette || PALETTES.normal;
    drawn = [];
    ctx.clearRect(0, 0, w, h);
    const { basis, tanH, tanV } = scene;
    const proj = (alt, az) => {
      if (!Number.isFinite(alt) || !Number.isFinite(az) || (scene.horizonOnly && alt < 0)) return null;
      const point = projectVec(vecFromAltAz(alt, az), basis, tanH, tanV, w, h);
      return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
    };
    const labels = [];
    const label = (str, x, y, color, size = 11, priority = 10, align = 'center', compass = false) => {
      ctx.font = labelFont(size);
      const key = str;
      str = fitLabel(str, w - 24, text => ctx.measureText(text).width);
      if (!str) return;
      const width = ctx.measureText(str).width;
      if (priority >= 100) { x = clamp(x, width / 2 + 10, w - width / 2 - 10); y = clamp(y, size + 10, h - 10); }
      labels.push({ str, key, x, y, color, size, priority, align, width, height: size,
        surface: !!scene.cameraActive && (priority >= 100 || compass) });
    };

    /* ---- alt-az grid ---- */
    if (scene.layers.grid) {
      ctx.lineWidth = 1;
      for (let alt = -60; alt <= 75; alt += 15) {
        ctx.setLineDash(alt < 0 ? [2, 6] : []);
        ctx.strokeStyle = alt === 0 ? PAL.horizon : PAL.grid;
        ctx.beginPath(); let started = false;
        for (let az = 0; az <= 360; az += 4) {
          const p = proj(alt, az);
          if (p) { started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); started = true; }
          else started = false;
        }
        if (alt === 0) {
          ctx.strokeStyle = PAL.shadow; ctx.lineWidth = 3; ctx.stroke();
          ctx.strokeStyle = PAL.horizon; ctx.lineWidth = 1.25;
        }
        ctx.stroke(); ctx.lineWidth = 1;
      }
      ctx.setLineDash([]);
      for (let az = 0; az < 360; az += 30) {
        ctx.strokeStyle = PAL.grid;
        ctx.beginPath(); let started = false;
        for (let alt = -85; alt <= 85; alt += 4) {
          const p = proj(alt, az);
          if (p) { started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); started = true; }
          else started = false;
        }
        ctx.stroke();
      }
      const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      for (let az = 0; az < 360; az += 45) {
        const p = proj(1.5, az);
        if (p) label(compass[az / 45], p.x, p.y - 4, az === 0 ? PAL.highlight : PAL.horizon,
          az % 90 === 0 ? 13 : 10, az % 90 === 0 ? 36 : 8, 'center', true);
      }
      for (let alt = 15; alt <= 75; alt += 15) {
        const p = proj(alt, scene.centerAz);
        if (p) label(`${alt}°`, p.x + 14, p.y - 3, PAL.gridText, 9, 4, 'left');
      }
    }

    /* ---- constellation lines + labels (under the stars) ---- */
    if (scene.layers.constellations && scene.constellations) {
      ctx.strokeStyle = PAL.constLine; ctx.lineWidth = 1;
      for (const c of scene.constellations) {
        for (const seg of c.segs) {
          ctx.beginPath(); let started = false;
          for (const [alt, az] of seg) {
            const p = proj(alt, az);
            if (p) { started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); started = true; }
            else started = false;
          }
          ctx.stroke();
        }
        if (scene.layers.labels && c.label) {
          const p = proj(c.label.alt, c.label.az);
          if (p) label(displayName(c, scene.nameMode), p.x, p.y, PAL.constLabel, 12, 6);
        }
      }
    }

    /* ---- deep-sky objects (Messier) ---- */
    if (scene.layers.dsos && scene.dsos) {
      for (const d of scene.dsos) {
        const p = proj(d.alt, d.az);
        if (!p) continue;
        const rr = clamp(7 - 0.5 * (Number.isFinite(d.mag) ? d.mag : 6), 2.5, 7);
        ctx.strokeStyle = PAL.dso; ctx.lineWidth = 1;
        if (d.type === 'galaxy' || d.type === 'galaxy cluster') { // ellipse marker for galaxies
          ctx.beginPath(); ctx.ellipse(p.x, p.y, rr + 2, rr * 0.6, 0.6, 0, 6.2832); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke();
          if (d.type === 'globular cluster') { ctx.beginPath(); ctx.moveTo(p.x - rr, p.y); ctx.lineTo(p.x + rr, p.y); ctx.moveTo(p.x, p.y - rr); ctx.lineTo(p.x, p.y + rr); ctx.stroke(); }
        }
        const lbl = d.altName ? `${d.name} ${d.altName}` : d.name;
        if (scene.layers.labels && (d.mag ?? 9) <= 6.5) label(lbl, p.x, p.y - rr - 3, PAL.dso, 9, 12 - (d.mag ?? 9));
        drawn.push({ x: p.x, y: p.y, r: Math.max(14, rr + 6), kind: 'dso', data: d });
      }
    }

    /* ---- stars ---- */
    if (scene.layers.stars) {
      for (const s of scene.stars) {
        const p = proj(s.alt, s.az);
        if (!p) continue;
        const mag = Number.isFinite(s.mag) ? s.mag : 6;
        const r = clamp(2.7 - 0.45 * mag, 0.7, 3.6);
        const a = clamp(1.05 - 0.17 * mag, 0.3, 1);
        ctx.fillStyle = PAL.star(a);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832);
        if (scene.cameraActive) { ctx.strokeStyle = PAL.markerEdge; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fill();
        drawn.push({ x: p.x, y: p.y, r: Math.max(12, r + 6), kind: 'star', data: s });
        if (scene.layers.labels && s.name && s.mag <= 1.6) {
          label(displayName(s, scene.nameMode), p.x, p.y - 7, PAL.starLabel, 12, 30 - s.mag);
        }
      }
    }

    /* ---- Sun / Moon / planets ---- */
    for (const b of scene.layers.bodies === false ? [] : scene.bodies) {
      const p = proj(b.alt, b.az);
      if (!p) continue;
      // A dark keyline separates the symbol from a bright camera image. Moon
      // illumination changes symbol brightness, not an invented limb orientation.
      const markerRadius = b.kind === 'sun' ? 7 : b.kind === 'moon' ? 6 : 3.6;
      ctx.strokeStyle = PAL.markerEdge; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, markerRadius, 0, 6.2832); ctx.stroke();
      if (b.kind === 'sun') {
        ctx.fillStyle = PAL.sun; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = PAL.sun; ctx.lineWidth = 1; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (b.kind === 'moon') {
        ctx.fillStyle = PAL.moon; ctx.globalAlpha = 0.35 + 0.65 * (Number.isFinite(b.phase) ? clamp(b.phase, 0, 1) : 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = PAL.planet; ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, 6.2832); ctx.fill();
      }
      const name = displayName(b, scene.nameMode);
      const lbl = b.kind === 'moon' && b.phase != null ? `${name} ${(b.phase * 100) | 0}%` : name;
      if (scene.layers.labels) label(lbl, p.x, p.y - 12, b.kind === 'moon' ? PAL.moon : b.kind === 'sun' ? PAL.sun : PAL.planet, 12, 50);
      drawn.push({ x: p.x, y: p.y, r: 16, kind: b.kind, data: b });
    }

    /* ---- satellites ---- */
    if (scene.layers.sats) {
      for (const s of scene.sats) {
        const p = proj(s.alt, s.az);
        if (!p) continue;
        ctx.fillStyle = PAL.sat;
        ctx.globalAlpha = s.visibility && !s.visibility.candidate ? .58 : 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 4.5); ctx.lineTo(p.x + 4, p.y + 3); ctx.lineTo(p.x - 4, p.y + 3);
        ctx.closePath();
        if (scene.cameraActive) { ctx.strokeStyle = PAL.markerEdge; ctx.lineWidth = 3; ctx.stroke(); }
        ctx.fill(); ctx.globalAlpha = 1;
        if (scene.layers.labels) label(s.name, p.x, p.y - 8, PAL.sat, 10, s.noradId === '25544' ? 42 : 32);
        drawn.push({ x: p.x, y: p.y, r: 14, kind: 'satellite', data: s });
      }
    }

    /* ---- aircraft ---- */
    if (scene.layers.planes) {
      for (const pl of scene.planes) {
        const p = proj(pl.alt, pl.az);
        if (!p) continue;
        const next = pl.next && proj(pl.next.alt, pl.next.az);
        const movement = next && Math.hypot(next.x - p.x, next.y - p.y) > .3 ? Math.atan2(next.y - p.y, next.x - p.x) + Math.PI / 2 : 0;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(movement);
        ctx.globalAlpha = pl.positionMode === 'estimate-paused' ? .6 : 1;
        ctx.beginPath();
        // A small aircraft-like direction marker, independent of physical size.
        // Rotation follows its projected short motion sample, not compass track
        // directly (which would be wrong for a rolled camera).
        ctx.moveTo(0, -7); ctx.lineTo(2, -1); ctx.lineTo(7, 3); ctx.lineTo(2, 2);
        ctx.lineTo(2, 6); ctx.lineTo(-2, 6); ctx.lineTo(-2, 2); ctx.lineTo(-7, 3); ctx.lineTo(-2, -1); ctx.closePath();
        ctx.strokeStyle = PAL.markerEdge; ctx.lineWidth = 3.5; ctx.stroke();
        ctx.strokeStyle = PAL.plane; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
        const reportAge = Number.isFinite(pl.positionAgeMs) ? ` · ${Math.floor(pl.positionAgeMs / 1000)}s` : '';
        if (scene.layers.labels) label(pl.flight + reportAge, p.x, p.y - 10, PAL.plane, 10, 40);
        drawn.push({ x: p.x, y: p.y, r: 14, kind: 'plane', data: pl });
      }
    }

    /* ---- locate highlight / edge guidance ---- */
    if (scene.highlight && Number.isFinite(scene.highlight.alt) && Number.isFinite(scene.highlight.az)) {
      const t = scene.highlight;
      const p = proj(t.alt, t.az);
      if (p && p.x >= 16 && p.x <= w - 16 && p.y >= 16 && p.y <= h - 16) {
        // Four static open corners point to the exact projected centre without
        // drawing over it. No pulse, motion dependency, glow or extra hit target.
        const radius = 14, corner = 5;
        ctx.beginPath();
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          ctx.moveTo(p.x + sx * (radius - corner), p.y + sy * radius);
          ctx.lineTo(p.x + sx * radius, p.y + sy * radius);
          ctx.lineTo(p.x + sx * radius, p.y + sy * (radius - corner));
        }
        ctx.strokeStyle = PAL.shadow; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = PAL.highlight; ctx.lineWidth = 1.5; ctx.stroke();
        label(displayName(t, scene.nameMode), p.x, p.y - radius - 7, PAL.highlight, 12, 100);
      } else if (scene.centerAz != null) {
        // off-screen: chevron at the screen edge pointing toward the target
        const target = vecFromAltAz(t.alt, t.az);
        const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
        const dx = dot(target, basis.right), dy = -dot(target, basis.up);
        const angle = Math.acos(clamp(dot(target, basis.fwd), -1, 1)) * 180 / Math.PI;
        const ang = Math.hypot(dx, dy) < 1e-6 ? Math.PI : Math.atan2(dy, dx);
        const ex = clamp(w / 2 + Math.cos(ang) * w, 34, w - 34);
        const ey = clamp(h / 2 + Math.sin(ang) * h, 34, h - 34);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
        ctx.strokeStyle = PAL.highlight; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(2, 0); ctx.lineTo(-7, 7); ctx.stroke();
        ctx.restore();
        label(`${angle.toFixed(0)}° away${t.alt < 0 ? ' · below horizon' : ''}`, ex, ey + 20, PAL.highlight, 10, 100);
        label(displayName(t, scene.nameMode), ex, ey - 16, PAL.highlight, 12, 100);
      }
    }

    for (const item of layoutLabels(labels, w, h)) {
      text(item.str, item.x, item.y, item.color, item.size, item.align, item.surface, item.width);
    }

    /* ---- crosshair ---- */
    // Empty centre keeps the boresight readable without resembling another star.
    ctx.beginPath();
    for (const sign of [-1, 1]) {
      ctx.moveTo(w / 2 + sign * 6, h / 2); ctx.lineTo(w / 2 + sign * 13, h / 2);
      ctx.moveTo(w / 2, h / 2 + sign * 6); ctx.lineTo(w / 2, h / 2 + sign * 13);
    }
    ctx.strokeStyle = PAL.shadow; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = PAL.crosshair; ctx.lineWidth = 1; ctx.stroke();
  }

  function hitTest(x, y) {
    const rect = canvas.getBoundingClientRect();
    x -= rect.left; y -= rect.top;
    let best = null, bestD = 26;
    for (const it of drawn) {
      const d = Math.hypot(it.x - x, it.y - y) - it.r + 12;
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  return { draw, hitTest, resize, dispose() { window.removeEventListener('resize', resize); drawn = []; }, get width() { return w; }, get height() { return h; } };
}
