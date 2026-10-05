# Auto AR without a camera

Auto AR follows device orientation independently of the camera preview. The user can enable it with the camera off, combine it with a live camera, or return to manual exploration. It is a sensor-based sky projection, not visual object recognition. Tracking makes no camera request and uploads no sensor samples or camera frames.

## Controller contract

`js/tracking.js` exports `createTrackingController({ onSample, onState, ...adapters })`. Production defaults use the existing `requestMotionPermission` and `startOrientation` adapters from `sensors.js`; tests inject permission, subscription, support, monotonic clock and timer functions.

| Method | Behaviour |
| --- | --- |
| `start()` | Call directly in a button's user gesture. Requests motion permission synchronously before awaiting anything. Returns a promise of the current snapshot. Repeated calls while requesting, waiting, tracking or stale are idempotent. An established in-memory session grant can be reused. |
| `stop()` | Returns to off, removes the orientation subscription and watchdog, invalidates pending permission results and late samples. Disabled intent cannot automatically resume. Keeps an already established grant only in controller memory for another explicit start. |
| `suspend()` | While enabled, preserves intent, removes the subscription and timer, clears samples and enters paused. A permission result that arrives after suspension cannot establish a grant or restart tracking. |
| `resume()` | Never requests permission. Restarts only when intent remains enabled and an actual `granted` or `not-required` result was recorded before suspension. Returns to waiting until a fresh sample arrives. Repeated resumes do not duplicate listeners. |
| `state` | Frozen snapshot `{status, enabled, permission, lastSampleAt, headingSource, reason, resumeAllowed}`. Timestamps are milliseconds on the injected monotonic clock, normally `performance.now()`, not UTC epochs. |

`onState(snapshot)` reports transitions and heading-source changes. It runs before `onSample(sample)` for a newly active sample. Continuous same-source motion does not emit redundant state transitions. The application clears obsolete attitude when entering waiting, paused, off or failure states, then receives a new sample after tracking begins. A stale state retains the last full attitude, including roll, under a visible warning; it does not invent a level frame or renew the original timestamp. If no sample ever arrived, the manual viewport remains available.

| Status | Meaning and useful interface response |
| --- | --- |
| `off` | Manual exploration; no orientation listener or timer. |
| `requesting` | A user-requested motion permission call is pending. A browser permission prompt can remain pending until the user acts; cancelling Auto AR invalidates its eventual result. |
| `waiting` | Motion access is allowed, but no usable fresh sample has been received in this active session. Do not show an aligned or tracking indicator yet. |
| `tracking` | A valid recent sample is available. Display heading provenance and retain calibration controls. This is not proof of physical alignment. |
| `stale` | No usable first sample, or no newer sample within three seconds. The sensor listener remains available for recovery, with no repeating watchdog timer. Prompt movement or offer manual exploration. Silence can occur while stationary and is not proof that the hardware failed. |
| `denied` | Permission was denied; disabled intent, no subscription. Explain browser settings and keep manual controls available. |
| `unsupported` | Orientation API or secure browser context is unavailable; no permission prompt or subscription. Keep manual exploration available. |
| `paused` | Tracking intent was suspended, usually while hidden. No active listener or timer. Resume can reuse only an established session grant. If a permission prompt had not completed, re-enable from a user gesture. |
| `error` | Permission or subscription could not start. No controller subscription or timer remains; show a retry/manual path. |

There is no persisted “permission granted” preference. Reload creates a controller with unknown permission. Browser denial or revocation may manifest as missing events rather than a dedicated revocation event; the waiting/stale status handles that uncertainty without inventing aligned results. An explicit retry must remain available.

## Samples, heading and direction

Only finite W3C angle values are accepted: alpha 0–360°, beta −180–180°, gamma −90–90°, finite screen orientation and receive timestamp. Missing/nonfinite/out-of-range data, timestamps at least three seconds old, far-future timestamps and older out-of-order replays do not update the view or renew freshness. The adapter's sample time is retained; the controller does not turn delayed data into a fresh sample merely by delivering it.

Heading provenance is derived from the sample:

- `magnetic-compass`: a usable WebKit compass heading is present. Its uncertainty is retained; magnetic north is not automatically converted to true north.
- `absolute-sensor`: the event is earth-referenced according to the browser. True-north alignment is not independently verified.
- `relative`: orientation changes can follow the phone, but the yaw reference may be arbitrary. Align a known object using the existing heading correction.

Camera-off Auto AR uses the **rear-phone pointing axis** already tested in `correctedAttitude`: an upright phone with the reference heading north points the sky view north. An active front camera can use the existing reversed lens basis. The integration must reset smoothing when switching between front-camera and rear-phone conventions; otherwise it could interpolate between opposite directions. Calibration, refraction settings and selected sky time/location remain owned by the application, not this lifecycle controller.

Screen rotation changes the viewport basis without creating a new physical orientation measurement. The renderer may apply the current screen angle to the latest sample, while retaining its original receive timestamp. Do not mark a screen-rotation event as a fresh sensor reading. Further camera and projection conventions are documented in [camera methods](camera-methods.md).

## Resource ownership and validation

The controller owns one sensor subscription and at most one watchdog. Normal high-frequency samples reuse the timer; its next deadline uses the latest accepted sample timestamp. Backgrounding must call `suspend()`, foregrounding may call `resume()`, and teardown or Manual mode calls `stop()`. The controller neither requests location nor starts/resumes/stops a camera. The application keeps camera lifecycle independent; cameras must not automatically reopen when Auto AR resumes.

`node tests/tracking.mjs` passes 14 deterministic tests covering synchronous gesture permission, duplicate requests, granted-but-silent sensors, stale recovery, timestamp validation, heading provenance, stop and suspend cleanup, foreground resume, pending permission invalidation, out-of-order grants/denials, unsupported/error paths, reentrant synchronous subscriptions and controller-local permission memory. A real orientation-adapter replay confirms camera requests stay at zero, both sensor listeners are removed on pause/stop and the default rear-phone frame is preserved. Tests also verify a single reused watchdog rather than timer creation on each sensor frame.

These tests prove software lifecycle and replay behaviour. They do not verify physical-device alignment, compass accuracy or every mobile browser's permission UI. On iOS Safari and Android Chrome, separately check camera-off Auto AR, enabling/disabling the camera during tracking, denial/retry, a stationary three-second interval, portrait/landscape rotation, background/return, magnetic disturbance and a known celestial target. Confirm that a returning camera remains off while previously granted Auto AR can resume and wait for a fresh sample.
