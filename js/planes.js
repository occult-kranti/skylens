// Optional location-sharing feed: start only after the user enables Aircraft.
import { planeAltAz } from './astro.js';

const BASE_INTERVAL_MS = 12000, MAX_INTERVAL_MS = 120000;
let nextRequestAfter = 0;
const endpoint = (lat, lon) => `https://avioadsb.org/v1/point/${lat.toFixed(3)}/${lon.toFixed(3)}/50`;

export function retryAfterTime(value, now = Date.now()) {
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const date = now + Number(value) * 1000;
    if (Number.isFinite(date) && date <= 8640000000000000) return date;
  }
  const parsed = typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && parsed > now ? parsed : now + 15 * 60000;
}
export function quotaResetTime(headers, now = Date.now()) {
  // AvioADSB explicitly defines both headers as durations in seconds.
  // Retry-After also accepts the standard HTTP-date form defensively.
  const values = ['Retry-After', 'X-RateLimit-Reset'].map(name => headers?.get?.(name)).filter(value => value != null && value !== '');
  return values.length ? Math.max(...values.map(value => retryAfterTime(value, now))) : now + 15 * 60000;
}

export function startPlanes(getLoc, onUpdate) {
  let timer = null, controller = null, timeout = null, interval = BASE_INTERVAL_MS, stopped = false, quotaPaused = false;
  let lastSuccess = null;
  function schedule(ms) { if (!stopped && !quotaPaused) timer = setTimeout(tick, ms); }
  async function tick() {
    if (stopped) return;
    if (Date.now() < nextRequestAfter) {
      quotaPaused = true;
      onUpdate({ status: 'limited', planes: [], ageMs: lastSuccess, retryAt: nextRequestAfter });
      return;
    }
    const loc = getLoc();
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) { schedule(BASE_INTERVAL_MS); return; }
    controller = new AbortController();
    timeout = setTimeout(() => controller?.abort(), 10000);
    try {
      const r = await fetch(endpoint(loc.lat, loc.lon), { signal: controller.signal });
      if (stopped) return;
      if (r.status === 429) {
        nextRequestAfter = quotaResetTime(r.headers);
        quotaPaused = true;
        onUpdate({ status: 'limited', planes: [], ageMs: lastSuccess, retryAt: nextRequestAfter });
      } else {
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (stopped) return;
        // readsb-style `now` is Unix milliseconds. Receipt time alone does not
        // establish freshness if a provider or intermediary returns old data.
        if (!j || !Array.isArray(j.ac) || !Number.isFinite(j.now)) throw new Error('Aircraft response lacks a valid timestamp or position array.');
        const providerAt = j.now;
        if (Date.now() - providerAt > 60000 || providerAt > Date.now() + 60000) throw new Error('Aircraft response timestamp is stale or inconsistent.');
        const planes = (Array.isArray(j.ac) ? j.ac : []).filter(a =>
          Number.isFinite(a.lat) && Math.abs(a.lat) <= 90 && Number.isFinite(a.lon) && Math.abs(a.lon) <= 180 &&
          Number.isFinite(a.alt_baro) && Number.isFinite(a.seen_pos) && a.seen_pos >= 0 && a.seen_pos <= 60)
          .map(a => {
            const g = planeAltAz(loc.lat, loc.lon, a.lat, a.lon, a.alt_baro * .3048);
            return { id: `plane:${String(a.hex || a.flight || '')}`, flight: String(a.flight || '').trim() || String(a.hex || 'Unknown'),
              alt: g.alt, az: g.az, distKm: g.distKm, altFt: a.alt_baro,
              gsKt: Number.isFinite(a.gs) ? a.gs : null, track: Number.isFinite(a.track) ? a.track : null };
          }).filter(p => p.alt > -2).sort((a, b) => a.distKm - b.distKm);
        lastSuccess = Date.now(); interval = BASE_INTERVAL_MS;
        const remainingHeader = r.headers?.get?.('X-RateLimit-Remaining');
        const remaining = remainingHeader != null && /^\d+$/.test(remainingHeader) ? Number(remainingHeader) : null;
        if (remaining === 0) {
          nextRequestAfter = quotaResetTime(r.headers);
          quotaPaused = true;
          onUpdate({ status: 'limited', planes: [], ageMs: lastSuccess, retryAt: nextRequestAfter, remaining });
        } else onUpdate({ status: 'ok', planes, ageMs: lastSuccess, remaining, providerAt });
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
