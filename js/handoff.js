// SkyLens ↔ Studio v1. This pure file is mirrored at
// astrology-sim-ant/assets/js/core/sky-handoff.js; keep shared fixtures in sync.
// Fragments never enter the HTTP request, but remain visible in browser history
// and to scripts on the destination page. No permission or live stream is shared.
const DESTINATIONS = Object.freeze({
  studio: 'https://occult-kranti.github.io/astrology-sim-ant/pages/studio.html',
  skylens: 'https://occult-kranti.github.io/skylens/',
});
const FIELDS = ['skyV', 'skyAt', 'lat', 'lon', 'skyMode', 'skyLoc', 'skyObject', 'skyName', 'skyKind', 'skyNames'];
const REQUIRED = ['skyV', 'skyAt', 'lat', 'lon', 'skyMode', 'skyLoc', 'skyNames'];
const KINDS = ['sun', 'moon', 'planet', 'star', 'constellation', 'dso', 'satellite', 'plane'];
const ID_PREFIX = { sun: 'body', moon: 'body', planet: 'body', star: 'star', constellation: 'const', dso: 'dso', satellite: 'sat', plane: 'plane' };
const fail = message => { throw new RangeError(`Sky handoff: ${message}`); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function exactKeys(value, allowed) {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('unexpected record fields.');
}
function text(value, limit, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > limit || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value)) fail(`invalid ${label}.`);
  return value;
}
function instant(value) {
  if (typeof value !== 'string') fail('an explicit whole-second UTC instant is required.');
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.000)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) fail('use an explicit whole-second ISO instant.');
  const [, y, mo, d, h, mi, s, zone] = m;
  const local = new Date(0);
  local.setUTCFullYear(Number(y), Number(mo) - 1, Number(d));
  local.setUTCHours(Number(h), Number(mi), Number(s), 0);
  if (local.getUTCFullYear() !== Number(y) || local.getUTCMonth() !== Number(mo) - 1 || local.getUTCDate() !== Number(d) || local.getUTCHours() !== Number(h) || local.getUTCMinutes() !== Number(mi) || local.getUTCSeconds() !== Number(s)) fail('that date or clock time does not exist.');
  let offset = 0;
  if (zone !== 'Z') {
    const hh = Number(zone.slice(1, 3)), mm = Number(zone.slice(4));
    if (hh > 23 || mm > 59) fail('invalid ISO offset.');
    offset = (hh * 60 + mm) * (zone[0] === '-' ? -1 : 1);
  }
  const date = new Date(local.getTime() - offset * 60000);
  if (date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) fail('supported sky dates are 1900–2100.');
  return date.toISOString();
}
function normalize(record) {
  exactKeys(record, ['dateISO', 'lat', 'lon', 'mode', 'locationSource', 'object', 'names']);
  if (!Number.isFinite(record.lat) || Math.abs(record.lat) > 90 || !Number.isFinite(record.lon) || Math.abs(record.lon) > 180) fail('latitude/longitude must be finite geographic degrees.');
  if (!['current', 'simulated'].includes(record.mode)) fail('invalid origin time mode.');
  if (!['demo', 'selected'].includes(record.locationSource)) fail('invalid observer provenance.');
  if (!['en', 'hi', 'bilingual'].includes(record.names)) fail('invalid naming preference.');
  let object = null;
  if (record.object != null) {
    exactKeys(record.object, ['id', 'name', 'kind']);
    const { id, name, kind } = record.object;
    text(id, 96, 'object identity'); text(name, 100, 'object name');
    if (!KINDS.includes(kind) || !/^[a-z]+:[A-Za-z0-9][A-Za-z0-9:._ -]*$/.test(id) || !id.startsWith(ID_PREFIX[kind] + ':')) fail('invalid object identity or category.');
    object = { id, name, kind };
  }
  return { dateISO: instant(record.dateISO), lat: Object.is(record.lat, -0) ? 0 : record.lat,
    lon: Object.is(record.lon, -0) ? 0 : record.lon, mode: record.mode,
    locationSource: record.locationSource, object, names: record.names };
}

export function parseSkyHandoff(hash = '') {
  if (typeof hash !== 'string') fail('fragment must be text.');
  const raw = hash.replace(/^#/, '');
  const params = new URLSearchParams(raw);
  if (![...params.keys()].some(key => key.startsWith('sky'))) return null;
  if (raw.length > 1600) fail('fragment is too long.');
  try { decodeURIComponent(raw.replace(/\+/g, ' ')); } catch { fail('malformed fragment encoding.'); }
  const seen = new Set();
  for (const [key] of params) {
    if (!FIELDS.includes(key) || seen.has(key)) fail('unknown or duplicate fragment field.');
    seen.add(key);
  }
  if (REQUIRED.some(key => !seen.has(key)) || params.get('skyV') !== '1') fail('unsupported or incomplete version.');
  const objectKeys = ['skyObject', 'skyName', 'skyKind'];
  const hasObject = objectKeys.some(key => seen.has(key));
  if (hasObject && objectKeys.some(key => !seen.has(key))) fail('incomplete object identity.');
  const number = key => {
    const value = params.get(key);
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d{1,3})?$/.test(value)) fail(`invalid ${key}.`);
    return Number(value);
  };
  if (!/Z$/.test(params.get('skyAt'))) fail('fragment instant must be UTC with Z.');
  return normalize({ dateISO: params.get('skyAt'), lat: number('lat'), lon: number('lon'),
    mode: params.get('skyMode'), locationSource: params.get('skyLoc'), names: params.get('skyNames'),
    object: hasObject ? { id: params.get('skyObject'), name: params.get('skyName'), kind: params.get('skyKind') } : null });
}

export function buildSkyHandoff(record, target) {
  if (!Object.hasOwn(DESTINATIONS, target)) fail('choose the fixed Studio or SkyLens destination.');
  const value = normalize(record);
  const params = new URLSearchParams({ skyV: '1', skyAt: value.dateISO.replace('.000Z', 'Z'),
    lat: String(value.lat), lon: String(value.lon), skyMode: value.mode, skyLoc: value.locationSource, skyNames: value.names });
  if (value.object) {
    params.set('skyObject', value.object.id); params.set('skyName', value.object.name); params.set('skyKind', value.object.kind);
  }
  return DESTINATIONS[target] + '#' + params.toString();
}
