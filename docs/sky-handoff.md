# SkyLens and Studio observation handoff

Implemented October 5, 2026. This connects two static applications; it is a captured observing context, not a live stream or image recognition.

Open an object's details and choose **Cast this observation**. The button uses that open object's identity and the whole-second UTC instant shown in its details. It does not reuse a different object previously selected for guidance. Tools → **Cast this sky moment** captures the selected observer/time without an object. The destination is the existing [Studio](https://occult-kranti.github.io/astrology-sim-ant/pages/studio.html).

Studio returns a frozen instant to SkyLens. Imported records preserve naming preference and demo-location provenance. Camera, motion and both optional external feeds start off for this imported visit, even if a feed was previously selected. Recognized objects are restored after the local catalogues and astronomy adapter settle. Missing or unavailable objects leave the instant and observer usable with an explanation; no satellite or aircraft request is started to find them. Return to now or changing coordinates clears the original fragment and imported-context label.

## Transport and privacy

The URL fragment begins `#skyV=1&skyAt=…`. Fragments are excluded from HTTP request targets and HTTP referrers. They remain in the address bar and browser history, can be read by destination-page scripts, and travel when a user copies the full link. The explicit action explains this before navigation. There is no account, new API, shared storage, `postMessage`, background sync or permission transfer. Saved-place names, camera frames, sensor headings/calibration, notes, birth details and credentials are never included.

Only fixed URLs are allowed: `/astrology-sim-ant/pages/studio.html` and `/skylens/` on `https://occult-kranti.github.io`. An input cannot provide a return URL or redirect destination. Parser results must be rendered with text nodes, not HTML.

| Parameter | Requirement |
|---|---|
| `skyV` | Exactly `1` |
| `skyAt` | Explicit UTC `Z`, whole seconds, valid Gregorian date from 1900 through 2100. Normalized API output includes `.000Z`. |
| `lat`, `lon` | Finite degrees north/east, −90…90 and −180…180; zero is valid. |
| `skyMode` | `current` or `simulated`: origin provenance only. Both open frozen. |
| `skyLoc` | `demo` or `selected`; does not assert GPS accuracy. |
| `skyNames` | `en`, `hi` or `bilingual`; controls existing reviewed names, not a full interface translation. |
| `skyObject`, `skyName`, `skyKind` | Optional as a complete group. Identity≤96 characters, canonical name≤100. Bounded categories/prefixes; no control or bidi-override characters. |

Fragments are limited to 1,600 characters. Duplicate keys, unknown keys, malformed encoding, unsupported versions, partial records and invalid values fail visibly without applying partial state. Unrelated anchors return `null`. The builder also accepts whole-second ISO offsets and converts them to UTC; the wire parser requires UTC. Capture rounds down to the containing second explicitly; it does not claim millisecond precision.

## Calculation boundaries

Coordinates do not identify a civil time zone. The bridge carries no assumed IANA zone or civil UTC offset. UTC describes the instant, not the observer's local weekday. Studio must preserve unknown observer-zone provenance and disclose its local mean-solar fallback for traditional day boundaries until the user supplies a zone.

SkyLens's 1900–2100 range is narrower than Workbench's historical study range. The builder rejects unsupported returns rather than clamping the date. SkyLens accepts geographic poles for astronomy; this does not promise that every house calculation is available there.

Object identity is contextual. Stars, deep-sky objects, satellites, aircraft and constellations are not substituted for the seven classical planets. Constellation guidance uses existing drawing anchors. Serpens Caput (`const:Ser:75`) and Cauda (`const:Ser:76`) remain distinct parts of one IAU constellation. A catalogue revision may move index-based IDs; a unique exact canonical name/category match can recover the intended object. Ambiguous names and unknown objects never select a guessed substitute. Hindi names are resolved locally from the restored canonical identity.

## Verification and ownership

The identical pure adapter lives in `js/handoff.js` and Workbench `assets/js/core/sky-handoff.js`. Shared fixtures are in `tests/fixtures/sky-handoff-v1.json`. `node tests/handoff.mjs` covers both destinations, date-line and DST-fold instants, extremes, duplicate/malformed input, private-data exclusion, actual-details selection and Serpens identity. Existing SkyLens Node tests remain regression gates. The receiving Studio and cross-application browser journey are verified in Workbench's session release harness.

Deploy the receiving Studio adapter before publishing outgoing SkyLens links. A local parser test alone does not establish deployment, a browser round trip, or physical alignment. Camera alignment and real permission sheets retain their separate device checklist.
