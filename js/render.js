// render.js — canvas overlay: alt-az grid, constellation figures, stars, DSOs,
// bodies, satellites, planes, locate guidance. Double-drawn text for legibility.
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
    grid: 'rgba(160,190,255,0.14)', gridText: 'rgba(190,205,235,0.8)', horizon: 'rgba(170,200,255,0.55)',
    star: (a) => `rgba(255,244,228,${a})`, starLabel: 'rgba(235,230,218,0.92)',
    planet: '#ffd9a0', sun: '#ffe9b0', moon: '#e6e8f2',
    sat: '#ffb454', plane: '#58c6ff',
    constLine: 'rgba(140,170,255,0.30)', constLabel: 'rgba(150,180,235,0.6)', dso: 'rgba(196,170,255,0.8)',
    highlight: '#58c6ff',
    shadow: 'rgba(0,0,0,0.9)', crosshair: 'rgba(255,255,255,0.35)',
  },
  night: { // red-shifted: preserves dark adaptation
    grid: 'rgba(255,70,50,0.13)', gridText: 'rgba(255,120,100,0.75)', horizon: 'rgba(255,95,70,0.5)',
    star: (a) => `rgba(255,120,90,${a})`, starLabel: 'rgba(255,140,110,0.92)',
    planet: '#ff9a6a', sun: '#ff7a50', moon: '#ff9a80',
    sat: '#ffb454', plane: '#ff8a70',
    constLine: 'rgba(255,90,70,0.28)', constLabel: 'rgba(255,120,100,0.55)', dso: 'rgba(255,150,130,0.75)',
    highlight: '#ff6a55',
    shadow: 'rgba(0,0,0,0.95)', crosshair: 'rgba(255,120,100,0.4)',
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

  function text(str, x, y, color, size = 11, align = 'center') {
    ctx.font = labelFont(size);
    ctx.textAlign = align;
    ctx.fillStyle = PAL.shadow; ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  let PAL = PALETTES.normal;

  function draw(scene) {
    PAL = scene.palette;
    drawn = [];
    ctx.clearRect(0, 0, w, h);
    const { basis, tanH, tanV } = scene;
    const proj = (alt, az) => scene.horizonOnly && alt < 0 ? null
      : projectVec(vecFromAltAz(alt, az), basis, tanH, tanV, w, h);
    const labels = [];
    const label = (str, x, y, color, size = 11, priority = 10, align = 'center') => {
      ctx.font = labelFont(size);
      const key = str;
      str = fitLabel(str, w - 24, text => ctx.measureText(text).width);
      if (!str) return;
      const width = ctx.measureText(str).width;
      if (priority >= 100) { x = clamp(x, width / 2 + 10, w - width / 2 - 10); y = clamp(y, size + 10, h - 10); }
      labels.push({ str, key, x, y, color, size, priority, align, width, height: size });
    };

    /* ---- alt-az grid ---- */
    if (scene.layers.grid) {
      ctx.lineWidth = 1;
      for (let alt = -60; alt <= 75; alt += 15) {
        ctx.strokeStyle = alt === 0 ? PAL.horizon : PAL.grid;
        ctx.beginPath(); let started = false;
        for (let az = 0; az <= 360; az += 4) {
          const p = proj(alt, az);
          if (p) { started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); started = true; }
          else started = false;
        }
        ctx.stroke();
      }
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
      for (let az = 0; az < 360; az += 45) {
        const p = proj(1.5, az);
        if (p) label(az % 90 === 0 ? 'NESW'[az / 90] : String(az), p.x, p.y - 4, PAL.gridText, az % 90 === 0 ? 13 : 10, 5);
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
        const rr = clamp(7 - 0.5 * (d.mag ?? 6), 2.5, 7);
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
        const r = clamp(2.7 - 0.45 * s.mag, 0.7, 3.6);
        const a = clamp(1.05 - 0.17 * s.mag, 0.3, 1);
        ctx.fillStyle = PAL.star(a);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
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
      if (b.kind === 'sun') {
        ctx.fillStyle = PAL.sun; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = PAL.sun; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (b.kind === 'moon') {
        ctx.fillStyle = PAL.moon; ctx.globalAlpha = 0.35 + 0.65 * (b.phase ?? 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = PAL.planet; ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, 6.2832); ctx.fill();
      }
      const name = displayName(b, scene.nameMode);
      const lbl = b.kind === 'moon' && b.phase != null ? `${name} ${(b.phase * 100) | 0}%` : name;
      if (scene.layers.labels) label(lbl, p.x, p.y - 10, b.kind === 'planet' ? PAL.planet : PAL.sun, 12, 50);
      drawn.push({ x: p.x, y: p.y, r: 16, kind: b.kind, data: b });
    }

    /* ---- satellites ---- */
    if (scene.layers.sats) {
      for (const s of scene.sats) {
        const p = proj(s.alt, s.az);
        if (!p) continue;
        ctx.fillStyle = PAL.sat;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 4.5); ctx.lineTo(p.x + 4, p.y + 3); ctx.lineTo(p.x - 4, p.y + 3);
        ctx.closePath(); ctx.fill();
        if (scene.layers.labels) label(s.name, p.x, p.y - 8, PAL.sat, 10, 15);
        drawn.push({ x: p.x, y: p.y, r: 14, kind: 'satellite', data: s });
      }
    }

    /* ---- aircraft ---- */
    if (scene.layers.planes) {
      for (const pl of scene.planes) {
        const p = proj(pl.alt, pl.az);
        if (!p) continue;
        ctx.strokeStyle = PAL.plane; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x + 5, p.y); ctx.lineTo(p.x, p.y + 5); ctx.lineTo(p.x - 5, p.y);
        ctx.closePath(); ctx.stroke();
        const altTxt = pl.altFt != null ? ` ${Math.round(pl.altFt / 100) * 100 >= 1000 ? (Math.round(pl.altFt / 100) / 10).toFixed(1) + 'k' : pl.altFt}ft` : '';
        if (scene.layers.labels) label(pl.flight + altTxt, p.x, p.y - 8, PAL.plane, 10, 15);
        drawn.push({ x: p.x, y: p.y, r: 14, kind: 'plane', data: pl });
      }
    }

    /* ---- locate highlight / edge guidance ---- */
    if (scene.highlight) {
      const t = scene.highlight;
      const p = proj(t.alt, t.az);
      if (p && p.x >= 16 && p.x <= w - 16 && p.y >= 16 && p.y <= h - 16) {
        const pulse = scene.reducedMotion ? 13 : 12 + 3 * Math.sin(performance.now() / 220);
        ctx.strokeStyle = PAL.highlight; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.arc(p.x, p.y, pulse, 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
        label(displayName(t, scene.nameMode), p.x, p.y - pulse - 6, PAL.highlight, 12, 100);
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
      text(item.str, item.x, item.y, item.color, item.size, item.align);
    }

    /* ---- crosshair ---- */
    ctx.strokeStyle = PAL.crosshair; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 9, h / 2); ctx.lineTo(w / 2 + 9, h / 2);
    ctx.moveTo(w / 2, h / 2 - 9); ctx.lineTo(w / 2, h / 2 + 9);
    ctx.stroke();
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
