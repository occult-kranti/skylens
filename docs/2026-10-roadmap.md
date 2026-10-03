# SkyLens implementation roadmap — 2026-10-03

This is the evidence-led continuation of SkyLens-Roadmap.md. Earlier completion and performance claims are historical claims, not verification of this release.

## Ownership and baseline

The supplied `occult-kranti/astro-sim-ant` returns 404. The account contains two distinct applications: `skylens` (camera planetarium, main `335b1be90e7531a7d7b548d2efd406861ebcb28b`) and `astrology-sim-ant` (existing historical astrology workbench, main `3a3ce9953e47a078e659723a52187648f1f08486`). `astrology-sim` is another small Picatrix workbook; it is not the sky app. Preserve these products and connect useful workflows with links. Do not duplicate the workbench inside the camera viewport.

Skylens is vanilla ES modules, Canvas 2D and static JSON. Its checked-in tests initially fail because vendored dependencies are absent. Manual/AR projection, planets, stars, constellations, Messier objects, satellite propagation, aircraft, Moon and observing events already exist. There is no verified Pages launch: no Actions runs and has_pages=false. The other application's Pages run succeeds at its main SHA. Shell network and local Chromium currently fail sandbox socket restrictions; connector reads and local Node work. Physical phone checks are unavailable.

## Product and architecture decisions

The primary task is open Sky, enable camera, aim, select and understand an object. Permission requests begin from a direct user gesture. Manual exploration remains available without permission. Keep camera imagery local. Aircraft is an explicit optional external-location request. Use the existing Astronomy Engine across deterministic calculations; package a pinned local copy so core operation does not wait for a CDN. Keep sensor projection and ephemerides on separate schedules. Retain the existing scientific workbench and its pure calculation modules.

Navigation: Sky (search/layers/selection), Explore (Tonight, date exploration, solar system), Saved (favorites/notes), Settings (location, calibration, night palette), Charts & Calendars links to existing workbench plus new supported calendar tools. Use native controls, named inputs, visible focus, status text, and collapsible panels. Time simulation must remain visibly distinct from Now.

## Execution and acceptance matrix

Priority: P0 correctness/core failure; P1 requested central workflow; P2 validated extension; P3 costly/speculative research. Dependencies are task IDs. Status starts planned; final evidence belongs in VERIFICATION.md and release notes.

| ID / priority | Problem → expected behavior | Dependency / owner / files | Approach and acceptance | Validation / status |
|---|---|---|---|---|
| R1 P0 | Unverified ownership → pinned source baseline | Lead + repository agents; both repositories | Read instructions, branches, commits, issues, PRs, workflows; preserve source; isolated local branches | Connector tree/blob SHA records; baseline recovered |
| R2 P1 | Unbounded feature plan → coherent research decisions | R1; research agents; docs/product-research.md, docs/calendar-research.md | Official product/engine links, dates, licenses, existing-feature mapping and cost; consolidate overlap | Source-reviewed matrices; Complete; product and calendar matrices integrated |
| A1 P0 | Missing engine files → reproducible local core | R1; lead; vendor, package, index | Pin browser dependencies and preserve licenses; no unconditional CDN boot dependency | Node baseline and final checks; Complete; Node and final mobile/desktop CI passed (37095900450) |
| C1 P0 | Camera leaks/permission gesture loss → recoverable camera lifecycle | R1; camera + integration agents; sensors.js, main.js | Direct motion gesture; stop tracks/listeners on stop/background; permission error and retry; no unconsented GPS/network | Mock lifecycle tests, browser scenarios, phone pending; Complete; Node and final mobile/desktop CI passed (37095900450) |
| C2 P1 | Sensor/viewport mismatch → calibrated projection | C1; camera agent; astro.js, sensors.js, render.js | Apply heading to basis, screen rotation, cropped FOV, front camera disclosure, smoothing, heading quality; document magnetic/true uncertainty | Cardinal/rotation/crop/replay fixtures; phone pending; Complete; Node and final mobile/desktop CI passed (37095900450) |
| C3 P1 | No search/saved/time workflow → accessible selection and guide | A1 C1; lead + integration; ui.js/main.js/index/css | Search named stars/planets/DSOs including below horizon, favorites, notes, filters, live/simulated indicator, persistent camera control | Functional tests and accessible browser journey; Complete; Node and final mobile/desktop CI passed (37095900450) |
| E1 P1 | Recompute static sky every frame → cached ephemerides | A1; integration; main.js/sky.js/objects.js | 1Hz sky computation, frame-rate projection, suspend hidden activity, nonblocking optional feeds | Fixed-workload before/after timings; Complete; Node and final mobile/desktop CI passed (37095900450) |
| E2 P1 | Existing observing data lacks clear methods → useful Explore | A1 C3; lead; ui.js/events.js/new orbit module | Rise/set/twilight/phase and transit information; UTC labels; meaningful no-event states; educational orbital diagram with units and scale assumptions | Independent event/position references and polar cases; Complete; Node and final mobile/desktop CI passed (37095900450) |
| E3 P2 | Dynamic satellite data can mislead → freshness and failure handling | A1; lead; satellites.js/ui.js | Epoch age, fetch timestamp, stale suppression, no fabricated live positions | Stale/malformed/cache tests; Complete; Node and final mobile/desktop CI passed (37095900450) |
| T1 P0 | Existing date/house edge defects in workbench | R1; calendar agent; other repo core/shared modules | Strict dates, years 0–99, angle wrap, disclose high-latitude house fallback | Existing engine/audit plus independent fixtures; Implemented and locally verified in owning roadmap |
| T2 P1 | Birth time ambiguity → explicit supported chart inputs | T1; calendar agent; other repo chart/time modules | IANA gap/fold handling, unknown-time omission of houses, preserved tropical/sidereal/ayanamsha/aspects/transits/synastry | Published planetary fixtures and timezone boundaries; Implemented and locally verified in owning roadmap |
| K1 P1 | No organized cultural-calendar suite | T1; calendar agent; other repo new calculator | Reuse Gregorian/Julian, add supported named civil calendar conversions, Easter, Qibla, validated prayer methods; no universal-religion claims | Published conversion/event cases; Implemented and locally verified in owning roadmap |
| U1 P1 | Mouse-only/permission-heavy entry → accessible mobile controls | C1 C3; lead + UX advisor; index/ui/css | Native buttons, search labels, keyboard, reduced motion, no zoom lock, bounded overlays | Desktop/mobile inspection, 200% reflow and keyboard checklist; Complete; Node and final mobile/desktop CI passed (37095900450) |
| V1 P0 | Assertions mistaken for proof → bounded skeptical review | Implementations; independent reviewer | Challenge coordinate/chronology/privacy/lifecycle/core workflow claims, fix material defects | Review pass 2 plus tests; Complete; Node and final mobile/desktop CI passed (37095900450) |
| D1 P0 | No SkyLens hosting → tested GitHub Pages | V1; lead + release reviewer; .github/docs | Correct subpath, HTTPS, tests before deploy, default-branch-only; preserve current hosting | Job success and expected live content required; Implementation and main tests complete; blocked: administrator must enable Pages source GitHub Actions. Exact error and steps in VERIFICATION.md |
| V2 P0 | Unclear completion → release evidence and handoff | D1; lead + independent reviewer | Exact commits/PRs, tests, measured results, limitations, phone checklist; no local-build-as-deployed claim | Review pass 3; Complete; Node and final mobile/desktop CI passed (37095900450) |

## Bounded review gates

1. Architecture/feasibility: complete after actual source inventory and research. Confirm preserve vanilla static architecture, reuse engine, do not replace mature workbench. Current material findings: missing vendor files, telemetry/basis heading mismatch, camera cleanup, unsolicited aircraft location sharing, and non-default deployment branch trigger.
2. Working-feature skeptical review: independent agent checks behavior and calculations; fix material findings once, rerun affected checks.
3. Release review: inspect integrated artifact, test logs, commit/PR/workflow and live content. Phone verification stays explicitly pending rather than inferred from mocks.

## Extensions and honest release boundaries

Image recognition/plate solving (P3), weather service (P3), telescope hardware (P3), exhaustive observance databases (P2), new dasha variants (P2) and visual satellite recognition (P3) need separate validated data/engineering. Existing advanced astrology remains attributed to its tradition. Physical compass/FOV calibration cannot be certified without phones. Prayer methods, regional Hindu observances and observational calendars must never invent results to fill a page. Any unavailable requested P1 item stays incomplete with its exact blocker, not relabeled as a future optional feature.

## Implementation checkpoint

R1–U1 implementation is complete with local test evidence in VERIFICATION.md, camera-methods.md and performance.md. All feasible central camera, search/time/saved, observing/simulation, chart-input and supported calendar work was integrated. Related workbench details live in its docs/2026-10-roadmap.md. Review pass2 repaired material scientific/lifecycle findings. Final browser CI passed at 06f51fc2 and all four screenshots were inspected. PR #5 merged as 5b4cdd9c. The actual deployment outcome is recorded in VERIFICATION.md; phone/screen-reader checks remain explicitly pending.
