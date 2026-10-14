# God's Eye View reference review

Reviewed 2026-10-14 against [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view), commit `22241550aeeb70996ac5a528e2e9220326b8a083`. This is the user-confirmed reference, not a similarly named project. This review records the inspected repository snapshot; it does not establish provider availability or future terms.

## License and reuse boundary

The reference [LICENSE](https://github.com/bilawalsidhu/gods-eye-view/blob/22241550aeeb70996ac5a528e2e9220326b8a083/LICENSE) identifies its **source code** as MIT, copyright 2026 Bilawal Sidhu, and requires inclusion of the copyright and permission notice with copies or substantial portions. Its explicit third-party exclusions matter:

- TeleGeography submarine cable data: CC BY-NC-SA 3.0.
- OpenStreetMap / Open Infrastructure Map extracts: ODbL 1.0.
- Bhote Koshi imagery and derived coordinates: Vantor / GeoPera, CC BY-NC 4.0, including coordinates embedded in a JavaScript file.
- 3D models: individual licenses documented in `public/models/README.md`.
- Runtime providers, promotional media and dependencies: their own terms; the MIT grant does not grant their data, credentials, quotas or redistribution rights.

Implementation decision: use the reference's interaction ideas and architectural lessons, while authoring SkyLens code independently. Do not copy its source, imagery, models, bundled datasets, branding or promotional media for this iteration. No upstream license file needs to be added for code that has not been incorporated. If a future change copies source, include the complete applicable MIT notice and separately review every copied asset/data file and dependency.

## Inspected architecture

The reference is a JavaScript ES-module application with a Cesium globe, `satellite.js` orbit propagation and a Vite build. `src/app/application.js` separates scene, controls, data and tools, with an AbortController and reverse-order cleanup. `src/app/catalog.js` registers layer instances and their serialization metadata. `src/layers/satellites/index.js` composes controls, records, rendering, tracking, interaction, lifecycle and ingestion around an injected source. Search has coordinate and preset providers as well as external geocoders (`src/search/index.js`).

It is **not a standalone static website with all capabilities intact**. `server/standalone/vite.config.js` attaches provider middleware from `server/providers/`; the browser calls paths such as `/api/celestrak/<group>` (`src/layers/satellites/source.js`). Aircraft, space, places, OpenAI and other integrations have server-side adapters. The CelesTrak source explicitly recognizes the proxy's stale-cache header. Publishing only frontend assets does not publish these APIs or safely broker credentials. The upstream README's local-first setup and sharing guidance are consequently not a deployable hosting recipe for SkyLens.

## Fit with SkyLens

SkyLens is a zero-build static ES-module application. Its existing `js/globe.js`, `js/globe-render.js` and `js/globe-ui.js` keep the geographic view separate from the astronomy/AR observer. `js/traffic-feed.js` validates bounded reports, timestamps, declared coverage and receiver URLs. `js/planes.js` owns regional provider limits and request reservations; `js/satellites.js` propagates orbital elements locally and distinguishes retrieval time from element epoch. Preserve these modules' contracts and the existing astronomy, camera and sky navigation paths.

Feasible reference-inspired capabilities without new accounts or paid services:

- A globe-led layout with a compact layer tray, clear source status and usable mobile details.
- Search across loaded aircraft identifiers and satellite names, coordinate navigation and curated location presets. Describe the searched catalogue; do not imply a global aircraft search service.
- Independent aircraft/satellite filters, selection and follow camera controls. Panning, changing selection, hiding layers or losing valid data must end follow cleanly.
- Inspectable report times, aircraft coverage and orbit epoch/age, plus explicit empty, loading, unavailable and stale states.
- Intentional query-area updates: camera navigation must not silently initiate new provider requests or suggest worldwide coverage.

Deferred integrations include photorealistic Google tiles, remote voice/AI, additional credentialed providers and upstream server-only layers. They need a supported hosted backend, applicable terms and any user-approved service costs; a browser must never receive secret feed credentials.

## Hosting and verification requirements

The static frontend and browser-safe public feeds can run from a supported HTTPS website host without anything running on the user's laptop. ChatGPT hosting must be verified through the available publishing tools separately; this reference review does not claim that publication is supported or completed. Any publication report must identify the actual host and verify the published route/assets, rather than substitute GitHub Pages or another host for the requested ChatGPT host silently.

Test interruption and repeated actions: rapid layer toggles, source switching during requests, repeated follow/unfollow, selection removal, empty HTTP-200 traffic, expired reports, stale orbital elements and mobile panel dismissal. An HTTP-200 response alone does not demonstrate populated coverage. Predicted satellite positions are calculated from orbital elements, not live telemetry. Simulated fixtures belong in tests or an explicitly labeled demo state. Browser viewport tests must not be reported as physical phone tests.
