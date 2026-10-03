# Release verification — 2026-10-03

Owning repository: occult-kranti/skylens. Companion calculators: occult-kranti/astrology-sim-ant. The supplied astro-sim-ant URL returned404; it is not a second name for either repository.

## Local evidence

Baseline recovered from main335b1be90e7531a7d7b548d2efd406861ebcb28b by connector, each of27 files checked against its Git blob SHA. No pre-existing local user edits. Main had no Pages workflow run or proven deployment. Initial npm test failed because engine modules were absent. Supplying pinned local dependencies restored36 existing passes before behavior changes.

Final `npm test` passed in Linux/Node24.19.0:

- 36 original catalogue/math/events/SGP4 checks.
- Independent six-body Astrodienst ephemeris comparison, 2024newMoon reference, polar no-crossing, Venus morning visibility, heliocentric finite vectors and element-age suppression.
- 26 camera cases: independent W3C matrices, rotation, FOV/crop, compass basis, front camera, north-wrap smoothing, label collisions and mocked lifecycle/permission failures.
- 10 integration cases: strict UTC input, storage/input corruption, cache invalidation, all-sky search, shared coordinate frame/time, abortable aircraft and unknown-altitude handling.

`node --check`, HTML ID/ARIA/label linkage checks, and `git diff --check` passed on edited files. No external string interpolation through innerHTML in the rewritten UI. Cross-repository links were corrected to the verified Skylens repository and existing natal page.

The independent camera architecture review is in camera-methods.md. The separate skeptical astrology review found/fixed four numerical defects; see the companion repository's2026-10-skeptical-review.md. Root reviewed integrated controller/UI contracts and reran both repositories' full Node gates. Those checks are not a substitute for browser behavior.

## Browser and device evidence boundary

Local HTTP server failed `listen EPERM127.0.0.1`; Chromium failed crashpad `setsockopt: Operation not permitted`. Consequently there are **no local screenshots or completed local browser journeys**. Strict Playwright journeys are committed in tests/browser.mjs and gated in the proposed Pages workflow. They exercise390px and1365px views, permission denial, synthetic camera start/stop/restart/pagehide, keyboard/manual exploration, location failure/manual input, search/save/notes, time simulation, persisted settings, project-prefix routing and absence of unrequested external calls.

CI browser results, screenshot inspection, deployment SHA and live URL verification are pending publication of this candidate. Do not claim deployed from these local tests. A release.json containing the tested commit is produced only by CI's artifact step. Workflow deploys only main after tests; it verifies that release.json at the HTTPS site matches the tested commit.

Physical iOS/Safari and Android/Chrome checks remain pending; use the precise checklist in camera-methods.md. Mocks do not establish optical FOV, compass north, sensor lag, camera rotations, memory behavior or alignment. Screen-reader testing is also pending.

## Measurements and limitations

See performance.md for reproducible conditions and raw rounds: catalogue workload866.687→42.695ms median over3600 synthetic frames,60 actual cached calculations (~95.1% less isolated catalogue work). Individual pass0.277→0.561ms due improved astronomy. This is not a phoneFPS, memory, battery or load-time claim. Vendor source is now local; raw source bytes increase while the core CDN dependency disappears.

Geometric projection remains sensor-based, with estimated diagonalFOV and manual north/pitch correction. Proper motion, visual recognition, weather, complete satellite illumination/pass prediction and telescope control are not implemented. Current metadata/feed age is disclosed; no guaranteed sky visibility or exhaustive catalogue coverage. Existing broad astrology/Vedic tools are preserved in their owning app; calendar variants and limits are documented there.

## First real browser gate

PR #5 run `37095245776` passed Node checks, then failed the unchanged manual-keyboard journey. Its actual screenshot showed a blank canvas and telemetry when reduced motion was enabled. The controller used a zero sentinel and skipped every first frame; a null sentinel now guarantees an initial frame before applying the 32ms reduced-motion cap. A regression covers initial timestamp zero, ongoing throttling and resume. Full `npm test` passes with 10 integration cases. The browser harness records browser errors and failure state; real CI recheck is required.
