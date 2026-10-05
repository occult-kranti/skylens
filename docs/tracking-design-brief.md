# Tracking workspace design brief

Date: October 5, 2026. Surface mode: **Operate**. Owner: UX/art direction agent; lead engineer moderates and integrates. These are AI design perspectives, not observed participant research or professional endorsements.

## Evidence and direction

The existing product direction is the portable observatory in `PRODUCT.md` and `DESIGN.md`. The first globe browser batch contains 22 real Chromium screenshots at320×568,390×844,844×390 and1440×1000; mocked telemetry tests do not establish provider coverage. The first batch exposed portrait sheets obscuring selected markers and map controls. Commit `467897a` repaired those bounds and same-source switch behavior. The subsequent browser confirmation passed all six journey groups, including selected-centre visibility.

This is a new user-requested functional and visual pass after that confirmation. It preserves the geographic rendering, scientific calculations, source consent, Sky camera controls and static ES-module architecture. Impeccable supplies the bounded review approach; its context launcher and referenced craft playbooks were unavailable earlier in this session. The existing project context and Design Partner foundations provide the documented fallback. No launcher retry, external font, framework, paid data purchase or decorative scientific imagery is required.

The direction is a precise field instrument: let Earth carry the image, group controls by the decision they make, give the selected object a strong typographic identity, and make data scope legible before dense technical facts. Use the existing near-black/navy surfaces, blue action, amber selection and red night roles. A compact Sky/Globe view switch connects two views of the same observing task. Avoid unrelated cards, glossy maps, fabricated route information or claims of complete tracking.

Current official-product workflow research is recorded separately in [premium-tracking-design-research.md](premium-tracking-design-research.md). The research agent owns source dates and tier boundaries. Product names and paid workflows inform task structure only; their assets, branding and proprietary code are not copied.

Verified workflow references received from that agent on October 5: [Flightradar24 features](https://www.flightradar24.com/blog/product-features/) and [plans](https://www.flightradar24.com/premium/) support the linked map/list/inspector pattern; paid history and separate API access cannot be recreated from current position reports. [FlightAware Enterprise features](https://support.flightaware.com/hc/en-us/articles/41484535495831-What-Are-My-Enterprise-Subscription-Features) illustrate coordinated aircraft views, not an entitlement to its data. [SkySafari](https://skysafariastronomy.com/) and [Stellarium AR](https://stellarium-labs.com/blog/arfeature/) inform the transition from a selected target to observation; sensor overlays remain distinct from optical recognition.

## Accepted design delta

| Change | User task and behavior | Ownership | Acceptance |
|---|---|---|---|
| Connected views | Switch between the geographic Globe and local Sky. The active view is explicit. Navigation does not start sensors or data feeds. | UI: Globe header; lead: existing Sky entry | Native links, current-page semantics,44px targets, browser round trip without unexpected requests or permissions. |
| Coverage hierarchy | See whether aircraft data is off, regional, receiver-supplied, loading, paused or unavailable. Short scope and loaded count fit phones; receipt age is named as receipt age. Full provider, snapshot time, coverage wording, quota and errors remain in Data & coverage. | UI existing state | Long custom descriptions never expand the header or obscure controls. Response receipt is never called position freshness. Empty coverage never implies empty airspace. |
| Searchable loaded list | Search received objects, then narrow the list to All, Aircraft or Satellites. Each category shows its loaded count. Reset restores all categories and clears the query. | UI local transient state | Filters change only the list, never map layers, provider consent or polling. Existing object identity, selection and search survive ordinary state refresh. Empty filtered results offer reset. |
| Action-first inspector | Select an object, immediately Follow or View in Sky, then inspect report/epoch/source and coordinate facts. Expired objects retain an explanation and cannot follow an old marker. | UI existing handlers | Actions appear above facts, retain keyboard focus on updates, and remain reachable in bounded scroll panels. True ground state/unknown altitude and calculated satellite positions retain their explicit labels. |

Map bookmarks and added storage are excluded from this pass: the accepted four improvements address the current task without introducing a second saved-state system. Broader global data, route/airport databases, weather layers and historical playback require separate verified sources and are not invented here.

## Screens and states

- **Globe, sheet closed:** Earth remains the main artifact. Sky/Globe navigation, independent Aircraft/Satellites switches, compact data summary, zoom/reset/location and the sheet handle are visible. Density feedback means markers have been suppressed; search still includes every loaded record. Manual navigation stops following and never changes an authorized query centre.
- **Objects:** labeled search, list-only category group, loaded/matching count, reset when needed, then stable rows. Initial empty state explains enabling a layer or loading an area. No-match state distinguishes a query/category filter from absent source coverage. Search never contacts providers.
- **Selected object:** name and category establish identity, Follow and View in Sky precede detailed facts. New selection replaces the record; live updates change facts without replacing focused controls. Missing/expired records disable unavailable actions and explain why. Camera and motion remain separate in Sky.
- **Data & coverage:** the full source description and receipt/provider timestamps explain the compact badge. Regional and permitted-receiver forms retain explicit connection consent, input validation, request limits and recovery. Loading/processing, successful empty results, denied/unavailable source, cooldown and background pause remain distinct from layer off. Resuming Aircraft uses only the already authorized source for this visit.
- **Sky entry:** lead adds a direct Globe link alongside existing nearby controls. Existing Sky manual/Auto AR/camera behavior, method controls and saved state remain intact.

## Component and responsive rules

Use native links and buttons. The category group uses pressed buttons rather than incorrect tab semantics because it filters one list. Announce user-triggered status changes politely; one-second telemetry is not a live-region stream. Restore search focus after reset. Use text as well as color for source state. Set mobile inputs to16px and preserve44px primary targets. User and provider text uses textContent and wraps safely.

Keep the confirmed portrait sheet/centre separation and140px minimum scrollport. Short phones use a two-column navigation cluster; landscape/desktop retain the side inspector. Long names, unknown fields, source descriptions, keyboard search and night mode are acceptance cases. Avoid adding a third fixed header row that consumes the usable map area. Inspector facts may scroll; the object actions must precede that density.

Visual verification for this new pass is one batched set across the existing four viewports plus the existing reflow gate, followed by one repair confirmation if material defects appear. Report actual tests and screen evidence; do not infer physical-phone, assistive-technology or human-task success from Chromium mocks.

## Implementation ledger

Approved by lead: changes1–4. UI owns `globe.html`, `css/globe.css`, `js/globe-ui.js` and this brief. Lead owns `js/globe.js`, Sky entry/navigation and release integration. QA owns browser tests; the product research agent owns the official comparison. No UI implementation dependency or new controller contract is required.

Status: changes1–4 implemented in `6f50740`; integrated browser verification and the single design batch are complete. Object indexes, category counts and matched rows reuse the same object-array identity during map gestures, so the new filters do not repeatedly scan the full catalogue on every pointer move. Row ages still refresh at one-second resolution, and focused action controls are not recreated. Static syntax, unique IDs/ARIA references and whitespace checks pass.

### New-pass verification, October 5, 2026

The actual Chromium report `test-results/globe-browser-results.json`, completed at23:43:37UTC with source through `9a17161` and renderer `12cf26b`, passes six journey groups. It contains twelve measured layout states across320×568,390×844,844×390 and1440×1000: all72 primary-control checks are visible, hit-testable and at least44px in each dimension, and selected-centre checks pass. The new checks cover positive aircraft/satellite filters, reset and focus, unchanged requests/layers/map while filtering, a long unbroken coverage description, the module worker, and actual Sky/Globe navigation without implicit access. The lead separately reports the existing twelve Sky and six nearby journey groups passing.

The UI reviewer viewed all22 report-listed screenshots in one batch: world, regional source, receiver source, selected aircraft and selected satellite at each viewport, plus mobile empty/error states. Selected markers remain visible above portrait sheets; Follow/View in Sky appear before detailed facts; compact coverage stays within the header; the satellite land orientation and marker now agree with the rendered frame. No material visual repair was required. The earlier satellite screenshot discrepancy was resolved by awaiting a frame before capture, not by changing astronomical coordinates.

After that batch, the lead's source/license check required explicit regional-provider attribution. The Data methods section now links AvioADSB, CC BY4.0, adsb.fi and the local third-party ledger. This is a static attribution correction, with no automatic network access or new visual-design round; targeted release checks cover the links.

Limits: the screenshots use the normal palette, so no new visual night-mode approval is claimed. Browser mocks establish neither live-provider availability/global coverage nor physical-phone gestures, camera alignment or assistive-technology conformance. The local screenshots and report are test artifacts, not a deployment claim. Release/deployment evidence belongs to the lead's release record.
