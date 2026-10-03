// Optional location-sharing feed: start only after the user enables Aircraft.
import { planeAltAz } from './astro.js';

const BASE_INTERVAL_MS = 12000, MAX_INTERVAL_MS = 120000;
const endpoint = (lat, lon) => `https://avioadsb.org/v1/point/${lat.toFixed(3)}/${lon.toFixed(3)}/50`;

export function startPlanes(getLoc, onUpdate) {
  let timer = null, controller = null, timeout = null, interval = BASE_INTERVAL_MS, stopped = false;
  let lastSuccess = null;
  function schedule(ms) { if (!stopped) timer = setTimeout(tick, ms); }
  async function tick() {
    if (stopped) return;
    const loc = getLoc();
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) { schedule(BASE_INTERVAL_MS); return; }
    controller = new AbortController();
    timeout = setTimeout(() => controller?.abort(), 10000);
    try {
      const r = await fetch(endpoint(loc.lat, loc.lon), { signal: controller.signal });
      if (stopped) return;
      if (r.status === 429) {
        interval = Math.min(interval * 2, MAX_INTERVAL_MS);
        onUpdate({ status: 'limited', planes: [], ageMs: lastSuccess });
      } else {
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (stopped) return;
        const planes = (Array.isArray(j.ac) ? j.ac : []).filter(a =>
          Number.isFinite(a.lat) && Math.abs(a.lat) <= 90 && Number.isFinite(a.lon) && Math.abs(a.lon) <= 180 &&
          typeof a.alt_baro === 'number' && (!Number.isFinite(a.seen_pos) || a.seen_pos <= 60))
          .map(a => {
            const g = planeAltAz(loc.lat, loc.lon, a.lat, a.lon, a.alt_baro * .3048);
            return { id: `plane:${String(a.hex || a.flight || '')}`, flight: String(a.flight || '').trim() || String(a.hex || 'Unknown'),
              alt: g.alt, az: g.az, distKm: g.distKm, altFt: a.alt_baro,
              gsKt: Number.isFinite(a.gs) ? a.gs : null, track: Number.isFinite(a.track) ? a.track : null };
          }).filter(p => p.alt > -2).sort((a, b) => a.distKm - b.distKm);
        lastSuccess = Date.now(); interval = BASE_INTERVAL_MS;
        onUpdate({ status: 'ok', planes, ageMs: lastSuccess });
      }
    } catch (e) {
      if (!stopped) {
        interval = Math.min(interval * 2, MAX_INTERVAL_MS);
        onUpdate({ status: 'error', planes: [], ageMs: lastSuccess, error: String(e) });
      }
    } finally {
      clearTimeout(timeout); timeout = null; controller = null;
      schedule(interval);
    }
  }
  tick();
  return { stop() { stopped = true; clearTimeout(timer); clearTimeout(timeout); controller?.abort(); } };
}
