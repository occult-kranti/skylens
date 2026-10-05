# Calculation methods and reference cases

Reviewed 2026-10-03. Calculated sky positions and traditional astrology interpretations are separate products. SkyLens performs astronomy; linked Workbench pages identify each traditional convention.

| Calculation | Input/convention/engine | Validation and limits |
|---|---|---|
| Planet/Sun/Moon horizontal coordinates | UTC Date, latitude north-positive, longitude east-positive in degrees, sea-level observer. Astronomy Engine 2.1.19 topocentric true-of-date Equator with light-time/aberration, geometric Horizon by default. | Engine upstream target ~1 arcminute; device sensors commonly dominate error. Six independent Astrodienst 2026 geocentric longitudes tested within0.05°. These longitude fixtures do not validate every topocentric case. |
| Stars/DSOs/constellations | J2000 RA hours and declination degrees; Astronomy Engine Rotation_EQJ_HOR applies precession and nutation. Camera frame east/up/south; azimuth north=0°, clockwise. | Fixed catalogue, no proper-motion propagation. Projection and horizontal transforms have independent cardinal/W3C cases plus engine cross-checks. UI time1900–2100 is a practical supported window, not uniform star precision certification. |
| Rise/set | Astronomy Engine SearchRiseSet, next24h, engine standard horizon/refraction conventions, elevation0m. | Explicit no-crossing state at poles. Real local horizon, buildings, mountains and atmospheric conditions are not modeled. |
| Transit | SearchHourAngle(planet, observer,0), next upper meridian crossing. | UTC date and clock shown, avoiding next-day ambiguity. |
| Astronomical darkness | SearchAltitude Sun centre at −18°; next48h. If already dark, start says “Already dark”. | Replaces20min scan. Geometric convention; no crossing does not mean an error. Twilight is not a weather/visibility forecast. |
| Moon phase/illumination | MoonPhase and Illumination.phase_fraction; SearchMoonQuarter. | Independent 2024-04-08 newMoon18:21UTC reference within5min. Phase labels are rounded eighths; exact quarter times are engine results. |
| Planet morning/evening | Elongation.visibility, not unsigned ecliptic separation. | Regression: Venus morning2025-06-01. Orientation relative to Sun alone does not guarantee observable brightness/horizon. |
| Meteors | Existing annual peak/window/radiant table; radiant converted to local horizontal coordinates. | Seasonal reference, not a current event feed. Annual peak times and actual rates vary; quoted ZHR is idealized, not expected local counts. |
| Solar system | Astronomy Engine HelioVector then Ecliptic-of-date. Distances AU, angle degrees, top-down north of ecliptic. | Linear radial distance within inner/all view; marker radii symbolic; z omitted; dashed circles distance guides. No n-body integration or physical planet-size simulation claimed. |
| Satellites | satellite.js 7.1.0 SGP4, OMM JSON with legacy TLE cache/fallback; observer WGS84 ellipsoid height in metres converted to kilometres. | Independent Vallado near/deep-space vectors; suppress absolute epoch age >7 days. Approximate shadow/Sun model 1950–2050, fully sunlit and Sun≤−6° night filter. See [methods and limits](satellite-nearby-methods.md). No brightness guarantee. |
| Aircraft | WGS84 ECEF→ENU using geometric altitude where present; labelled pressure-altitude fallback. Observer ellipsoid height supplied or explicitly assumed 0m. Source time + seen_pos, ground speed/true track/vertical rate for ≤15s estimates. | Independent WGS84 numeric cases plus age/angle/lifecycle tests. ≤20s sky overlay and ≤60s list; no optical identification or navigation. Provider-specific timestamp units and methods in [aircraft sources](aircraft-nearby-sources.md). |

## Published and independent references

* [Astronomy Engine documentation and upstream verification](https://github.com/cosinekitty/astronomy/tree/v2.1.19)
* [Astrodienst2026 tropical ephemeris](https://www.astro.com/swisseph/ae/2000/ae_2026d.pdf): 2026-01-01 00:00UT Sun280°34′07″, Moon66°43′, Mercury268°39′, Venus279°12′, Mars282°41′, Saturn356°10′. Reference transcription/tolerance0.05° in tests/astronomy.mjs.
* [NASA2024 total solar eclipse](https://eclipse.gsfc.nasa.gov/SEplot/SEplot2001/SE2024Apr08T.GIF) and [NASA lunar phase resources](https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html). NewMoon fixture is2024-04-08 18:21UTC; do not confuse geocentric phase with eclipse maximum18:17UTC.
* [W3C Device Orientation](https://www.w3.org/TR/orientation-event/) for independent matrix/axis cases; see camera methods for measured/estimated/calibrated distinctions.

Engine comparison tests are cross-checks, not independent validation of that engine. Automated hardware mocks do not establish real-camera registration. See VERIFICATION.md for what actually ran.
