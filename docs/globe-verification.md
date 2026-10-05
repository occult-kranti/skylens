# Globe release verification — October 5, 2026

Owning repository: `occult-kranti/skylens`. Published baseline: `9b9fa56722c605b96cabdb4cb0a2e6855a9e4188`. This release adds the separate `globe.html` route and direct Sky navigation; it does not replace the Workbench or its MCP server. Local checks below were run against the integrated implementation, not inferred from agent completion messages.

## Checks actually completed

- Full `npm test`, Node24.19.0/Linux x64: all existing suites plus16 globe-geometry groups,20 traffic/worker groups and the one-use Globe→Sky identity handoff. Geometry includes1,715 independent d3 projection comparisons, poles/date line, inverse and visible-hemisphere picking. Receiver tests cover both timestamp schemas, global unclipped rows, duplicate age,32MiB/60,000-row limits, Web Locks/request reservations, worker execution/abort, background/source replacement and late replies.
- Existing real-Chromium Sky suite:12 journey groups, including five viewport/reflow conditions, Hindi names, constellations, saved observers, search, time exploration, camera/motion denial and lifecycle, Pages base paths and no unrequested feeds.
- Existing Nearby suite:6 journey groups and17 screenshots, with retained permission, freshness, range, source/cooldown and simulated-time assertions. Its restart fixtures now respect the shared provider reservation instead of expecting an immediate second request.
- New Globe suite:6 journey groups,22 screenshots and12 layout states across320×568,390×844,844×390 and1440×1000. Every measured primary control is at least44px and hit-testable; selected map centre stays above/outside the inspector. Shared Sky navigation also passes at320×568 and560×320, including no horizontal overflow.
- Globe journeys exercise keyboard/mouse/wheel/pinch zoom bounds, GPS grant/denial, front/back hemisphere picking, reported ground/unknown-altitude points, search/category/reset, follow/manual cancellation, same-source stop/resume after panning, source long-text wrapping, successful empty/error/CORS/403/429 cases, abort/background/expiry, real local SGP4 with fixture elements, and native browser Worker success/termination. Globe→Sky→Globe does not transfer receiver authorization or replace the saved observer. Fixture time/data are deliberately synthetic, never published as live reports.
- Reproducible real-Canvas benchmark/regressions:3 density cases,7 label/selection/collision cases,8 bounded-grid cases and9 pixel-identical cached-versus-fresh cartography cases. Selected-last picking, far-side/stale exclusion and disposal pass. Cartographic centre, zoom, dimensions and palette changes invalidate the cache.
- Syntax checks and `git diff --check` pass. The small-phone panel obstruction found in screenshot review was repaired. The later keyboard-test failure was a fixture synchronization issue after view/readout rendering was coalesced into requestAnimationFrame; the harness now advances two actual mocked frames before reading the unchanged quantitative assertions.

The lead inspected mobile, landscape and desktop images and the UI reviewer inspected the complete bounded batch. Rendering uses actual geometry and synthetic test telemetry, not generated scientific images. The source matrix's critical AvioADSB/adsb.fi access rules and consumer/API separation were independently checked against the official pages by the lead.

Raw structured records: [browser journeys](evidence/globe/browser-results.json), [Canvas](evidence/globe/canvas-benchmark.json), [UI comparison](evidence/globe/ui-benchmark.json), [projection](evidence/globe/projection-benchmark.json), [source sizes](evidence/globe/source-sizes.json). Screenshots are workflow artifacts; fixtures/benchmarks are excluded from the Pages artifact.

## Measured cost and optimization

These desktop measurements do not establish mobile FPS, battery use or physical camera latency. Shared Linux environment, Intel Xeon8573C; Node24.19.0 for pure math and recorded Chromium user-agent for UI/Canvas. No live network is part of the workload.

For60,000 unchanged synthetic records at900×740/DPR1,5 warmups then9 rounds of10 UI updates: median closed-panel update **5.67→0.11ms**, open-object-list **8.07→0.21ms**. The original source fixture is retained in `tests/fixtures/globe-ui-before-cache`; run `tests/globe-ui-benchmark.mjs` to reproduce. Index/count/match reuse removes repeated full-catalogue scans during gestures. New snapshots still rebuild those structures; this is not a whole-app speedup. Controller pointer events also coalesce into one rendered update per frame.

Current complete Canvas command-submission medians at900×740/DPR1:1,000 records **5.85ms** with cached geography / **28.25ms** while rotating;20,000 **20.20/34.35ms**;60,000 **23.85/42.10ms**. First60,000-record draw **68.10ms**. Ten samples per warm/rotation condition; excludes compositor presentation and phone hardware. These are new-feature costs, not a before/after improvement claim. Symbol count is capped at1,600; label budgets vary12/22/35 by zoom. High-zoom local graticules are bounded at5,000 input vertices.

Pure cached projection of60,000 points costs **1.2905ms** median; uncached projection plus a full-list pick costs **20.4641ms**. These are **different workloads**, so they are not a speedup ratio. Details/reproduction: `tests/globe-benchmark.mjs`;100 warmups,9×100 iterations,390×844 mathematical viewport.

Static source sizes, individually gzip-compressed with Python `mtime=0`: existing Sky HTML/CSS **47,814/13,422→48,465/13,564 raw/gzip bytes**; repository application JS **226,517/75,240→318,072/104,985**. The new Globe HTML/CSS costs approximately22KB raw/7KB gzip; exact final inventory is in the JSON. New pinned d3 subset **22,478/8,658** and Natural Earth land **138,160/51,269** bytes are loaded only by the Globe route. This is source inventory, not a network waterfall, initial load time or compressed HTTP guarantee.

## Deployment and handoff

Use the existing Actions Pages workflow: Node tests, all three browser gates, tracked static archive, main-only deploy, then exact-SHA `release.json` and `globe.html` checks. Repository Pages configuration was independently verified as `workflow`, HTTPS enabled, before release. No branch protection is bypassed. The release PR records exact source/main commits, successful run links and the final live-browser check; [published identity](https://occult-kranti.github.io/skylens/release.json) identifies the served revision.

Actual live-provider delivery is separate from these mocks. Earlier dated CelesTrak and regional AvioADSB diagnostics remain in `docs/evidence/nearby`; they do not establish a global feed. The final release report records any new bounded live check explicitly. No denied provider is retried or bypassed.

Remaining work: README lists physical phone/screen-reader/nearby field validation and optional feeder/account/HTTPS/CORS setup. No reviewed unrestricted global aircraft source was established; wider coverage requires a permitted source and its actual receiver footprint. Consumer paid-app subscriptions do not include this application's API rights. Terrain, street-level maps, historical flight playback, weather and route databases remain source-dependent extensions. No paid service or mandatory account was introduced.
