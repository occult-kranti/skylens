// Selected-object observing events. Reuses the supplied Astronomy Engine 2.1.19.
// Star8 is reserved by this module; definition and searches are synchronous,
// with no await/callback boundary at which another object's definition can leak in.
export const EVENT_WINDOW_DAYS = 2;
export const OBSERVING_STAR_SLOT = 'Star8';
const DAY_MS = 86400000;
const BODY_NAMES = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']);
const empty = (note, error) => ({ rise: null, set: null, transit: null, note, ...(error ? { error } : {}) });

function identify(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.kind === 'star') {
    // HYG's solar origin record is not a fixed celestial star. The Sun uses ephemerides.
    if (/^(sol|sun)$/i.test(String(item.name || '').trim())) return null;
    if (typeof item.name !== 'string' || !item.name.trim()
      || !Number.isFinite(item.raH) || item.raH < 0 || item.raH >= 24
      || !Number.isFinite(item.dec) || Math.abs(item.dec) > 90) return null;
    return { body: OBSERVING_STAR_SLOT, fixed: true, ra: item.raH, dec: item.dec };
  }
  const name = typeof item.id === 'string' && item.id.startsWith('body:') ? item.id.slice(5) : item.name;
  return BODY_NAMES.has(name) && ['body', 'sun', 'moon', 'planet'].includes(item.kind)
    ? { body: name, fixed: false } : null;
}

/**
 * Next events after an explicit UTC instant, within the next 48 hours.
 * @param {object} AE Astronomy Engine namespace; no extra engine is imported.
 * @param {object} item Solar-system item or named star with J2000 raH/dec.
 * @param {Date} date Current or simulated UTC instant, input years 1900–2100.
 * @param {{lat:number,lon:number}} loc Degrees north/east; sea-level observer.
 * @returns {{rise:string|null,set:string|null,transit:string|null,note:string,error?:string}}
 * Null means no event found in the bounded window, unless error is supplied.
 */
export function calculateObjectEvents(AE, item, date, loc) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())
    || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) {
    return empty('Choose a valid UTC instant from 1900 to 2100.', 'invalid-time');
  }
  if (!loc || !Number.isFinite(loc.lat) || Math.abs(loc.lat) > 90
    || !Number.isFinite(loc.lon) || Math.abs(loc.lon) > 180) {
    return empty('Choose a valid observer latitude and longitude.', 'invalid-location');
  }
  const object = identify(item);
  if (!object) return empty('Rise, set and upper transit are available for the Sun, Moon, planets and named catalogue stars with J2000 coordinates.', 'unsupported-object');
  if (!AE || !['Observer', 'SearchRiseSet', 'SearchHourAngle', ...(object.fixed ? ['DefineStar'] : [])].every(name => typeof AE[name] === 'function')) {
    return empty('Observing calculations are unavailable because the astronomy engine did not load.', 'engine-unavailable');
  }

  try {
    const observer = new AE.Observer(loc.lat, loc.lon, 0);
    if (object.fixed) AE.DefineStar(OBSERVING_STAR_SLOT, object.ra, object.dec, 1000000);
    const start = date.getTime(), end = start + EVENT_WINDOW_DAYS * DAY_MS;
    const asISO = value => {
      if (value == null) return null;
      const result = value.date;
      if (!(result instanceof Date) || !Number.isFinite(result.getTime())) throw new Error('Invalid engine event.');
      // Never expose an unbounded transit or a stale result before the selected instant.
      return result.getTime() >= start && result.getTime() <= end ? result.toISOString() : null;
    };
    const rise = asISO(AE.SearchRiseSet(object.body, observer, +1, date, EVENT_WINDOW_DAYS));
    const set = asISO(AE.SearchRiseSet(object.body, observer, -1, date, EVENT_WINDOW_DAYS));
    const atPole = Math.abs(loc.lat) === 90;
    const transit = atPole ? null : asISO(AE.SearchHourAngle(object.body, observer, 0, date, +1)?.time);
    const notes = [
      'Next events within 48 hours of the selected UTC instant; sea-level, unobstructed horizon.',
      'Rise/set include standard 34′ atmospheric refraction; Sun/Moon use the upper limb. Actual weather and terrain can shift these times.',
      'Upper transit means the local meridian crossing, even when the object is below the horizon.',
    ];
    if (object.fixed) notes.push('Fixed J2000 catalogue coordinates with precession/nutation; proper motion and stellar parallax are not modelled. These are planning estimates.');
    if (!rise && !set) notes.push('No rise or set in this 48-hour window. The object may remain above or below the horizon; no all-year visibility claim is implied.');
    else if (!rise || !set) notes.push(`No ${!rise ? 'rise' : 'set'} in this 48-hour window.`);
    if (atPole) notes.push('Upper transit is unavailable at a geographic pole, where a unique local meridian is not defined.');
    else if (!transit) notes.push('No upper transit found in the 48-hour window.');
    return { rise, set, transit, note: notes.join(' ') };
  } catch {
    return empty('Observing calculations could not be completed for this object, date and location. No event times are asserted.', 'calculation-failed');
  }
}
