# SkyLens0.4 — Globe and connected tracking workspace

A new [Globe view](https://occult-kranti.github.io/skylens/globe.html) provides worldwide drag/pinch/wheel/keyboard navigation, independent aircraft/satellite switches, an explicit regional query or permitted receiver connection, searchable/filterable loaded objects, selection, follow, session trails and a permission-isolated return to Sky. A persistent Globe entry joins existing Sky controls. The mobile inspector keeps selected targets visible and places actions before telemetry.

The scientific canvas uses pinned D3 clipping, public-domain Natural Earth land, original tested projection/picking and existing satellite.js SGP4. Bounded labels and adaptive grids preserve legibility. Receiver parsing runs in a cancellable worker; source ages, coverage, failures and quotas remain visible. No unrestricted global feed, historical flight archive, terrain or image recognition is implied.

[Seven-product premium research](premium-tracking-design-research.md), [design decisions](tracking-design-brief.md), [roadmap](2026-10-05-globe-roadmap.md), [methods](globe-methods.md) and [actual verification/performance](globe-verification.md) accompany this release. Consumer subscriptions and API rights are separate. Current publication identity is in [release.json](https://occult-kranti.github.io/skylens/release.json); the release PR records exact CI and live checks. No new mandatory account or paid service was introduced.

## Earlier releases

# Nearby satellites and aircraft — 2026-10-05

- Persistent Satellites/Planes on/off buttons and Nearby status, with44px mobile targets, one consent flow per provider/visit,25/50/100NM aircraft ground radius and explicit availability/quota states.
- Locally calculated satellite directions now use pinned MIT satellite.js7.1.0 and current CelesTrak OMM JSON. Sunlight/twilight filtering, orbital epoch, distance and approximate visibility reasons accompany the existing age checks and two-hour request policy.
- Aircraft use WGS84 observer geometry, explicit geometric/pressure altitude labels and report-age limits. Motion estimates stop after15s; sky markers/guidance expire after20s, list reports after60s. No silent provider fallback.
- Direction-space interpolation, selected-target marker priority and up to three angular candidates reuse the camera/manual projection. No visual recognition or camera upload.
- AvioADSB current browser delivery verified with a valid empty response; anonymous quota can limit continuous use to about20min/day. adsb.fi remains experimental after failed delivery checks. Physical phone alignment and nonempty live aircraft coverage are not certified.

See [nearby roadmap/evidence](2026-10-05-nearby-tracking.md), [methods](satellite-nearby-methods.md), [providers](aircraft-nearby-sources.md) and [verification](VERIFICATION.md). Historical milestones follow.

# Auto AR and observatory controls — 2026-10-05

- Auto AR follows the phone with or without camera video. Motion and camera permissions, denial, cancellation and cleanup are independent; camera never restarts automatically after backgrounding.
- Manual drag/arrow keys cancel following. Stale sensor warnings retain full last attitude rather than incorrectly levelling the view. Session grants are not persisted across reloads.
- Mobile bottom console and wide-screen side console put Auto AR, camera, Hindi names, search and alignment within reach. Expandable status explains uncertainty; existing Sky, Explore, Tools, Saved and Settings workflows remain available.
- Clearer calculated horizon/cardinals, open aiming reticle, selection corners and camera label contrast preserve actual projection and Hindi label collision rules. No generated scientific imagery or visual-recognition claim.
- New deterministic controller/graphics cases and real-browser replay cover permission races, camera-independent tracking, background cleanup and viewport changes. Physical iOS/Android alignment remains pending; see [the milestone](2026-10-05-auto-ar-roadmap.md) for final browser/publication evidence.

No new calculation engine, framework, remote font, account, paid API or data recipient. Astronomy Engine 2.1.19, satellite.js 4.1.4, source catalogues and documented conventions are unchanged.

# Hindi names, mobile observing and tracking — 2026-10-05

- Default Hindi + English naming, optional Hindi/English modes, mixed-script search, 42 named stars and all 88 IAU constellations (89 catalogue parts). Original IDs and astronomical positions remain language-independent.
- Search/save/guide to constellation drawing anchors; separate anchors correct inherited Serpens Caput/Cauda duplication. The HYG solar-origin row is excluded without shifting saved-star IDs.
- Selected-object next rise/set/transit for Sun, Moon, planets and named catalogue stars, with UTC/location snapshots and independent USNO reference checks.
- Mobile Explore splits Tonight and Solar system; Tools links the existing Workbench and explains local calculations versus optional feeds. Save, reuse and remove up to 12 named observing locations. Mixed-script orbit labels reserve markers/scale labels and use leaders.
- Satellite status discloses source, partial groups, fetch time, epochs and retry time; two-hour attempts/caches survive reload, errors stop remaining requests and cancellation prevents late writes.
- Aircraft uses truthful combined position age, expires stale reports, separates receipt/provider/position timestamps and stops at quota. No private key, paid account or new data recipient was added.
- README includes concrete Pages administrator, device, Hindi/accessibility and optional provider-account actions. [API delivery](tracking-apis.md) has actual Chromium evidence and explicitly bounded coverage.

Calculation engines remain Astronomy Engine 2.1.19 and satellite.js 4.1.4. Sky projection is sensor-based; physical-phone and screen-reader validation remain pending. Current CI/merge/publication evidence is linked from [PR #6](https://github.com/occult-kranti/skylens/pull/6); Pages is live after successful run 37329557778 attempt 2; first-time administrator setup is resolved.

# Camera-first release — 0.3.0

- Persistent Enable/Cancel/Stop/Retry camera; direct gesture motion permission; cleanup on pagehide/background/revocation; explicit manual fallback.
- Calibrated sensor basis, source-aware heading feedback, estimated diagonal lensFOV with cover-crop compensation, smoothing, front lens convention, collision-managed labels and guidance.
- Search named stars, planets and Messier objects, including below horizon; save favorites and observation notes; current/simulatedUTC visible; return to now; persisted location/settings.
- Shared precession/nutation across fixed catalogues,1Hz sky cache, nonblocking optional satellite data, aircraft off until explicitly enabled; honest data-sharing/freshness text.
- Correct morning/evening planets, precise astronomical twilight search, upper transit times, UTC event dates; lazy heliocentric solar-system diagram/table with units and scale disclosure.
- Local pinned MIT dependencies and corrected HYG CC BY-SA attribution. Accessible native dialog/tabs, named controls, keyboard exploration, focus states and unlocked zoom.
- Links preserve the mature companion astrology application rather than copying its calculators. New companion calendar/natal improvements have their own roadmap and test evidence.

Full Node and real mobile/desktop Chromium gates passed; screenshot findings were repaired and rechecked before PR #5 merged. See VERIFICATION.md for commit/workflow/deployment evidence. Physical alignment and assistive-technology checks remain pending.

Publishing status: both applications are live. SkyLens first-time setup was initially blocked by administration permissions, then resolved on October 5; see VERIFICATION.md for the successful deployment evidence.
