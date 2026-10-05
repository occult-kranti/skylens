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

Real CI browser results and screenshot inspection passed, as recorded below. CI produces a release.json containing its tested commit; the main-only deployment job checks that the HTTPS site serves that exact identity. See the release record below for the actual deployment outcome.

Physical iOS/Safari and Android/Chrome checks remain pending; use the precise checklist in camera-methods.md. Mocks do not establish optical FOV, compass north, sensor lag, camera rotations, memory behavior or alignment. Screen-reader testing is also pending.

## Measurements and limitations

See performance.md for reproducible conditions and raw rounds: catalogue workload866.687→42.695ms median over3600 synthetic frames,60 actual cached calculations (~95.1% less isolated catalogue work). Individual pass0.277→0.561ms due improved astronomy. This is not a phoneFPS, memory, battery or load-time claim. Vendor source is now local; raw source bytes increase while the core CDN dependency disappears.

Geometric projection remains sensor-based, with estimated diagonalFOV and manual north/pitch correction. Proper motion, visual recognition, weather, complete satellite illumination/pass prediction and telescope control are not implemented. Current metadata/feed age is disclosed; no guaranteed sky visibility or exhaustive catalogue coverage. Existing broad astrology/Vedic tools are preserved in their owning app; calendar variants and limits are documented there.

## First real browser gate

PR #5 run `37095245776` passed Node checks, then failed the unchanged manual-keyboard journey. Its actual screenshot showed a blank canvas and telemetry when reduced motion was enabled. The controller used a zero sentinel and skipped every first frame; a null sentinel now guarantees an initial frame before applying the 32ms reduced-motion cap. A regression covers initial timestamp zero, ongoing throttling and resume. Full `npm test` passes with 10 integration cases. The browser harness records browser errors and failure state; real CI recheck is required.

## Successful real browser verification

[PR #5 run 37095687324](https://github.com/occult-kranti/skylens/actions/runs/37095687324) passed for candidate `e1791b916fd2cea56f76f5ba1e5e5e9ffce57b9a`. Real Chromium (Playwright 1.58.2, GitHub Ubuntu/Node 22) completed both 390×844 and 1365×900 journeys and the synthetic MediaStream start/stop/restart/pagehide scenario. Browser diagnostics were empty, all local assets resolved under `/skylens/`, and no unrequested external calls occurred. All four screenshots were inspected by the UI reviewer and coordinator. This supersedes the earlier pending-browser checkpoint.

Screenshot review found stacked transient messages obscuring the Explore controls during rapid actions. The final UI keeps one polite notification, cancelling the previous timeout; the browser assertion bounds notifications to one and captures Explore after dismissal. The final candidate passed the same gate again before merge. Physical phone and screen-reader checks remain pending.

## Final integration and review

[PR #5](https://github.com/occult-kranti/skylens/pull/5) merged tested head `06f51fc2da0cf9088bb0883d1754d52f7ee420de` as `5b4cdd9cddb0ffb76e2d77de26d4ffea2e2bfc2a`. [Final PR run 37095900450](https://github.com/occult-kranti/skylens/actions/runs/37095900450) passed all Node and browser gates. Its four screenshots were downloaded and inspected; Explore controls/results remain unobscured after the notification repair. Browser diagnostics are empty. All three bounded review passes are complete, including repairs and independent rechecks.

## Deployment outcome and required administrator step

[Main run 37096023612](https://github.com/occult-kranti/skylens/actions/runs/37096023612), for merged commit `5b4cdd9cddb0ffb76e2d77de26d4ffea2e2bfc2a`, passed its complete verification job. Deployment failed at `actions/configure-pages@v5`: `Create Pages site failed. Error: Resource not accessible by integration`. Pages has not yet been enabled for this repository; the workflow token has Pages write access but cannot perform first-time administration. The available GitHub connector exposes no Pages configuration mutation. A shell network permission attempt did not complete; no credential was exposed or restriction bypassed.

**SkyLens is not deployed at this checkpoint.** Its target URL is https://occult-kranti.github.io/skylens/ and returned not found during live inspection. The administrator must open https://github.com/occult-kranti/skylens/settings/pages and choose **GitHub Actions** as the source. Then rerun the failed deploy job or the main workflow. Success requires its live `release.json` to match the run's main SHA. No code change, paid service or token sharing is required.

The companion Workbench deployed successfully: https://occult-kranti.github.io/astrology-sim-ant/ . Its live release metadata independently fetched on 2026-10-03 contains merged SHA `0f7a7a3b1d2d3938d4424fecc47211b192217f8f`, and the new calendar page serves the expected method descriptions.

## Handoff

Implemented code, source-linked product research, calculation methods, attribution and measurements are committed. The sole infrastructure blocker is first-time Pages enablement above. Physical Android/Chrome and iOS/Safari alignment, camera rotation/front-lens/FOV calibration, sensor heading uncertainty and screen-reader checks remain explicit device-validation work, with steps in camera-methods.md. Deferred P2/P3 capabilities remain listed in the roadmap. Do not interpret sensor overlay as visual recognition or civil date converters as authority-specific observance calendars.

## Hindi/mobile/tracking continuation — 2026-10-05

[PR #6](https://github.com/occult-kranti/skylens/pull/6) preserves remote main `4e91d53ea08037042a7c5487e59c317985e55a09` and adds the milestone in [2026-10-05-hindi-mobile.md](2026-10-05-hindi-mobile.md). No changes were made to the companion Workbench in this continuation.

Implementation candidate `452a883bdd9340dd50f49b87c7a256c30cc3c676` passed [run 37325500833](https://github.com/occult-kranti/skylens/actions/runs/37325500833), verification job 111815076713. Node results: 36 baseline cases, independent astronomy fixtures, 26 camera cases, 17 integration cases, 13 naming groups, 14 observing cases, 11 tracking lifecycle cases, 14 offline feed-parser assertions and 4 constellation anchor cases. Syntax and whitespace checks also passed.

Real Playwright 1.58.2/Chromium on GitHub Ubuntu/Node 22 passed all six journey groups under `/skylens/`: 320×568, 390×844, 844×390, 1365×900; explicit feed-error/cooldown/opt-in controls; synthetic camera start/stop/restart/pagehide. `browser-results.json` reports `passed:true`, empty diagnostics and no failure. Zero external requests were allowed in the ordinary UI contexts; mocked orbital errors were explicitly isolated.

All 20 screenshots were reviewed; solar-label overlaps were repaired and all four final solar views were inspected again by the UI reviewer and coordinator. Independent review findings and repair confirmation are recorded in 2026-10-05-review.md. Failed earlier candidate runs were obsolete harness expectations (opening a hidden Saved panel; updated source-failure wording/stop policy), not silently omitted passing gates.

A separate one-time real API browser diagnostic succeeded in run 37324544677: current CelesTrak station elements and a fresh empty AvioADSB response were readable from the Pages security origin. See tracking-apis.md for exact timestamps, epoch freshness, headers, quota and limitations. This was a synthetic origin page, not a deployed application check. The temporary automatic probe was removed before the final passing run.

Application JS increased from 34,123 to 50,422 individually gzip-compressed bytes; see performance.md for reproducible source-size conditions. No phone FPS or initial-load improvement is claimed. Physical phones, actual sensor alignment, screen-reader behavior and continuous upstream availability remain outside this automated evidence.

At the final documentation checkpoint, first-time SkyLens Pages enablement remains blocked by repository administration access. README contains the administrator action and optional provider/account checklist; no private key or paid account is required for the current release. Merge/deploy status and exact final main SHA are available on PR #6 and its associated Actions runs. This document does not claim SkyLens has been published.
