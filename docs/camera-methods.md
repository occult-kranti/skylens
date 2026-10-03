# Camera projection and device verification

Updated 2026-10-03. This is sensor-based sky projection, not visual recognition. Camera frames remain in the local video element; the app does not upload them. Coordinates come from astronomical calculations, observer inputs and device sensors. Browser tests cannot establish physical alignment accuracy.

## Coordinate conventions and corrections

The pure math core uses vectors `[east, up, south]`. Azimuth is degrees clockwise from north; altitude is degrees above the geometric horizon. W3C device coordinates have x to screen right, y to the device top and z out of the screen. Device orientation uses intrinsic Z-X-Y rotations: alpha around z, beta around the new x, gamma around the new y. The rear lens looks along device -z. The existing quaternion implementation is retained and tested against a separately expanded W3C rotation matrix, including oblique poses. Screen orientation rotates right/up, preserving camera boresight.

`correctedAttitude(sample, options)` is the single source for projection, compass text and directional guidance. For a valid nonstandard WebKit compass reading, alpha is anchored as `360 - webkitCompassHeading`; otherwise the reported alpha is used. This WebKit adaptation is an estimate pending physical testing of tilt and screen rotations. A negative WebKit compass accuracy marks that heading invalid. All basis vectors receive the configured heading offset around local vertical and pitch offset around camera right. Positive heading correction increases azimuth; positive pitch correction raises altitude. Example: north-horizon input, +90° heading, +20° pitch points east at altitude 20°.

Absolute sensor data does not establish true north accuracy. W3C relates absolute orientation to platform magnetic-north frames, and Apple explicitly documents `webkitCompassHeading` as magnetic. Magnetic declination, nearby metal, drift and vendor processing can change alignment. No geomagnetic model is bundled. The heading correction can compensate for local declination and mounting error using a known celestial target or surveyed true bearing; it is a manual calibration, not a measured uncertainty estimate. Relative orientation has an arbitrary initial heading and must be labelled uncalibrated.

`headingSource` is `relative`, `absolute-sensor` or `magnetic-compass`. These labels describe provenance, not accuracy. `compassAcc` is reported only if the browser provides it; absence means unknown. Browser events need only arrive after significant motion. No recent event should prompt the user to move the phone to check, not assert that hardware has failed.

For a front-camera fallback, track settings identify `facingMode: user`; the forward and right basis vectors are reversed. Video remains unmirrored. Mirroring video without also reflecting projected x would be incorrect; no mirror transform is applied here. If a browser omits `facingMode`, camera side is unknown and alignment remains unverified.

## Lens and viewport model

Camera FOV is the **estimated lens diagonal angle**, adjustable by the user. Neither device orientation nor ordinary getUserMedia settings provide a trustworthy calibrated optical focal length. Use current `videoWidth` and `videoHeight` after playback and after orientation changes.

For source dimensions sw×sh and diagonal FOV d:

- Source focal length in pixels: `f = hypot(sw,sh) / (2 tan(d/2))`.
- Centred CSS `object-fit: cover` scale: `s = max(viewWidth/sw, viewHeight/sh)`.
- Effective tangent half-angles: horizontal `viewWidth/(2fs)`, vertical `viewHeight/(2fs)`.

This accounts for aspect-ratio cropping, square pixels and screen resizing. It does not model wide-angle distortion, optical lens switching, stabilization crop, off-centre principal point or digital zoom. FOV and offsets should be recalibrated after a camera/lens change. Missing source dimensions use viewport aspect as an explicitly estimated fallback. Manual exploration uses the same diagonal-angle model with viewport dimensions as its uncropped source.

Objects behind the camera are culled. Camera scenes can additionally cull objects below the geometric horizon; objects below the horizon remain discoverable through search and show directional guidance with a below-horizon description. Atmospheric refraction and local obstructions are not solved by projection.

## Motion, labels and lifecycle

` smoothAttitude(previous, target, deltaMs)` applies a 70ms exponential vector filter and re-orthogonalizes the camera frame. It avoids averaging angles across 359°/1°. Restarts after >500ms, opposite-frame changes and degenerate frames snap to the new pose. This is a filtering setting, not a measured lag guarantee on mobile devices. Screen-roll direction is used for guidance arrows.

Labels are measured with the actual canvas font, prioritized by selected target, solar-system objects and star brightness, and rejected when their padded rectangles overlap or cross viewport bounds. A maximum of 45 labels controls density. Catalogue identity gives deterministic tie breaking. Suppressed labels do not remove tap targets. Reduced-motion scenes use a static highlight.

The hardware adapter returns a camera session with an idempotent stop function. Tracks are stopped and `srcObject` cleared after explicit stop, playback rejection, revocation/hardware-ended notification or a superseded request. Stopping while permission is pending invalidates the request and releases a late granted stream. Orientation listeners have an explicit stop function. The main controller owns page visibility, pagehide, resume UI, render loops and compute timers. Motion permission must be requested from the camera-enable click handler before any await/timer; the adapter requests absolute permission when the browser supports this API. Microphone capture is always disabled.

## Automated evidence

Run `node tests/camera.mjs`. The suite includes:

- Seven independently expanded W3C Z-X-Y frame fixtures, including oblique and landscape poses; vector tolerance 1e-10.
- Screen rotation preserving boresight, rear/front basis, calibration and WebKit heading affecting the actual overlay.
- North-wrap smoothing, orthogonality and restart/discontinuity behavior.
- Independent cover-crop pixel geometry and rotation of source/viewport dimensions.
- Rectangle label collisions, selection priority, bounds and budget.
- First absolute-event correctness, null sensor handling and listener release.
- Direct motion request invocation, camera constraints and no audio capture.
- Denied permission, rejected playback, track revocation, front-camera reporting, pending-stop and overlapping-start cleanup.

These fixtures validate conventions, deterministic math and mocked ownership. A synthetic compass input does not validate Apple's physical compass calibration. A synthetic video stream does not establish real camera crop, sensor timing or browser permission behavior.

## Physical-device acceptance (pending)

Use the deployed HTTPS URL on a recent iPhone/Safari and Android/Chrome. Record phone model, OS, browser version, UTC, latitude/longitude and accuracy, camera side, video dimensions, FOV and correction values. Keep device coordinates private when sharing the report.

1. Fresh profile: grant camera and motion from Enable camera; choose Device location in Settings. Confirm live rear preview and explicit sensor/location feedback. Deny each separately and confirm a usable manual view.
2. Check north/east/south/west near the horizon, then a known star or planet ~45° up. Calibrate and record angular residual in both directions; repeat at multiple screen positions to reveal FOV/lens distortion.
3. Repeat portrait and both landscape orientations, with screen rotation lock on/off. Heading and labels must track the same sky direction. Verify front fallback is described and unmirrored.
4. Hold still, pan slowly and quickly, cross north and look near zenith. Record visible jitter and lag; labels must remain readable and selection possible.
5. Test local magnetic interference, low compass confidence and relative-only sensor fallback. The app must not claim precise true-north alignment.
6. Background, change tab, lock screen and return. Confirm camera indicator turns off while stopped and Resume camera restores only after the user acts. Repeat start/stop at least ten times.
7. Revoke permission, disconnect/occupy camera, deny location and manually enter valid coordinates. Confirm useful errors and recovery without reloading.
8. Resize, adjust FOV and heading, search/select visible and below-horizon targets, and inspect dense fields. Use keyboard and screen reader object lists as the alternative to aiming.

Physical accuracy has not been measured in the cloud environment. No arcminute/degree alignment claim is made until device results are recorded.

## Sources read 2026-10-03

- W3C Device Orientation and Motion, candidate recommendation dated 2025-02-12: https://www.w3.org/TR/orientation-event/
- Apple DeviceOrientationEvent and magnetic heading: https://developer.apple.com/documentation/webkitjs/deviceorientationevent
- MDN getUserMedia constraints, permissions and errors: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN actual track configuration: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings
- MDN CSS cover behavior: https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit
- MDN track cleanup: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop
- MDN permission/hardware ending: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event
