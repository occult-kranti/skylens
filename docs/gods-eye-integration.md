# SkyLens Earth explorer — October 14, 2026

Based on SkyLens main `409518f91a1fb2de2fe2b3021a6f3fdeeb1d35c1`. The saved environment initially contained the older pre-globe checkout; this work started a feature branch from current remote main without changing existing Sky/AR tools.

## Implemented

The globe has a new observatory header, desktop left inspector, right-side navigation and compact scrollable phone sheet. Existing loaded-object search, layer controls, geographic follow, report details, regional/receiver data connections and Sky handoff remain available.

New independently authored exploration features:

- Offline navigation to 12 listed cities or explicit latitude/longitude. This is a small built-in list, not a worldwide geocoder. Navigation does not send coordinates to a provider or move the saved sky observer.
- Shareable camera centre, zoom and normal/night appearance. Shared URLs discard existing query strings, credentials and unrelated fragments; opening one never grants feed consent or transfers a receiver endpoint.
- Optional search/category filtering of map markers. The selected current target remains visible and explicitly identified outside the filter, preserving follow continuity. Stale eligibility still applies.
- Re-selecting the same object reopens details after Back. Successful receiver recovery clears previous error and retry metadata.
- Night appearance is a display palette, not night-vision imagery or a sensor measurement.
- Successful empty traffic responses say **No reports received**. Old-only reports say **Stale reports**; unavailable and rate-limited sources retain distinct labels. Satellites are **Calculated**, with **No current positions** when elements are suppressed.

The [reference review](gods-eye-view-reference.md) pins the upstream license and architecture. No upstream code, assets or data were copied. Photorealistic imagery, voice control, commercial tiles, private provider proxies and new data sources are outside this iteration. There is no simulated production traffic layer.

## Runtime and hosting

SkyLens remains a static browser application: no application service needs to run on the user's laptop. Public aircraft and orbital providers are contacted only through existing explicit controls. Provider availability, CORS, rate limits and actual receiver footprint remain external constraints; navigating worldwide does not establish global aircraft coverage. No paid service or persistent access grant was introduced.

`node tools/package-static.mjs /absolute/output` stages the preserved Sky and Globe routes, assets, attribution and source commit marker. ChatGPT Sites publication uses a separate source checkout, private audience and static `dist` manifest. The saved environment lacked the Sites helper scripts; native Git source synchronization and Sites save/deploy APIs use the documented exact-commit/static-archive contract. Short-lived source credentials are passed through hidden stdin and process memory, never source or output.

## Verification

Completed Node suite (`npm test`), including new strict navigation/share/filter invariants; syntax checks and `git diff --check`. Existing Sky browser gate: 12 journeys. Nearby browser gate: 6 journeys. Globe browser gate: 6 journeys and 22 screenshots, including receiver recovery. Explorer browser gate: 4 viewport journeys and 12 screenshots, including repeated selection. All final results pass. Tests used system Chromium at 320×568, 390×844, 844×390 and 1440×1000 for the globe/explorer.

Evidence:

- [Desktop inspector](evidence/explorer/desktop.png) and [phone viewport](evidence/explorer/mobile.png).
- [Sky browser results](evidence/explorer/sky-browser-results.json), [nearby browser results](evidence/explorer/nearby-browser-results.json), [globe browser results](evidence/explorer/globe-browser-results.json), [new explorer journeys](evidence/explorer/explorer-browser-results.json).

The new explorer gate is included in CI. A globe follow fixture uses ordered clock progression rather than jumping directly across report expiry; separate stale/expiry checks remain intact. See the final PR and task report for publication status. Browser fixtures are synthetic and deliberately intercepted; they establish UI/lifecycle behavior, not actual populated provider coverage. No physical phone, real camera alignment or screen-reader testing is claimed. The previous public GitHub Pages site is not automatically updated by this draft feature branch.
