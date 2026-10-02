// planes.js — live ADS-B aircraft from AvioADSB (CORS-verified, CC BY 4.0 attribution).
// Anonymous tier: 1 request / 10 s → we poll at 12 s with exponential backoff on errors.
import { planeAltAz } from './astro.js';

const RADIUS_NM = 50;
const BASE_INTERVAL_MS = 12000;
const MAX_INTERVAL_MS = 120000;
const endpoint = (lat, lon) => `https://avioadsb.org/v1/point/${lat.toFixed(3)}/${lon.toFixed(3)}/${RADIUS_NM}`;

export function startPlanes(getLoc, onUpdate) {
  let timer = null, interval = BASE_INTERVAL_MS, stopped = false;

  async function tick() {
    const loc = getLoc();
    if (!loc) { schedule(BASE_INTERVAL_MS); return; }
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(endpoint(loc.lat, loc.lon), { signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 429) { interval = Math.min(interval * 2, MAX_INTERVAL_MS); onUpdate({ status: 'limited', planes: [], ageMs: Date.now() }); schedule(interval); return; }
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const planes = (j.ac || [])
        .filter((a) => a.lat != null && a.lon != null)
        .map((a) => {
          const altM = (typeof a.alt_baro === 'number' ? a.alt_baro : 0) * 0.3048;
          const g = planeAltAz(loc.lat, loc.lon, a.lat, a.lon, altM);
          return {
            flight: (a.flight || '').trim() || a.hex || '—',
            alt: g.alt, az: g.az, distKm: g.distKm,
            altFt: typeof a.alt_baro === 'number' ? a.alt_baro : null,
            gsKt: a.gs ?? null, track: a.track ?? null,
          };
        })
        .filter((p) => p.alt > -2)            // below local horizon → drop
        .sort((a, b) => a.distKm - b.distKm);
      interval = BASE_INTERVAL_MS;             // success → reset backoff
      onUpdate({ status: 'ok', planes, ageMs: Date.now() });
    } catch (e) {
      interval = Math.min(interval * 2, MAX_INTERVAL_MS);
      onUpdate({ status: 'error', planes: null, ageMs: Date.now(), error: String(e) });
    }
    schedule(interval);
  }

  function schedule(ms) { if (!stopped) { clearTimeout(timer); timer = setTimeout(tick, ms); } }
  tick();
  return { stop() { stopped = true; clearTimeout(timer); } };
}
