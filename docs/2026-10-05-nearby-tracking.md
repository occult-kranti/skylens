# Nearby satellites and aircraft — implementation and evidence

Research/decision date: 2026-10-05 (America/New_York). Baseline published SkyLens `dcaebfbf92c67c15d0cedb7c46c888e565165f88`, tree `1b6f1a2e08cf79639a94d7bba4ffb5c20259f23b`; local equivalent `e139142`. Workbench Pages source was independently rechecked and now reports `workflow`; its earlier owner action is resolved. This release belongs to SkyLens and preserves the existing Workbench handoff.

## Product and architecture decision

Task: point a phone at the night sky, switch satellites/planes on or off, select a plausible catalogued object, and see its direction, distance and data age. Camera, Auto AR and manual exploration remain independent. No optical-recognition claim, camera upload, mandatory account or paid API.

Independent AI roles reviewed satellite propagation, aircraft data access, mobile interaction, geometry and skeptical QA. Panel-led product redesign and Impeccable guide bounded design/verification passes. This is engineering review, not human usability research or physical-phone validation.

- Keep persistent Satellites / Planes / Status controls; detailed lists, sources and filters belong in the existing Sky panel. Aircraft sharing needs an explicit per-visit recipient/location disclosure. Provider changes never silently send coordinates elsewhere.
- Satellites use the global **stations + visual** catalogue subset and local observer-relative propagation, filtered to the observer's sky. Upgrade the pinned MIT satellite.js engine to7.1.0 and CelesTrak OMM JSON only after independent Vallado reference vectors pass. Retain the two-hour request reservation, cache, cancellation and stop-on-first-error rules. This is not every satellite.
- Default satellite view: above-horizon, fully sunlit candidates when the Sun is at or below−6°. Provide all-above-horizon inspection. Shadow/solar calculations have stated approximate model/date limits; brightness, clouds and naked-eye visibility are unknown.
- Aircraft use a bounded nearby query, default50nautical miles (92.6km).25/50/100NM controls affect aircraft ground radius, not satellite slant range. AvioADSB remains the default after current browser-readable200; adsb.fi v3 is an explicit experimental alternate after its browser fetch failed and a single HTTP diagnostic returned403. Official terms and actual delivery take precedence over the initial candidate preference. No silent multi-provider fallback.
- Prefer broadcast geometric WGS84 altitude; mark pressure-altitude fallback approximate. Convert WGS84 ECEF to local ENU including known/assumed observer ellipsoid height. Preserve report time separately from receipt time. Bounded short motion estimation must be labelled and expire; old data cannot continue plausible live guidance.
- Reuse the existing camera projection, label collision budget, selected-object panel and search. Smooth between short satellite samples in direction space; don't add a rendering framework or global map. Nearby aiming candidates rank angular distance from the view, not certainty of optical identification.

## Bounded acceptance ledger

| ID / priority | Expected behaviour and dependency | Owner / files | Validation | Status |
|---|---|---|---|---|
| N0 P0 | Recover clean baseline, measure before edits, verify hosting | Lead / docs | Published/local tree parity; baseline npm suite; source bytes | Baseline recovered; measurements captured; Workbench Actions confirmed |
| N1 P1 | Current browser-compatible feeds with correct permission/attribution | Data research / tracking-apis.md | Official sources, one bounded browser GET per candidate; payload timestamps and CORS | Completed: official matrix in aircraft-nearby-sources.md; current CelesTrak/Avio evidence in evidence/nearby/; alternatives failed, no bypass |
| N2 P1 | OMM satellite propagation, age/height/illumination metadata | Satellite / satellites.js, vendor, fixtures | Independent Vallado near/deep-space vectors, parser bounds, TTL crossing, horizon/shadow cases | Completed: satellite-nearby-methods.md, pinned7.1.0 source manifest,17 satellite groups and12 feed-policy groups pass |
| N3 P0 | Correct aircraft geometry and time/altitude semantics | Aircraft / planes.js, aircraft-geometry.js, tests | WGS84 reference/cardinal/raised-observer cases, stale/future/ground rejection, lifecycle/quota tests | Completed: WGS84 ECEF/ENU, explicit provider schemas,15s estimates/20s overlay/60s list;13 aircraft groups pass |
| N4 P1 | Simple switches, source consent, useful mobile list/details | UI / index.html, ui.js, style.css |320/390/landscape/desktop;44px controls; no overflow; stop/no-request/paused states | Implemented: direct44px controls, per-provider consent,25/50/100NM, source/status/details; 6 nearby browser journeys pass across4 viewports;≥44px hit targets |
| N5 P1 | Integrate smooth motion, nearby aiming and stale-target cleanup | Lead / main.js, nearby.js, render.js, sensors.js | Replay frames, angle wrap, unknown height, expiry, background/off cleanup | Implemented: next-second spherical interpolation,3 angular candidates,80 markers/layer, stale selection cleanup, height; numerical gates pass |
| N6 P0 | Verify calculations and camera/manual journeys without regressions | Skeptic/QA / tests | Existing npm/browser gates + focused mocked-feed journeys + source delivery evidence | Completed: full npm test,12 existing browser journeys +6 nearby journeys; source evidence recorded; physical-device checks explicitly pending |
| N7 P0 | Publish exact tested release to existing Pages site | Lead / workflow, release docs | Successful CI/deploy, live release.json SHA, real public-route check | Local gates passed; final publication outcome is recorded by the PR/main workflow and linked release.json |

Review1 chooses this architecture. Review2 challenges working geometry, freshness, consent and state transitions. Review3 checks the integrated release and actual deployment. One batched visual inspection, one repair confirmation at most; fix material defects rather than repeat style reviews.

## Source decisions and limits

- [CelesTrak GP formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php) and [usage policy](https://celestrak.org/usage-policy.php): public elements, explicit JSON format, larger catalogue IDs, limited refresh frequency. Public availability is not a blanket open-data licence.
- [satellite.js](https://github.com/shashwatak/satellite-js): MIT SGP4 implementation;7.1.0 fixes a sunPos radians error. Use the pure JavaScript modules, not optional WASM. [Vallado verification files](https://celestrak.org/publications/AIAA/2006-6753/) provide independent propagation vectors.
- [adsb.fi API/terms](https://github.com/adsbfi/opendata/blob/main/README.md): nearby v3, personal/noncommercial use, attribution/link required, at most1request/second; no mandatory key. Proposed polling is slower than the permitted maximum.
- [AvioADSB](https://avioadsb.org/docs/api): CC BY4.0 data; anonymous100requests/day/network and1/10seconds. Keep quota controls and disclose limited session duration.
- [adsb.lol](https://api.adsb.lol/docs): ODbL live API; production contact requested, dynamic limits. Alternative researched, not silently substituted. [Airplanes.live](https://airplanes.live/api-guide/) researched; broader current terms could not be completely retrieved.
- [OpenSky terms](https://opensky-network.org/about/terms-of-use): written agreement required for operational live-product use; excluded as a permission-free default.
- [readsb JSON](https://github.com/wiedehopf/readsb/blob/dev/README-json.md): ordinary JSON timestamps are seconds; v2-style API timestamps are milliseconds. `seen_pos` is position age; `seen` is any-message age. `alt_geom` is feet above WGS84 ellipsoid. Own receiver support is a later integration requiring user infrastructure/HTTPS/CORS; GPL receiver/viewer software does not license third-party hosted data.

Physical phone alignment, compass uncertainty, local receiver coverage and actual visibility must remain separate from automated geometry/browser proof. No complete globe-wide aircraft coverage is promised. User phone coordinates are disclosed only to the selected aircraft provider after explicit activation; satellite propagation stays local.

## Executed panel decisions and release boundary

Review1 reused the static application, existing camera projection, menus and calculation cadence. Separate agents owned satellite engine, aircraft geometry, UI, source research and independent QA; root owns integration and release. Review2 verified independent WGS84/Vallado cases, 15/20/60-second semantics, consent/cancellation and parser limits. Browser integration exposed an aircraft details kind/name mismatch, now repaired. Mobile review restored the compact simulated-sky/Return to now row and disabled below-horizon aircraft guidance. Harness checks were corrected to actual stable satellite IDs and visible canvas markers rather than an unrelated hidden panel button.

P2: an owned readsb receiver could remove community-feed quota dependence, but needs hardware, a reachable HTTPS/CORS endpoint and validation; no arbitrary proxy or private key in Pages. Full-globe aircraft map, all-satellite catalogue and pass prediction are separate products/data/validation costs, not implied by this near-field release. P3 image recognition remains unimplemented; camera pixels are never used to identify a light. Brightness, clouds and receiver completeness are unmeasured. Existing Workbench calculations and observing handoff are preserved.

The README human checklist assigns physical-phone alignment and local source/coverage checks. No account creation is required for the implemented default experience.

Review3: both Chromium suites passed after the single visual repair;17 nearby screenshots were reviewed across four viewports. Notifications now stay inside an open tools panel instead of covering the persistent switches; simulated time remains explicit. The final status cleanup also keeps the legacy aircraft source indicator off when the layer is off. No remaining material release finding; physical-device and provider-coverage limits remain explicit. [Current release identity](https://occult-kranti.github.io/skylens/release.json) and [Actions](https://github.com/occult-kranti/skylens/actions/workflows/pages.yml) provide publication evidence for the exact deployed commit.
