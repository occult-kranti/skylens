# Satellite guidance methods and API

Implemented/researched 2026-10-05. This module estimates where catalogued Earth satellites lie relative to an observer. It does not inspect camera pixels, recognize objects optically, or establish phone alignment. Satellite subpoints on Earth are contextual information; the camera direction uses the observer-to-satellite line of sight, not the subpoint bearing.

## Source, delivery and scope

Public [CelesTrak GP](https://celestrak.org/NORAD/documentation/gp-data-formats.php) JSON supplies only the `stations` and `visual` groups. The latter is CelesTrak's “100 (or so) Brightest” catalogue, **not** a current magnitude prediction. An ISS shortcut should select NORAD **25544**. Physically attached station modules may have separate catalogue IDs and nearly identical positions; keep their identities while avoiding overlapping labels.

The fixed requests use `gp.php?GROUP=stations&FORMAT=JSON` followed by `GROUP=visual&FORMAT=JSON`. There is no account, token, mandatory paid API, or uploaded observer location. The provider sees an ordinary network request and IP address; camera frames remain local. A static documentation fetch is not proof of current browser CORS delivery. Live provider verification is a separately coordinated release check; unit/browser fixtures do not contact CelesTrak.

[CelesTrak policy](https://celestrak.org/usage-policy.php) requires no more than one download per two-hour GP update and stopping on non-200 responses. The prior persisted request reservation is retained: reserve before a request, stop at the first HTTP/network/parse failure, and allow neither toggles nor manual refresh to evade the interval. Aborts prevent late cache or metadata publication; the reservation remains because the server might already have received the request. Failed refreshes retain the last successful cache, then the bundled legacy TLE snapshot. Partial success is disclosed and cannot overwrite a complete persisted cache. Cache freshness is recalculated on passive reads as wall time advances, without making another request.

The cache key remains `skylens.tle.v1` for compatibility but now accepts both legacy TLE rows and OMM wrappers. Old per-record group membership is unknown and stays `[]`; a catalogue-wide snapshot group list cannot establish each object's membership. New rows retain the actual source group. Successful cache time, request time, element epoch and selected propagation time are separate quantities.

## Orbital data and engine

Vendored [satellite.js 7.1.0](https://github.com/shashwatak/satellite-js/releases/tag/7.1.0), MIT, reproduces SGP4/SDP4 with its WGS72 propagation constants. The runtime native-ESM graph excludes optional WASM. See [vendor provenance](../vendor/README.md) and the per-file source/output hashes in `vendor/satellite/upstream.json`.

OMM input accepts CelesTrak's omitted-field defaults **EARTH / TEME / UTC / SGP4** and rejects conflicting explicit values, nonzero ephemeris types, invalid numbers, eccentricity outside `[0,1)`, mean motion outside `(0,20]` rev/day, angles outside their stated intervals, malformed dates and nondecimal/out-of-range catalogue IDs. The mean-motion bound is an application constraint for this Earth-satellite catalogue, not an engine accuracy statement. Full IDs through nine decimal digits are retained. Duplicate records use the newest epoch and union source memberships. Inputs are bounded to 1,000 records per group and output to 1,000 unique records.

CelesTrak epochs without `Z` are explicitly interpreted as UTC; dates with other offsets are rejected. JavaScript retains milliseconds, so submillisecond OMM precision is truncated. Legacy TLE rows require two consistent 69-character lines and valid checksums; their two-digit year convention remains 1957–2056. JSON avoids that year/catalogue-number limitation. TLE parsing remains available for migration and the bundled fallback.

Propagation accepts UTC instants in calendar years **1900–2100**, latitude `[-90,90]` degrees, east-positive longitude `[-180,180]` degrees, and observer ellipsoidal height `[-500,10000]` metres. This input range is not a promise that modern elements describe historical or future spacecraft. A record is omitted when the **absolute** selected-instant/epoch separation exceeds seven days. That seven-day cap is a display policy, not a seven-day accuracy guarantee. Maneuvers, atmospheric drag, epoch quality and decay can make errors significant much sooner. No covariance or positional error bound is available here.

SGP4 produces a TEME position in kilometres. `gstime` plus `eciToEcf` supplies the upstream simplified Earth-fixed transform; `ecfToLookAngles` subtracts the observer position using the library's WGS84 ellipsoid. Azimuth is degrees clockwise from true geographic north, altitude is geometric degrees, and `rangeKm` is the slant range. There is no atmospheric refraction, terrain/horizon masking, Earth-orientation correction or geoid-height conversion. Height defaults to **0 m**, not an inferred GPS elevation. Propagation and additional community decay checks reject invalid/decayed/nonfinite states rather than inventing a position.

## Illumination and observing filter

The paired upstream `sunPos` / `shadowFraction` functions use a low-precision equatorial-of-date Sun approximation alongside the satellite TEME state, as documented by satellite.js. No unrotated J2000 Astronomy Engine vector is mixed into that calculation. The Sun model's stated apparent-coordinate accuracy is about **0.01° for 1950–2050**; illumination and Sun altitude are explicitly unavailable outside those years. This approximation is adequate for a broad shadow/twilight guide, not precision eclipse-contact timing.

`shadowFraction` estimates the fraction of the Sun disc covered by a spherical Earth of radius **6378.135 km**: zero is sunlit, one is umbra, and intermediate values are penumbra. It uses approximate apparent-disc overlap, without atmosphere or a nonspherical Earth limb. Numerical endpoint tolerance is `1e-8`. It is not a satellite brightness calculation.

“Sunlit night candidates” requires all three conditions: geometric satellite altitude at least **0°**, geometric observer Sun altitude at most **−6°**, and fully sunlit classification. The −6° threshold is an explicit simple twilight choice; near-horizon atmosphere and local light pollution can still prevent observation. “All above horizon” may show daylight and shadowed objects with their status. Candidate status never guarantees naked-eye or camera visibility: object size, attitude, reflectivity, phase angle, exposure, cloud and glare are not modeled. [Kelso's observing discussion](https://celestrak.org/columns/v03n01/) motivates the separate horizon/darkness/illumination conditions.

## Exported module contract

`initSatellites({signal?})` retains its asynchronous cache/provider lifecycle. `loadRecsFromList(rows)` is a synchronous diagnostic hook accepting legacy `{name,l1,l2,groups?}`, raw OMM objects, or `{omm,groups}`; it never fetches or writes storage. `parseOMM(textOrArray, group?)` parses bounded records; `ommEpoch(text)` returns epoch milliseconds or `null`. `parseTLE`, `tleEpoch`, `elementAgeDays`, `satTotal` and `satMeta` remain available.

```js
propagateNow(date, lat, lon, minAlt = 0, {
  observerHeightM = 0,
  nextSampleSeconds = 1, // 0 disables; range 0…5 seconds
})
```

Each returned satellite includes:

| Fields | Meaning |
| --- | --- |
| `id`, `noradId`, `kind`, `name`, `groups` | Stable object identity, full decimal catalogue number and known source memberships. Existing five-digit IDs retain leading zeros for saved-item compatibility. |
| `alt`, `az`, `rangeKm`, `geo` | Geometric observer direction/range and `{lat,lon,heightKm}` geographic subpoint. |
| `observerHeightM`, `sampleTimeISO` | Exact observer height and propagated UTC instant. |
| `epoch`, `epochISO`, `ageDays`, `epochAgeDays` | ISO epoch aliases; absolute age for filtering and signed selected-time-minus-epoch days. |
| `source`, `sourceRetrievedAtISO` | Current delivery provenance; retrieval time is not the element epoch. |
| `shadowFraction`, `illumination`, `observerSunAlt` | Fraction or null; `sunlit/penumbra/umbra/unavailable`; geometric Sun altitude or null. |
| `visibility` | `{candidate,reasons}` with human-readable reasons. This field is an observing filter, not detection confidence. |
| `next` | `{dateISO,alt,az,rangeKm}` or null; independent propagation including future Earth rotation. |

Call at approximately **1 Hz**. The root renderer can interpolate **unit direction vectors** between `sampleTimeISO` and `next.dateISO`; do not interpolate raw azimuth across north or extrapolate beyond the sample interval. Frozen/simulated time should remain frozen, and a changed date/location must invalidate prior interpolation. If the future sample crosses the seven-day limit, input year boundary, or fails propagation, `next` is null while a valid current sample remains usable. Near-zenith motion needs particular testing.

`satMeta()` retains retrieval/request/failure/group fields and adds `failed`, `suppressed`, `oldestAgeDays`, `sampleTimeISO`, and `observerSunAlt` after propagation. `failed` counts rejected current states; `suppressed` counts age omissions. Invalid observer input returns `[]` without a provider call.

## Validation and measurements

Run:

```sh
node tests/satellites-nearby.mjs
TZ=Pacific/Honolulu node tests/satellites-nearby.mjs
node tests/tracking-status.mjs
node tests/astronomy.mjs
```

The 17 satellite test groups cover ten independently published [Vallado verification vectors](https://celestrak.org/publications/AIAA/2006-6753/): Vanguard 00005 (near-Earth), 04632 (deep-space, backward propagation), and Molniya 08195 (resonant orbit), plus the published decayed 28872 case. Numerical source paths and immutable blob hashes are recorded in `tests/fixtures/vallado-sgp4.json`. Position tolerance is **0.00001 km**, velocity tolerance **0.00000001 km/s**; observed maximum component differences are `4.92e-9 km` and `4.98e-10 km/s`. These measure faithful reproduction of the published algorithm, not real-world orbit accuracy.

The ISS OMM fixture is converted from the existing bundled TLE for representation equivalence and mocked delivery, not an independent position reference. Its OMM/TLE comparison permits **20 m** for truncated epoch precision. Analytic WGS84 zenith/range/height cases, geometric shadow limits, malformed/model/date validation, polar/dateline behavior, invalid propagation, epoch cutoff, future-sample timing, cache/abort races and preserved legacy identifiers are also tested. Four Sun-altitude cases (1950, 2000, 2026, 2050) agree with the separate Astronomy Engine 2.1.19 implementation to **0.0023°**, under a declared **0.025°** test tolerance.

Measured on 2026-10-05 in this Linux x64 container, Node **24.19.0**, 173 bundled records, London `(51.5°,0°)`, height 0, selected `2026-10-02T00:20:00Z`, all-horizon output, 200 warmups then 1,000 synchronous batches:

| Calculation path | Median | p95 |
| --- | ---: | ---: |
| Prior 4.1.4, one position/look-angle sample | 0.259 ms | 0.504 ms |
| 7.1.0, geodetic position, illumination, two position samples | 0.953 ms | 2.006 ms |

The richer batch costs more CPU; both produced 173 records. These are headless calculation timings, not mobile camera frame rates. Vendor JS bytes fell from 89,224 to 64,091 due partly to emitted formatting; no network-load improvement is claimed. Phone CPU, frame pacing, heat, north calibration and actual camera alignment remain physical-device checks. Browser mocks establish data delivery and interaction behavior only.

## Attribution and remaining limits

satellite.js is MIT with the complete upstream licence retained. CelesTrak is credited as the GP-data source and its usage policy applies; public access is not a blanket open-source licence for its full catalogue. Vallado et al. (2006) provide the independent numerical reference, mirrored in python-sgp4; no second propagation engine is shipped.

No precise brightness, pass-event prediction, conjunction assessment, maneuver forecast, all-satellite coverage, or navigation/safety use is claimed. No additional ISS/spacecraft API is needed for this bounded camera-guidance path. Live CORS/provider availability and phone alignment must be reported separately from deterministic test results.
