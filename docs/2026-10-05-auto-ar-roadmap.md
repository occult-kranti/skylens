# Independent Auto AR and observatory redesign — October 5, 2026

User request: automatic phone-direction tracking with and without camera, plus expert UI/UX redesign and stronger purposeful graphics. Owning repository: occult-kranti/skylens. Production 9480f5df is verified live; local 7c1a54a contains that source with recovered ancestry. No unrelated changes were present. Work proceeds on feat/auto-ar-observatory-2026-10.

## Brief and boundary

Open the sky, start Auto AR, and point the phone. The rendered sky follows orientation without acquiring a camera stream. Enable Camera to put the same calculated overlay over live video; disabling or losing the camera preserves requested tracking. Explicit Manual/drag/keyboard cancels following. Camera is never restarted silently. Motion requests use a tap where required; after backgrounding, only authorized session motion intent may resume, with a fresh sample.

Redesign the interface as an observatory instrument: compact reachable primary actions, legible context, clear uncertainty, accessible sheets/lists and scientific direction/horizon graphics. Preserve all real tools and calculations. No visual recognition, artificial alignment claim, decorative fake positions or new remote service. Physical iOS/Android alignment remains a separate required device check.

## Architecture review

The existing controller tied the motion listener to successful camera acquisition, required cameraSession to project sensor attitude, and stopped motion whenever video stopped. The new tracking controller owns permission, listener, timeout, intent and generation independently. The application owns composition with camera state and resets smoothing on a lens-axis change. Current screen rotation is used for projection without changing the sensor sample's freshness timestamp. Relative/magnetic/absolute provenance remains explicit; true north is not independently verified.

## Task and evidence matrix

| ID / priority | Problem and expected behavior | Dependency / owner / files | Approach and acceptance | Validation / status |
|---|---|---|---|---|
| A1 P0 | Camera-off currently means no tracking | Baseline; camera agent, new tracking.js/tests | Independent permission/listener controller; idempotent starts, late-result cancellation, pause/resume, honest silence | 14 controller cases pass; implemented |
| A2 P1 | Integrate Auto AR in drawn and camera sky | A1; lead, main.js | Sensor basis independent of video; camera stop/denial retains intent; explicit manual cancels it; front/rear reset and rotation compensation | Complete: 26 camera cases, independent coordinator replay and real Chromium lifecycle/rolled-canvas replay pass in run 37358512902 |
| U1 P1 | Crowded controls and weak hierarchy | A2 contract; UX agent, index/ui/css, DESIGN.md | Observatory layout, primary Auto AR and independent camera, bottom/side console, progressive status, reachable Hindi/search/alignment, all tools preserved | Complete: 35-shot batch, short-screen repair and strengthened Chromium confirmation; minimum visible content 144px; primary actions directly reachable |
| G1 P1 | Hard-to-read sky/selection graphics | U1 palette; renderer agent, render.js | Scientific horizon/cardinals, marker separation, static selection/aiming, camera contrast; preserve positions/Hindi/collision rules | Complete: 6 geometry cases and real screenshot review pass; positions, Hindi and collisions preserved |
| Q1 P0 | New lifecycle could silently regress privacy or permissions | A1/A2/U1; browser/release agent, browser.mjs | Sensor replay without getUserMedia, camera off/denial, manual cancel, hidden/resume, stale recovery, previous flows | Complete: 12 Chromium journey groups, 36 panel measurements and 72 primary-control checks pass in run 37358512902 |
| V1 P0 | Unverified integration assertions | All; independent skeptic, review doc | One working review and repair confirmation for material correctness/lifecycle findings | Architecture and working review complete; 3 material findings repaired and independently confirmed in 2026-10-05-auto-ar-review.md |
| D1 P0 | Need tested published revision | V1; lead, workflow/docs | Existing read-only PR gate, tested merge, Pages deploy and matching live release.json | Release record: PR #9 final checks/merge, main-only Pages workflow, and public release.json exact-SHA verification; links below |

## Measurements and bounded reviews

Baseline source sizes using individual Python gzip compression: HTML/CSS 37,632 raw / 11,321 gzip bytes; application JS 147,695 raw / 50,599 gzip bytes. Existing slow celestial calculations remain at 1 Hz, projection follows display frames. No phone FPS/latency improvement is inferred from code changes.

Pass 1: architecture contracts and existing screenshots before implementation. Pass 2: skeptical working-feature review. Pass 3: one batched screenshot/workflow review, one repair batch and at most one confirmation. Only material correctness or accessibility failures justify further corrective verification. Final evidence distinguishes mock sensors/camera, actual browser behavior, published release identity and unperformed physical tests.

## Release and handoff

Runtime candidate `dce0fbbba41fd06e9c1bc246a9a9a7eb5a9c0ec8` passed [run 37358512902](https://github.com/occult-kranti/skylens/actions/runs/37358512902). The bounded screenshot repair was confirmed with measured usable content: minimum144px at320px portrait,175px landscape,297px reflow-equivalent,384px mobile and438px desktop for selected-time Explore. All72 sampled primary actions were fully visible and hit-testable. Actual canvas projection also preserved roll during a stale interval. A prior repair run's failure came from the test helper treating a box-less CSS `display:contents` ancestor as a clipping box; correcting that geometry did not reduce any acceptance threshold.

The final documentation commit preserves that exact runtime. [PR #9](https://github.com/occult-kranti/skylens/pull/9) records its final checks and merge SHA. [Main deployment runs](https://github.com/occult-kranti/skylens/actions/workflows/pages.yml) gate publication on the same Node/browser checks and independently verify that public [release.json](https://occult-kranti.github.io/skylens/release.json) matches the deployed SHA; use that generated record rather than a self-referential hardcoded release hash in this source. [Live application](https://occult-kranti.github.io/skylens/).

No new account or API key is needed. Physical iOS Safari/Android Chrome alignment, real permission sheets, compass disturbance, native zoom, assistive technology and mobile energy/FPS remain explicit device work in the README and camera/Auto AR methods. Existing deferred weather, image recognition, complete satellite-pass visibility and broader tradition-specific calendars are unchanged by this focused milestone; their source/dependency limits remain in the original roadmap.
