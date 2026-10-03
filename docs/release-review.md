# SkyLens bounded release source review

Date: 2026-10-03. One source pass of integrated `js/main.js`, `js/ui.js`, `js/events.js`, `js/orbits.js`, `js/planes.js`, `js/satellites.js`, index, relevant CSS and browser journey script. This reviewer did not edit application files in this pass. Root reports `npm test` passing; this pass is a source integration review, not a repeated test run. Local browser execution is blocked; CI browser results remain a separate gate.

## Actionable findings

1. **P1: closing object details loses keyboard focus.** `ui.showInfo` saves a result button as `returnFocus`, then hides its ancestor with `setDock(false)`. `closeInfo` hides the card and calls `returnFocus.focus()` only if connected. The target is either still in the hidden dock (cannot receive focus), or disconnected because the one-second list refresh replaced it while details had focus. Preserve a trigger identity/panel and reopen before restoring focus, or at minimum focus a visible fallback such as the dock handle/sky. Browser regression: keyboard-open a result, wait >1s, press Escape or Close; assert focus is on a visible usable control.

2. **P1: solar-system range and keyboard focus reset on refresh.** `main.refreshSky` invokes `ui.orbit` when the minute key changes. `ui.renderOrbit` always calls `orbits.renderOrbit(host,date)` without the previously selected `outer` value; `orbits.renderOrbit` uses `outer=false` by default and replaces the whole host including its active toggle. Thus “Show all planets” reverts to inner planets at the next minute or changed time, and a focused toggle is removed. Keep the range in UI state and preserve toggle identity/focus when refreshing calculated positions. This is a user-setting/keyboard regression, not a preference over layout.

3. **P1 privacy wording does not match feed lifecycle.** The aircraft disclosure promises a request every ~12 seconds “while this view is active.” Actual `syncFeeds` condition is page visibility, enabled aircraft setting, real location and live time; requests continue when Traffic is no longer the selected panel or the dock is closed. Keep the intended background overlay behavior and say “while this page is visible and the feed is enabled,” or gate the request on the described view. Camera frames are not included in the feed, and coordinates are rounded as promised.

4. **P1 calibration wording names the wrong FOV quantity.** Settings help says “estimated diagonal angle after viewport cropping.” `cameraFov` accepts the source lens/video diagonal angle and then computes cover cropping. Describe this as the lens diagonal angle **before** viewport cropping. The integration also now uses diagonal FOV for manual mode (source dimensions are set equal to viewport), so remove the stale `docs/camera-methods.md` sentence that calls manual FOV horizontal.

5. **Small integration defect: pointer offsets are applied twice.** Main pointerup passes `event.clientX - rect.left` / `event.clientY - rect.top` to `renderer.hitTest`; renderer already subtracts the canvas bounding rect. Current full-viewport CSS has origin zero and masks the issue, but the contract is inconsistent. Pass client coordinates from main, or change the renderer contract once. Test a nonzero canvas origin to prevent regression.

## Reviewed behavior with no further blocker found in this pass

- Camera enable calls motion permission synchronously from the click; stop invalidates pending startup, cleans orientation/tracks, and pagehide/hidden pauses camera and compute/network activity. Late permissions/streams are checked against a session token.
- Live versus simulated UTC sky is visibly differentiated; input validates Gregorian overflow and range. The selected snapshot feeds bodies, objects, observing events and orbital views. Aircraft are disabled during simulation.
- Camera frames stay in the local video element. Aircraft requests require an explicit opt-in, reset to off on a new session, disclose the third-party endpoint and use rounded coordinates. Catalogues and calculation engines load locally.
- TLE epoch age is exposed; elements older than the seven-day policy are omitted, and satellite positions are not described as a visibility/illumination guarantee. Network loading does not block the sky/camera startup.
- Solar-system view uses real shared-engine heliocentric coordinates, an AU distance scale, enlarged marker sizes, and clearly labels dashed circles as distance guides rather than orbital paths.
- Settings/search/saved controls use native inputs and buttons. Focused result lists are protected against routine one-second replacement. UTC field edits are protected from telemetry overwriting.
- Crosslinks now point to the confirmed `astrology-sim-ant` site and actual nativity/calendar pages. No chart-lab placeholder route remains in the inspected index.

## Release evidence boundary

The findings above require small integration fixes. This source review does not establish visual quality on mobile, screen-reader behavior, physical camera alignment, browser permission implementation, CORS availability, Actions success or the live deployed commit. Use the authored CI browser journeys and deployment checks for those gates, and retain the documented phone checklist as pending physical verification.

Coordinator follow-through: all five listed findings repaired before publication. Details restore an originating visible panel/control, orbit range lives in a WeakMap and focused toggle is restored, aircraft copy matches visible-page polling, FOV says lens diagonal before crop, and hitTest receives raw client coordinates. Node gates rerun after changes. Browser confirmation remains CI-gated.
