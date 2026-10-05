# Selected-object observing times

Implemented and researched 2026-10-05. `js/observing.js` adds next rise, set and upper-transit times to an object detail request using the already bundled Astronomy Engine 2.1.19. No second calculation engine, network request, sensor or paid service is needed.

## Contract and supported inputs

`calculateObjectEvents(AE, item, date, loc)` is synchronous. It returns `rise`, `set` and `transit` as ISO UTC strings or `null`, plus a human-readable `note`. Invalid/unsupported inputs and engine failures return all three times as `null` with an `error` code, so the UI can distinguish an unavailable calculation from an actual absence of horizon events.

- `date` is the current or simulated UTC `Date`, with input years 1900–2100. Search covers the following **48 hours**, not the current civil day. An input at the end of 2100 can therefore return an event in the first two days of 2101.
- `loc.lat` and `loc.lon` are finite degrees north/east in −90…90 and −180…180. The observer is at sea level. GPS accuracy, terrain and height corrections are not estimated here.
- Supported bodies are Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus and Neptune, identified by the existing body ID/kind contract.
- Named fixed stars require `kind: 'star'`, a nonempty name, J2000 `raH` in sidereal hours [0,24) and `dec` in degrees [−90,90]. Existing HYG catalogue rows supply these coordinates.
- Deep-sky objects, satellites and aircraft currently return an explicit unsupported result for this feature. They are not silently treated as planets or fixed stars without coordinates.

Every returned event is checked against the selected instant and 48-hour end. The caller should cache by object identity **and** selected time/location, then invalidate when any of those changes. The function never uses the device's local time zone and does not modify the input date or location.

## Rise/set and transit definitions

Solar-system bodies use `AE.SearchRiseSet` with direction +1 for rise and −1 for set, a two-day limit, and zero observer elevation. It applies the engine's standard **34 arcminute atmospheric refraction** assumption. Sun and Moon events refer to the **upper limb**, accounting for angular radius; planets and stars are points. This differs intentionally from an unrefracted geometric altitude of zero in the sky overlay.

Upper transit uses `AE.SearchHourAngle(..., 0, ..., +1)`: the next crossing of the observer's local upper meridian. It can occur while an object remains below the horizon; a transit is not a claim that the object is visible. At an exact geographic pole, this module withholds transit because a unique local meridian is not defined.

A missing rise or set means **no such crossing in the 48-hour search window**. The note does not extrapolate that to an entire year or invent a polar event. Polaris in London and the polar summer Sun provide explicit no-rise/no-set fixtures. A single missing event does not prevent a valid other event from being returned.

Weather-dependent refraction, the visible terrain horizon, buildings and the observer's elevation can shift real rise/set observations. Milliseconds in the serialization are the engine's computational output, not a claim of millisecond observational accuracy. Display minutes for planning and retain the method note.

## Fixed-star frame and reserved slot

Astronomy Engine accepts user-defined J2000 stars through eight engine-global slots. This module reserves **`Star8`**, assigns the selected star's J2000 RA/declination and an effectively infinite distance of 1,000,000 light-years, then immediately performs all three searches **without an await, callback or other asynchronous interruption**. The next call overwrites the same reserved slot. No current SkyLens application module uses the other fixed-star slots. Do not use `Star8` elsewhere or insert asynchronous work between its definition and searches.

The engine transforms the J2000 definition to the date of observation, including precession/nutation and its apparent-coordinate handling. Proper motion is unavailable in the compact shipped star catalogue; a physical distance/parallax is also unavailable and is deliberately suppressed by the synthetic distance. Star times are therefore planning estimates, particularly toward the ends of 1900–2100 and near a grazing horizon. The existing canvas uses a J2000-to-horizontal matrix and does not fully reproduce the event search's apparent-star treatment; small aberration-level differences are below this planning feature's stated minute-level validation tolerances.

The HYG catalogue contains a solar origin record named **Sol**, with fixed coordinates RA 0 / Dec 0 and magnitude −26.7. That row is not a fixed celestial star. The observing adapter explicitly rejects it; the Sun must always use the ephemeris body. The application catalogue loader/generator must filter the solar row while preserving existing IDs for other saved stars.

## Independent validation

Run `node tests/observing.mjs`. The suite uses primary reference values and limiting geometry rather than merely comparing calls to the same search function.

| Reference | Inputs | Published result / acceptance |
| --- | --- | --- |
| US Naval Observatory daily data, API 4.0.1 | London 51.5° N / 0° E, 2026-10-05, UTC | Sun rise 06:07, upper transit 11:48, set 17:29; Moon upper transit 07:36, set 15:38. Each within 2 minutes of the minute-rounded reference. |
| USNO daily data, independently fetched by the skeptical reviewer | Delhi 28.6139° N / 77.209° E, 2026-10-05, UTC+05:30; search begins 2026-10-04T18:30Z | Local Sun 06:16/12:10/18:03 and Moon 00:36/07:45/14:48 for rise/transit/set. Convert to UTC and compare within 2 minutes. |
| J2000 spherical limiting case | Sirius RA 6.75248 h, Dec −16.71612°, London; starts 2000-01-01T12:00Z | Independent spherical horizon equation at −34′ and J2000 GMST 18.697374558 h, sidereal rate 1.00273790935; all events within 1 minute. This allows apparent/mean frame differences. |
| Circumpolar geometry | Polaris Dec 89.26411°; latitude 51.5° N | No rise/set; a meridian transit still exists. Southern latitude −33.9° has no rise/set while the star stays below the horizon. |
| Polar summer/winter | Sun 2026-06-21, latitude 89° or exact ±90° | No fabricated rise/set; exact-pole transit withheld. |

Additional checks exercise all supported planets, following-day Moon rise, changed time and longitude, engine failures, invalid inputs, unsupported Sol/DSO data, unchanged input objects, repeated star lookups and isolation from another engine slot. These tests establish the bounded calculation contract; they do not establish physical phone alignment or local visibility through weather.

## Sources read 2026-10-05

- Primary USNO London response: https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-05&coords=51.5,0&tz=0
- Primary USNO Delhi response: https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-05&coords=28.6139,77.209&tz=5.5
- USNO sidereal time definitions/approximation: https://aa.usno.navy.mil/faq/GAST
- Astronomy Engine programming reference (`DefineStar`, `SearchRiseSet`, `SearchHourAngle`): https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md
- The shipped `vendor/astronomy.js` 2.1.19 implementation and API comments are authoritative for this release's frame, rise/set and star-slot behavior; current upstream documentation is not assumed to change the pinned runtime.
- NOAA solar-position/rise-set equations, used to cross-check the horizon/refraction convention: https://gml.noaa.gov/grad/solcalc/solareqns.PDF

No upstream source code from USNO or NOAA is shipped as a new dependency. The existing Astronomy Engine MIT attribution continues to apply.
