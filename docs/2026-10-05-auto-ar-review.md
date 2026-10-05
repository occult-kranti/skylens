# Auto AR architecture and skeptical review — 2026-10-05

Bounded review of the camera-independent tracking controller, its integration in `main.js`, sensor/projection adapters, new renderer presentation and directly related controls. The reviewer owns this document only; implementation changes belong to the lead and specialist agents. No external tracking API requests or physical-device checks were performed in this review.

## Architecture acceptance established before integration

- Tracking intent, camera state, permission, sample freshness and heading provenance must remain separate. Auto AR can follow the phone with the camera off; a camera failure or explicit camera stop must not stop motion tracking.
- Motion permission must be requested synchronously from the originating gesture. Manual mode cancels pending results and subscriptions. Camera cancellation affects video independently.
- Hidden/pagehide states stop active streams, sensor subscriptions and recurring work. Foreground may resume previously authorized tracking intent without prompting, but waits for a fresh sample. Camera does not reopen automatically.
- Relative, magnetic and absolute-sensor provenance must stay explicit. None establishes independently verified true north. Event silence may mean a stationary device; it does not establish failed hardware.
- Camera-off tracking uses the rear-phone axis. A front-camera transition changes that convention explicitly, resets smoothing and explains the change. Screen rotation may update the viewport basis without renewing a sensor timestamp.
- Manual drag/keyboard and sensor writes must not fight. A manual gesture stops Auto intent so later sensor or permission callbacks cannot undo that choice.
- New controls must have matching labels/actions and owned cleanup. Unsupported/denied/waiting states preserve usable manual exploration.

Baseline checks before integration: `node tests/camera.mjs` **26 passed**; `node tests/integration.mjs` **17 passed**.

## Working-feature findings

1. **Stationary sensor timeout discarded roll — repaired.** The integrated coordinator initially cleared both sensor and smoothing state whenever status was not `tracking`, including `stale`. After three seconds of silence it therefore replaced the full camera attitude with `makeBasis(az, alt)`, a zero-roll manual frame. Independent replay with alpha 0°, beta 90°, gamma 0°, screen angle 90° and a target at altitude 10°/azimuth 0° moved the target from `(129.47, 400)` to `(200, 258.94)` in a 400×800 viewport: a 90° roll change with no physical motion. The repair retains the full sample and smoothing state with `ar-stale` mode, applies the existing projection in both tracking/stale states, and still clears it for explicit Manual or a new/paused/failed session. Direct execution of the actual repaired `trackingChanged` and `frame` functions in an isolated Node VM with a recording renderer keeps the target at `(129.47, 400)` before and after the stale transition, retains the original receive timestamp `100`, and reports `status: stale`, `active: false`. This is a coordinator replay, not a browser or phone test.
2. **Paused button advertised Stop but restarted permission — repaired in source.** Backgrounding while permission is pending leaves paused intent with no established grant. Foreground correctly does not prompt. The initial UI labeled the control `Stop Auto AR`, while `toggleTracking()` treated paused status as a new start and requested permission. The corrected paused label is `Resume Auto AR`, matching that handler. Drag or keyboard exploration still explicitly stops tracking intent; the real browser journey remains a release gate.
3. **New UI observer ownership — repaired in source.** The initial chrome `ResizeObserver` and window resize listener lacked a returned disposer even though the application called `ui.dispose?.()`. Confirmed the returned `dispose()` now disconnects the retained observer, removes the exact window resize callback, cancels scheduled measurement/toast work and invalidates pending object details. Resize observations schedule a bounded animation-frame measurement rather than writing synchronously inside the observer delivery callback.

No material controller-level fault was found in the bounded pass: permission invocation is synchronous, generations reject stale grants and callbacks, one watchdog is reused during high-frequency samples, paused/off subscriptions and timers are released, and stale listeners can recover without claiming that silence proves sensor failure. Camera adapters retain their cancellation/revocation safeguards. Front-lens activation/deactivation resets smoothing and describes the rear-axis fallback. Current screen angle is applied without altering `receivedAt`. Renderer changes retain calculated point geometry, reject nonfinite coordinates and identify markers as symbols rather than resolved objects or camera recognition.

## Checks actually run

- `node tests/tracking.mjs`: **14 passed**.
- `node tests/camera.mjs`: **26 passed**.
- `node tests/render-graphics.mjs`: **6 passed**.
- `node tests/integration.mjs`: **17 passed**.
- Independent projection replay quantified the stale-roll defect above.

The passing controller tests did not cover that application-level roll transition, which is why the source/geometry review remains necessary. Browser screenshots and permission journeys, actual phone alignment and remote deployment identity require separate release evidence. Physical checks must include camera-off Auto, front-camera fallback, portrait/landscape, stationary intervals, denial/retry, pending permission background/return, manual gestures, and camera-off tracking continuity.

## Single repair confirmation

After the repairs, the reviewer re-ran tracking **14**, camera **26**, and renderer **6** test cases, all passing; `node --check js/main.js`, `node --check js/ui.js` and `git diff --check` also passed. The separate actual-coordinator replay above verified the previously missing stale-roll transition. No unresolved material finding remains within this bounded architecture/working-feature review. Physical-device checks, responsive screenshot assessment, live browser permission behavior and deployment verification remain explicitly pending their separate evidence.
