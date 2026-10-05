# Current globe release

See [Globe verification](globe-verification.md) for the current integrated checks, evidence, deployment procedure and remaining human validation. The dated entries below are historical checkpoints; earlier Pages-setup failures were resolved and are not current blockers.

# Nearby tracking candidate verification — October 5, 2026

Owning repo: occult-kranti/skylens; baseline published`dcaebfbf92c67c15d0cedb7c46c888e565165f88`. Workbench Pages source independently reports`workflow`; no companion runtime changes in this release. Publication identity and workflow result will be attached to the release PR and this release's live`release.json`. Historical records below are prior checkpoints.

- Full`npm test` passed on Node24.19.0/Linux, including new13 aircraft groups,17 satellite groups and nearby unit-vector/selection tests, plus all existing astronomy, names, observing, sensors, feeds, rendering and handoff checks. The updated npm command and CI run all of these.
- Independent WGS84 numeric reference cases and published Vallado near/deep-space vectors pass. Ten Vallado component samples reproduce the reference to maximum4.92×10⁻⁹km; this is algorithm reproduction, not orbital prediction accuracy. Four solar-altitude cross-checks against Astronomy Engine differ by≤0.0023°. Satellite tests also passed under Pacific/Honolulu.
- Existing real-Chromium regression suite:12journey groups passed under/skylens/, including320×568,390×844,844×390,1365×900 and640×512 DPR2reflow; denial, motion/camera lifecycle, Hindi/search/saved/location/time/Tools and mock provider failure.
- Nearby real-Chromium suite:6journey groups passed,17screenshots at320×568,390×844,844×390,1440×1000. All8layout measurements had no horizontal overflow; primary switches were at least106×44px and hit-testable. Real SGP4 with mocked OMM; nonempty aircraft fixtures; consent/cancel, range, source change/re-consent,403/429, request cancellation, background/simulation pause,20s sky expiry and60s report expiry. Camera was never implicitly opened.
- Browser integration found a raw-aircraft kind/name mismatch; repaired before passing. A short-screen simulated-state banner was restored; below-horizon plane guidance disabled. The single visual repair moved open-panel notices out of the persistent switches; both suites passed again. A targeted follow-up asserts the legacy aircraft status says off after disabling. Independent numerical/lifecycle review found no remaining material issue in its bounded scope.
- Actual provider delivery is separate: CelesTrak stations/visual OMM200with23/156records and valid epochs; AvioADSB200with current empty London25NMpayload. Alternative provider browserfetches failed; optionalfiHTTPdiagnostic403. No bypass, repeated polling diagnostic or private coordinates. Details/artifacts:docs/evidence/nearby and [provider matrix](aircraft-nearby-sources.md).

Automated/mocked nonempty tracks do not prove an actual nonempty live feed, optical identity, physical camera alignment, satellite brightness, terrain/cloud visibility or complete aircraft coverage. iOS/Android field checks, screen-reader use and realphoneFPS/battery remain pending. The roughly20-minute Avio anonymous daily polling allowance remains a material limit. The candidate retains local astronomy/manual fallback during feed errors; first-load offline support is not promised.

# Release verification — 2026-10-03

## Auto AR and observatory redesign — October 5, 2026

[PR #9](https://github.com/occult-kranti/skylens/pull/9) adds independent phone-direction tracking with optional camera, responsive observatory controls and calculated sky-graphic refinements. Candidate `75d56defd5139a4e95094fb2a29e7b4afba9eded` passed [run 37357130995](https://github.com/occult-kranti/skylens/actions/runs/37357130995), verify job 111922275625. This is browser/test evidence, not a publication claim for that candidate.

The complete existing Node suite passed, plus 14 new motion-controller and 6 graphics cases. Real Chromium/Playwright 1.58.2 on GitHub Ubuntu/Node 22 completed 12 journey groups under `/skylens/`: 320×568, 390×844, 844×390, 1365×900 and 640×512 CSS pixels at DPR 2; independent camera/motion start, stop and denial; delayed permission cancellation; stale recovery; listener/video cleanup; authorized motion-only foreground return; existing Hindi/search/saved/location/time/Tools journeys. The DPR-2 case is a 200%-layout-reflow equivalent, not native browser zoom or physical pinch testing. Actual canvas coordinates confirmed that a rolled north guide remains within one pixel when samples become stale. Ordinary contexts made no external requests; optional-feed failure was mocked separately. Browser diagnostics were empty. No live provider probe was repeated.

Thirty-five screenshots were downloaded for the bounded visual review. The initial passing automated run still exposed a real short-screen defect: tools had too little usable content height and could scroll primary controls out of view. The CSS repair separates operating controls and tools on short landscape screens and recovers space on short portrait screens. The strengthened release gate requires at least 140 CSS pixels of visible panel height plus fully visible, hit-testable primary controls; passing navigation alone is insufficient. Final source status is recorded in the [Auto AR milestone](2026-10-05-auto-ar-roadmap.md), and PR #9 retains the exact final head, checks and merge identity. Publication uses the existing main-only Pages workflow and its exact-SHA `release.json` verification; [current live metadata](https://occult-kranti.github.io/skylens/release.json) is the authoritative published commit.

Confirmation: repaired runtime `dce0fbbba41fd06e9c1bc246a9a9a7eb5a9c0ec8` passed [run 37358512902](https://github.com/occult-kranti/skylens/actions/runs/37358512902), verify job 111926921252. All 12 journey groups passed with empty diagnostics. The 36 measured panels remained at least144 CSS pixels high (landscape Explore175px; reflow297px), and all72 primary-control samples were fully visible and hit-testable at44–48px height. The affected short-screen screenshots were inspected after repair. The final documentation-only checkpoint leaves these application assets unchanged; its required PR/main gates and generated live metadata identify the released revision.

Static text/surface contrast was calculated from CSS sRGB values for `text-1`, `text-2`, `text-3`, `accent` and `warn` against `bg`, `glass` and `glass-2`: minimum 7.40:1 normally and 7.51:1 in night mode. This is not a blanket contrast claim for arbitrary camera frames. Source-size costs and unchanged 1 Hz calculation cadence are in [performance.md](performance.md). Independent logic review and repaired findings are in [the skeptical review](2026-10-05-auto-ar-review.md).

Physical iOS/Android optical alignment, magnetic interference, actual permission sheets, native zoom, screen-reader behavior, mobile FPS and battery use remain unperformed device checks. The README assigns those actions; none requires a new account for current core calculations.

## Current publication status — live

[SkyLens](https://occult-kranti.github.io/skylens/) was published successfully on October 5, 2026 at 2:02 p.m. America/New_York (18:02 UTC). After the user enabled GitHub Actions as the Pages source, [run 37329557778 attempt 2](https://github.com/occult-kranti/skylens/actions/runs/37329557778/attempts/2) completed successfully. Deploy job 111908177216 passed Configure Pages, Deploy validated artifact and Verify published release identity. Its log verified `367f6ee8b5ea63478e61f07e17860324ad3097bb`; an independent public fetch of [release.json](https://occult-kranti.github.io/skylens/release.json) returned the same SHA and `validation: node-and-playwright`. The homepage was available over HTTPS.

The published application includes the direct Show Hindi / Hide Hindi control from PR #7. The initial publishing blocker is resolved, and the README human-action checkbox has been marked complete. No calculation or application code changed during deployment recovery. Future documentation or application commits receive their own workflow and release identity.

The historical checkpoints below describe the earlier implementation and failed attempts; their administration warnings are superseded by this successful launch. Physical phone alignment and screen-reader validation remain pending.


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

PR #6 merged as `be2799b8210bea5d20a49b2e9360db55dae6c89f`. [Main run 37328227174](https://github.com/occult-kranti/skylens/actions/runs/37328227174) passed verify job 111824323989; deploy job 111824855680 failed Configure Pages at 2026-10-05 14:53:35 UTC. Site lookup returned `Not Found`, then first-time creation returned `Resource not accessible by integration`. This confirms the administrator gate remains; it is not an application-check failure. The subsequent direct Show Hindi / Hide Hindi control uses the same verified calculation/persistence architecture and its own required PR browser gate.
