# SkyLens Globe — roadmap and decision ledger

Baseline: published main `9b9fa56722c605b96cabdb4cb0a2e6855a9e4188`, tree `fe80f76092cbbedb6d23bd6736a7bfd3d6de41db`, local equivalent `d8e74f8`. Clean branch `feat/globe-flight-radar-2026-10`. Research date: October 5, 2026. Existing Sky/AR, saved observer and Workbench handoff remain intact.

User task: explore a full Earth globe, zoom from the world into an area, switch aircraft/satellites on/off, find/select/follow a track and return to the live sky. This milestone implements a new linked static route, not a replacement application. The product uses source telemetry and SGP4, never invented aircraft or optical recognition.

## Architecture and honest coverage

- Canvas orthographic globe with trusted d3-geo spherical clipping and pinned public-domain Natural Earth land; original geographic projection/picking and gesture/controller code. Local assets, no external map tiles or mandatory map account. Projection shows geographic/subsatellite positions, not altitude-to-scale 3D objects. Coastlines are low resolution; this is not street mapping.
- Aircraft: explicit regional queries anywhere on the globe using existing public providers, plus an explicitly connected user-owned/permitted HTTPS/CORS JSON feed capable of whole-network/global records. Official research found no reviewed unrestricted anonymous all-aircraft feed. Avio all-aircraft is contributor-only; adsb.fi snapshots require active feeder IPs; adsb.lol public routes do not include /all. Do not tile point queries to reconstruct restricted data or scrape map backends.
- Rotating/zooming never silently queries a provider or changes the saved Sky observer. Load this area discloses the map centre, radius, provider and IP sharing. Custom feed URL has its own explicit connection and schema, no embedded secrets, redirects, proxy, cookies or appended coordinates; source coverage remains unverified. Global navigation does not imply complete global receiver coverage.
- Satellites reuse the current stations+visual cache and SGP4 worldwide geographic subpoints. Preserve two-hour request reservation, dated fallback and seven-day epoch cutoff. Satellite catalogue scope is explicit.
- Native accessible controls, searchable loaded-object list, selected details, follow/stop-follow, source age/error/quota, finite local trails and manual stop. Wheel/pinch/buttons/keyboard zoom; drag/keyboard rotate. Reduced motion, background suspension, bounded buffers and no automatic permission prompt.

## Acceptance ledger

| ID / priority (dependency) | Problem and expected result | Owner / files | Acceptance and validation | Status |
|---|---|---|---|---|
| G0 P0 (none) | Recover exact live baseline and preserve changes | Lead / repository | Clean branch, remote tree comparison; existing release evidence | Complete |
| G1 P0 (G0) | Whole-world interface must not imply restricted or unavailable data | Research / globe-data-research.md | Official endpoint/terms comparison, explicit coverage/source decisions; no invented routes/data | Complete — official source matrix, independently rechecked provider access |
| G2 P1 (G1) | Accurate globe, clipping, visible-side markers and zoom | Math / globe-math.js, test; renderer / globe-render.js; pinned land/d3 assets | Cardinal/polar/dateline/project-inverse/hit tests; real-browser occlusion/zoom | Implemented — methods and local regression evidence recorded |
| G3 P1 (G1) | Regional worldwide and owned global JSON input | Feed / traffic-feed.js, test | Timestamp schemas, absolute positions, global no-clipping, age/size limits, consent/start/off/background/cooldown | Implemented — methods and local regression evidence recorded |
| G4 P1 (G2–G3) | Responsive useful flight-radar workflow | UI / globe.html, globe.css, globe-ui.js | 320/390/landscape/desktop,44px controls, keyboard/touch, search/follow/details and meaningful empty/error states | Implemented — methods and local regression evidence recorded |
| G5 P1 (G2–G4) | Connect feeds, projection, Sky and satellites | Lead / globe.js, Sky links | Independent map centre/observer; bounded trails, switching off cancels work; no new automatic sharing | Implemented — methods and local regression evidence recorded |
| G6 P0 (G5) | Correctness, interaction and cost evidence | QA / browser-globe.mjs, benchmark; lead / gates | Existing tests + globe suites, mock global and regional sources, real static route, measured source/CPU costs | Passed — Node, three browser suites and measured Canvas/UI costs |
| G7 P0 (G6) | Publish reviewed source on existing Pages | Lead / workflow/docs/PR | Green PR/main gates; exact-SHA HTTPS deployment and public globe route inspection | Release gate — publish tested tree, then verify exact SHA and live route |

| G8 P1 (G4–G6) | Premium workflow and art-direction continuation | Research / premium-tracking-design-research.md; UI / tracking-design-brief.md, globe UI; lead / Sky navigation | Seven-product official comparison; connected views, category filters/reset, compact coverage, action-first inspector; no additional framework; mobile roundtrip/44px controls | Implemented and browser-verified; physical use remains pending |

Panel pass1 selects this architecture; pass2 independently challenges working correctness/privacy/data claims; pass3 verifies release and deployment. Impeccable guides one batched visual inspection and at most one confirmation. These are AI engineering reviews, not observed human usability research.

## Dependencies and remaining human setup

Regional browsing needs no account but provider quotas remain; global live data requires a feed the user is entitled to access. Document feeder hardware/accounts/licensing and HTTPS/CORS actions in README. Never embed a private key in Pages. User-owned server provisioning and commercial data purchase are not implied. API evidence, actual release status and physical-phone limits will be updated during execution.

## Review outcomes and delivery boundaries

Architecture review chose shared sources/calculations with an independent geographic view. Working-feature review repaired same-source switch behavior, asynchronous parsing cancellation, ground/unknown-altitude map eligibility and selected-target visibility on short phones. Release review confirmed preserved Sky observer/consent, bounded data/rendering, current-year source evidence and explicit provider attribution. Full Node and existing Sky/nearby browser suites pass; the globe gate passes six journeys and22screenshots. Detailed evidence and measured limitations are in [verification](globe-verification.md).

The user's subsequent premium-redesign request added G8 after the first visual confirmation. It has its own bounded art/developer research and visual pass; it did not reopen unrelated calculations or migrate the existing apps. Quieter labels, selected-object emphasis and bounded adaptive grids refine the scientific canvas. The existing Workbench, private MCP host, Hindi controls and live camera remain connected and retain their owning modules.

No feasible P0/P1 listed above is replaced by a placeholder. Full global live aircraft coverage remains blocked by external data entitlement and actual receiver coverage, not by the map; source-specific setup is in README. P2 street maps/terrain, global history/route/airport/weather data, shared map/list filtering and local map bookmarks are deferred for the source, validation and product reasons in the premium research matrix. Physical iOS/Android alignment, touch and screen-reader checks remain human validation, not completed software tests.
