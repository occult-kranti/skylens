// ui.js — chrome: corner telemetry, inspector dock (tabs + drag), toasts, info card,
// onboarding overlay, settings binding. All DOM lives here; main.js owns state.
import { compass16, fmtAlt } from './astro.js';

const $ = (id) => document.getElementById(id);

export function createUI(handlers) {
  const dock = $('dock');
  const card = $('infocard');
  const toastBox = $('toasts');

  /* ---- dock drag (collapse/expand) ---- */
  let dragY = null, dockOpen = true;
  const handle = $('dockHandle');
  handle.addEventListener('pointerdown', (e) => { dragY = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => {
    if (dragY == null) return;
    if (Math.abs(e.clientY - dragY) > 28) { setDock(!dockOpen); dragY = null; }
  });
  handle.addEventListener('pointerup', () => { if (dragY != null) { setDock(!dockOpen); dragY = null; } });
  function setDock(open) { dockOpen = open; dock.classList.toggle('open', open); }
  setDock(false);

  /* ---- tabs ---- */
  dock.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      dock.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      dock.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
      setDock(true);
    });
  });

  /* ---- toasts ---- */
  function toast(msg, ms = 3400) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    toastBox.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }

  /* ---- feed status dots ---- */
  const dots = { tle: $('dotTle'), adsb: $('dotAdsb'), cam: $('dotCam'), motion: $('dotMotion') };
  const STATE_CLASS = { ok: 'st-ok', warn: 'st-warn', err: 'st-err', off: 'st-off' };
  function statusDot(which, state, title) {
    const d = dots[which]; if (!d) return;
    d.className = 'dot ' + (STATE_CLASS[state] || 'st-off');
    d.title = title || '';
  }

  /* ---- corner telemetry ---- */
  function telemetry(s) {
    $('telPos').textContent = s.loc ? `${s.loc.lat.toFixed(3)}°, ${s.loc.lon.toFixed(3)}°` : 'no location';
    $('telAim').textContent = `${compass16(s.az)} ${s.az.toFixed(0)}°  alt ${fmtAlt(s.alt)}`;
    $('telTime').textContent = new Date().toISOString().slice(11, 19) + ' UTC';
    $('telCount').textContent = s.counts;
  }

  /* ---- compass tape in dock header ---- */
  function compassTape(az) {
    $('tapeReadout').textContent = `${compass16(az)} ${az.toFixed(0)}°`;
    $('tapeStrip').style.backgroundPosition = `${-az * 3}px 0`;
  }

  /* ---- info card ---- */
  function showInfo(item) {
    if (!item) { card.hidden = true; return; }
    const d = item.data;
    let rows = '';
    const row = (k, v) => { rows += `<div class="k">${k}</div><div class="v">${v}</div>`; };
    if (item.kind === 'star') { row('object', d.name || 'unnamed star'); row('type', 'star'); row('mag', d.mag.toFixed(1)); row('alt / az', `${fmtAlt(d.alt)} / ${d.az.toFixed(1)}°`); }
    else if (item.kind === 'satellite') { row('object', d.name); row('type', 'satellite'); row('range', d.rangeKm.toFixed(0) + ' km'); row('alt / az', `${fmtAlt(d.alt)} / ${d.az.toFixed(1)}°`); }
    else if (item.kind === 'plane') { row('flight', d.flight); row('altitude', d.altFt != null ? d.altFt.toLocaleString() + ' ft' : '—'); row('speed', d.gsKt != null ? d.gsKt.toFixed(0) + ' kt' : '—'); row('distance', d.distKm.toFixed(1) + ' km'); row('alt / az', `${fmtAlt(d.alt)} / ${d.az.toFixed(1)}°`); }
    else { row('object', d.name); row('type', item.kind); if (d.mag != null) row('mag', d.mag.toFixed(1)); if (d.phase != null) row('illuminated', (d.phase * 100).toFixed(0) + '%'); row('alt / az', `${fmtAlt(d.alt)} / ${d.az.toFixed(1)}°`); }
    card.innerHTML = `<button class="x" aria-label="close">×</button><div class="grid">${rows}</div>`;
    card.querySelector('.x').addEventListener('click', () => { card.hidden = true; });
    card.hidden = false;
  }

  /* ---- lists in dock panels ---- */
  function li(main, sub) { return `<li><span>${main}</span><span class="sub">${sub}</span></li>`; }
  function skyList(bodies, stars) {
    $('skyList').innerHTML =
      bodies.map((b) => li(b.name, `${fmtAlt(b.alt)} · az ${b.az.toFixed(0)}°`)).join('') +
      stars.map((s) => li(s.name || `mag ${s.mag}`, `star · ${fmtAlt(s.alt)} · az ${s.az.toFixed(0)}°`)).join('') ||
      '<li class="empty">nothing above the horizon band</li>';
  }
  function satList(sats, meta) {
    $('satMeta').textContent = meta ? `${meta.count} tracked · ${meta.source}${meta.stale ? ' (stale snapshot)' : ''}` : '';
    $('satList').innerHTML = sats.slice(0, 12).map((s) => li(s.name, `${fmtAlt(s.alt)} · az ${s.az.toFixed(0)}° · ${s.rangeKm.toFixed(0)} km`)).join('') ||
      '<li class="empty">no tracked satellite above the horizon</li>';
  }
  function planeList(planes, status, ageMs) {
    const age = ageMs ? Math.round((Date.now() - ageMs) / 1000) : null;
    $('planeMeta').textContent = status === 'ok' ? `${planes.length} in 50 nm · updated ${age}s ago` : status === 'limited' ? 'rate-limited — backing off' : status === 'error' ? 'feed unavailable — retrying' : '';
    $('planeList').innerHTML = (planes || []).slice(0, 12).map((p) => li(p.flight, `${p.altFt != null ? p.altFt.toLocaleString() + ' ft · ' : ''}${p.gsKt ? p.gsKt.toFixed(0) + ' kt · ' : ''}${p.distKm.toFixed(0)} km ${compass16(p.az)}`)).join('') ||
      (status === 'ok' ? '<li class="empty">no aircraft in range</li>' : '');
  }

  /* ---- settings ---- */
  function bindSettings(state, onChange) {
    const fov = $('setFov'), mag = $('setMag');
    fov.value = state.fov; mag.value = state.magLimit;
    $('fovVal').textContent = state.fov + '°'; $('magVal').textContent = state.magLimit.toFixed(1);
    fov.addEventListener('input', () => { $('fovVal').textContent = fov.value + '°'; onChange({ fov: +fov.value }); });
    mag.addEventListener('input', () => { $('magVal').textContent = (+mag.value).toFixed(1); onChange({ magLimit: +mag.value }); });
    for (const [id, key] of [['setGrid', 'grid'], ['setLabels', 'labels'], ['setSats', 'sats'], ['setPlanes', 'planes']]) {
      const el = $(id); el.checked = state.layers[key];
      el.addEventListener('change', () => onChange({ layers: { ...state.layers, [key]: el.checked } }));
    }
    const night = $('setNight');
    night.checked = state.night;
    night.addEventListener('change', () => onChange({ night: night.checked }));
    $('setLoc').addEventListener('click', () => {
      const lat = parseFloat($('locLat').value), lon = parseFloat($('locLon').value);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        onChange({ loc: { lat, lon, source: 'manual' } }); toast(`location set: ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
      } else toast('enter valid lat (−90…90) and lon (−180…180)');
    });
    $('locGps').addEventListener('click', () => handlers.relocate());
    $('selftestLink').addEventListener('click', (e) => { e.preventDefault(); window.open('test.html?auto=1', '_blank'); });
  }

  /* ---- onboarding ---- */
  function onboarding() {
    return new Promise((resolve) => {
      const ob = $('onboard');
      $('btnAR').addEventListener('click', () => { ob.classList.add('hide'); setTimeout(() => { ob.hidden = true; resolve('ar'); }, 250); });
      $('btnManual').addEventListener('click', () => { ob.hidden = true; resolve('manual'); });
      if (!window.isSecureContext) {
        $('httpsWarn').hidden = false;
        $('btnAR').disabled = true;
      }
      ob.hidden = false;
    });
  }

  return { toast, statusDot, telemetry, compassTape, showInfo, skyList, satList, planeList, bindSettings, onboarding, setDock };
}
