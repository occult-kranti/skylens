// render.js — canvas overlay: alt-az grid, constellation figures, stars, DSOs,
// bodies, satellites, planes, locate guidance. Double-drawn text for legibility.
import { vecFromAltAz, projectVec, clamp } from './astro.js';

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
    ctx.font = `500 ${size}px "Fira Code", ui-monospace, monospace`;
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
    const proj = (alt, az) => projectVec(vecFromAltAz(alt, az), basis, tanH, tanV, w, h);
    const labelCells = new Set();
    const labelOK = (x, y) => {
      const k = `${Math.round(x / 96)},${Math.round(y / 64)}`;
      if (labelCells.has(k)) return false;
      labelCells.add(k); return true;
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
        if (p) text(az % 90 === 0 ? 'NESW'[az / 90] : String(az), p.x, p.y - 4, PAL.gridText, az % 90 === 0 ? 13 : 10);
      }
      for (let alt = 15; alt <= 75; alt += 15) {
        const p = proj(alt, scene.centerAz);
        if (p) text(`${alt}°`, p.x + 14, p.y - 3, PAL.gridText, 9, 'left');
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
          if (p && labelOK(p.x, p.y)) text(c.name.toUpperCase(), p.x, p.y, PAL.constLabel, 9);
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
        if (scene.layers.labels && (d.mag ?? 9) <= 6.5 && labelOK(p.x, p.y)) text(lbl, p.x, p.y - rr - 3, PAL.dso, 9);
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
        if (scene.layers.labels && s.name && s.mag <= 1.6 && labelOK(p.x, p.y)) {
          text(s.name, p.x, p.y - 7, PAL.starLabel, 10);
        }
      }
    }

    /* ---- Sun / Moon / planets ---- */
    for (const b of scene.bodies) {
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
      const lbl = b.kind === 'moon' && b.phase != null ? `${b.name} ${(b.phase * 100) | 0}%` : b.name;
      if (scene.layers.labels && labelOK(p.x, p.y)) text(lbl, p.x, p.y - 10, b.kind === 'planet' ? PAL.planet : PAL.sun, 11);
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
        if (scene.layers.labels && labelOK(p.x, p.y)) text(s.name, p.x, p.y - 8, PAL.sat, 10);
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
        if (scene.layers.labels && labelOK(p.x, p.y)) text(pl.flight + altTxt, p.x, p.y - 8, PAL.plane, 10);
        drawn.push({ x: p.x, y: p.y, r: 14, kind: 'plane', data: pl });
      }
    }

    /* ---- locate highlight / edge guidance ---- */
    if (scene.highlight) {
      const t = scene.highlight;
      const p = proj(t.alt, t.az);
      if (p) {
        const pulse = 12 + 3 * Math.sin(performance.now() / 220);
        ctx.strokeStyle = PAL.highlight; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.arc(p.x, p.y, pulse, 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
        text(t.label, p.x, p.y - pulse - 6, PAL.highlight, 11);
      } else if (scene.centerAz != null) {
        // off-screen: chevron at the screen edge pointing toward the target
        const dAz = ((t.az - scene.centerAz + 540) % 360) - 180;
        const dAlt = t.alt - (scene.centerAlt ?? 0);
        const ang = Math.atan2(-dAlt, dAz); // screen: right = 0, up = −90°
        const ex = clamp(w / 2 + Math.cos(ang) * w, 34, w - 34);
        const ey = clamp(h / 2 + Math.sin(ang) * h, 34, h - 34);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
        ctx.strokeStyle = PAL.highlight; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(9, -7); ctx.lineTo(0, 0); ctx.lineTo(9, 7); ctx.stroke();
        ctx.restore();
        text(`${Math.abs(dAz).toFixed(0)}° ${dAz > 0 ? 'R' : 'L'} · ${Math.abs(dAlt).toFixed(0)}° ${dAlt > 0 ? 'up' : 'down'}`, ex, ey + 20, PAL.highlight, 10);
        text(t.label, ex, ey - 16, PAL.highlight, 10);
      }
    }

    /* ---- crosshair ---- */
    ctx.strokeStyle = PAL.crosshair; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 9, h / 2); ctx.lineTo(w / 2 + 9, h / 2);
    ctx.moveTo(w / 2, h / 2 - 9); ctx.lineTo(w / 2, h / 2 + 9);
    ctx.stroke();
  }

  function hitTest(x, y) {
    let best = null, bestD = 26;
    for (const it of drawn) {
      const d = Math.hypot(it.x - x, it.y - y) - it.r + 12;
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  return { draw, hitTest, resize, get width() { return w; }, get height() { return h; } };
}
