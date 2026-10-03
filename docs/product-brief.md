# SkyLens and the Astrologer's Workbench: product brief and implementation gates

Prepared 2026-10-03. Scope: source-grounded UX and integration advice for the existing applications. This is a plan, not evidence that changes have shipped.

## Evidence and scope

The reviewed local material contains two distinct applications: `/workspace/skylens` and `/workspace/astrology-sim-ant`. Repository ownership and remote spelling must be established by the lead engineer from GitHub; this document does not infer that the user's `astro-sim-ant` URL is the canonical remote.

SkyLens sources inspected: `index.html`, `css/style.css`, `js/main.js`, `js/ui.js`, `js/sensors.js`, `js/planes.js`, `README.md`, and `SkyLens-Roadmap.md`. Workbench sources inspected: `index.html`, `README.md`, `HANDOFF.md`, `ROADMAP.md`, `MASTER-PLAN-V3.md`, `docs/FRAMING.md`, `assets/js/app/shared.js`, `moment-picker.js`, `location.js`, and `assets/js/core/calendar.js`.

No `PRODUCT.md`, `DESIGN.md`, screenshot fixtures, or AGENTS files were present in the material inspected. The Impeccable main skill was read. Its local context launcher was unavailable, so existing code and documentation supplied context. Referenced playbook material was unavailable. No browser or physical-device review has been performed by this advisor. Documents claiming previous successful browser checks are inherited claims, not verification of this release. Workbench materialization was still incomplete at review time; linked pages missing locally cannot yet be classified as missing on the remote site.

Surface modes: **Operate** for camera controls, chart inputs, and calendars; **Read** for the Workbench's historical source material. Preserve the established design identities. No wholesale shell or framework replacement is justified by this review.

## Product goal

A person can open SkyLens, enable a live camera view, point the device, identify a celestial object, and understand whether its alignment and data are trustworthy. The same object is discoverable through keyboard-accessible search and manual exploration. Related chart and calendar tasks belong in the existing Workbench, with visible links between the two applications.

The Workbench remains a historical and traditional astrology study tool with real, disclosed calculations. SkyLens remains an observational astronomy instrument. Cross-app navigation should connect useful tasks without presenting astrological interpretation as a measured property of a camera-detected object.

Success is task completion: start/stop camera, understand permission failures, identify/search/select an object, view an observing window, cast a supported chart from explicit time/location, and convert dates using a named convention. Avoid adding cards or menu items before their calculation and unavailable states exist.

## Preserve and improve

SkyLens already has an appropriate full-viewport canvas/video layout, restrained instrument palette, monospace telemetry, expandable inspector, layer filters, night palette, manual drag/arrow navigation, object guidance, and Tonight calculations. Preserve those modules and visual language. Its current first-use labels, control accessibility, permission lifecycle, privacy copy, and time/location context need correction before wider feature expansion.

The Workbench already has grouped navigation in `shared.js` (Start, Cast, Traditions, Oracles, Reference), a master chart workflow, Vedic entry points, shared moment/location inputs, and historical calendar conversion. Preserve these established routes and scholarly material. Add a compact task-oriented doorway and methods overview instead of cloning every calculator into SkyLens.

### Findings requiring correction

1. SkyLens `boot()` calls geolocation after either onboarding choice and starts aircraft polling unconditionally. `planes.js` sends latitude/longitude rounded to three decimals to AvioADSB. The onboarding assertion that location never leaves the device is therefore false. Keep camera frames local; make external aircraft requests explicit and opt-in, and explain which coordinates are sent before activation.
2. Camera enabling is only exposed in onboarding. There is no persistent stop/restart control, and the orientation controller returned by `startOrientation()` is discarded. The camera code returns no stop handle. The product cannot reliably express or control its capture state.
3. If location fails, calculations silently use New York while telemetry says “no location.” A geographic default must be visibly named as a demonstration location until the person supplies a location.
4. The dock handle is a `div role=button` with no keyboard support. Object rows are pointer-only `li` elements. Layer chips lack pressed state. Sensor/feed status uses colors plus hover titles. Canvas content has no equivalent searchable full list. These block nonpointer operation.
5. Global arrow-key handlers also run while editing controls. Scope sky navigation to a focused viewport or ignore editable elements. Remove `user-scalable=no`; preserve zoom and scrolling for controls/content.
6. Stars, planets, camera, and live traffic have different update requirements. Visible controls must expose simulated time distinctly; live aircraft cannot be shown as if they represent the selected historical sky.
7. The initial roadmap asserts sensor fragmentation and CORS restrictions are “solved,” physical performance budgets are met, and every star/plane can be named. Replace such claims with supported catalog scope, documented failure states, and release-specific measurements.
8. Workbench shared moment input currently exposes numeric UTC offsets and 2026 standard/summer suggestions. These do not constitute historical timezone resolution. Avoid implying city selection establishes a historical birth offset. An unknown birth time must suppress ascendant/houses and other time-sensitive results.

## Information architecture

Keep SkyLens's compact inspector with task labels aligned to actual content:

| Destination | Role | Entry and integration |
|---|---|---|
| Sky | Camera or manual sky, search, selected object | Default surface; persistent **Enable camera / Stop camera**, search, and alignment status |
| Tonight / Explore | Rise/set, twilight, Moon phase, planet visibility; simulation only when supported | Existing Tonight panel; each object can return to sky guidance |
| Traffic | Optional satellites/aircraft with provenance and freshness | Keep separate from deterministic celestial calculations; no network enablement inferred from opening a tab |
| Settings & Saved | Location, time, calibration, layers, night appearance, saved objects/places | Existing settings panel plus intentional saved lists; collapse advanced calibration |
| Charts & Calendars | Link to existing Workbench chart/calendar routes | Ordinary named links; do not embed the large Workbench or duplicate its calculation layer |

Workbench keeps its five established navigation groups. Add **Open SkyLens camera** to a useful live-sky/context entry; add a single **Calendars & Tools** entry when its validated modules exist. Charts remain under Cast and supported traditions under Traditions. Preserve source/reference links. Cross-app links should use verified deployed project paths; pass time/location only following an explicit “Open this sky” action, never silently copy stored birth inputs.

## Main task flows and states

### 1. Sky: first use and returning sessions

Main task: see an explained, controllable camera overlay. Primary action: **Enable camera**. Secondary action: **Explore without camera**. Avoid making people learn “AR versus manual” terminology before starting.

Explain camera (local live backdrop), motion (aim estimate), and location (local horizon) in a short first-use sheet. State “Positions are calculated from time, location, and sensors; the camera does not recognize objects.” Request motion permission directly during the initiating user gesture where the platform requires it. Request camera and location only for the explained task; manual coordinate entry remains available. Permission success is per capability, not one combined boolean.

Returning visitors see a usable sky immediately and a reachable **Enable camera** button; remembered preferences do not imply a new camera permission grant. While starting, show **Starting camera…** and prevent concurrent start requests. A successful camera shows **Camera on** and **Stop camera**. Stopping releases video tracks and unnecessary motion listeners. Backgrounding pauses active work; returning shows the actual resumed/paused state and a restart action when needed.

Denial: “Camera permission was denied. You can enable it in browser settings or explore the sky below.” Busy camera: “The camera is in use. Close the other camera app, then retry.” Unsupported: “Camera access is unavailable in this browser.” Preserve manual view after all failures. Avoid automatic repeated permission prompts.

Location status must distinguish **Device location ±N m**, **Manual location**, **Saved location**, and **Demo: New York**. Provide **Use my location** and latitude/longitude fields with explicit units and ranges. Persist an intentional setting; do not store transient denial as a permanent preference.

### 2. Sky: identify, search, select, guide

Main task: find one object. Primary action: tap a visible label or use **Search objects**. A real search input searches the supported catalogs with category and above/below-horizon context. Empty query shows bright/recent/saved objects. No result says “No object in this catalog matches…” and preserves the query. Loading and catalog failure are distinct from zero matches.

Selection opens one compact detail panel with name, type, altitude, azimuth, relevant magnitude/phase, selected time and location context, **Guide to object**, and **Save object**. A below-horizon object is clearly labeled and never receives a “visible now” implication. Guidance stays attached to object identity and recomputes as time changes. Provide a text direction (“Turn east 25°, raise 12°”) alongside the graphical arrow. **Stop guidance** is explicit.

Lists and details serve as the screen-reader alternative to the canvas. Use native buttons in list rows; do not refresh focused list elements every second. Selected names may remain visible when lower-priority labels are suppressed. Label collisions should reserve space for the selected object and prevent a hit target from disagreeing with the label.

### 3. Alignment and layers

Main task: understand and correct an approximate overlay. A compact status says **Compass available**, **Relative motion—align north**, **Heading uncertain**, or **No motion—drag to explore**. Do not claim true north unless the input is known to be true-north referenced or corrected by a disclosed model/calibration.

Primary action for poor alignment: **Align view**. Show field of view with degrees and whether it is estimated/calibrated; expose heading offset and a clearly explained reset. Test portrait/landscape and cropping together. Front-camera fallback needs a visible indicator and verified projection/mirroring; otherwise leave a clear unsupported state.

Keep quick layers focused on common choices; advanced labels/magnitude/grid live in one **Layers** section. Every quick toggle and settings copy must stay synchronized and expose `aria-pressed` or checked state. Night appearance affects controls and overlays coherently; it does not assert a measured dark-adaptation benefit.

### 4. Tonight / Explore

Main task: choose when and what to observe. Default is current local date at the selected location, with explicit timezone. Primary action: **View in sky** on a planet/object. Secondary actions: select date, previous/next day, **Return to now**.

Show sunset/sunrise, astronomical darkness, Moon illumination/phase, and planet rise/set/visibility using existing engine capabilities. Distinguish “does not rise/set within this window” from calculation unavailable; a dash alone is insufficient at high latitudes. Meteor rates are a reference maximum under stated ideal conditions, not predicted local counts. If events are unavailable because the engine/catalog failed, keep the panel structure with a retry/help state.

A simulation must state units, time multiplier, source of ephemerides, whether sizes/distances are scaled, and its educational approximations beside the controls. Do not introduce a second disconnected date/location state. A visible **Simulated: [date/time]** banner and **Return to live** stay outside the collapsed dock. Freeze/remove live traffic in historical simulation.

### 5. Charts in the Workbench

Main task: compute a supported natal/transit/comparison chart. Preserve the existing master tool and routes. Group inputs as moment, place, and calculation method. Show calendar convention, local clock time, timezone or explicit verified UTC offset, coordinates, zodiac, house system, and supported ayanamsha. Defaults must identify their tradition.

Offer **Birth time unknown**. This excludes ascendant, houses, and time-sensitive divisions rather than filling an invented noon chart. Position uncertainty or a clearly labeled day-range summary is preferable where the Moon changes sign. Ambiguous daylight-saving times require selection of the earlier/later UTC instant; nonexistent local times are rejected. Historical offsets remain an explicit user input unless a validated timezone resolver is actually integrated.

Primary action: **Calculate chart**. Success displays the exact normalized UTC input and a compact methods summary before interpretation. Invalid inputs retain values, show inline errors and an error summary, focus the first error, and avoid updating an old chart as though it is new. Loading marks the calculation busy without losing input. A calculation error leaves the last result labeled with its original inputs or clears it explicitly.

Render a chart together with an accessible positions/aspects table. House systems unavailable at a latitude get an explicit unavailable state; changing to Whole Sign must be a user action with explanation. Tropical/sidereal output must not silently mix methods across panels. Keep interpretations in their named historical/traditional framework, without deterministic health/financial/event claims.

### 6. Calendars & Tools

Main task: get a calculated date/direction/time with a known convention. One shared date/location context and a compact method picker serve individual tools. Group date conversion, observance calendars, prayer/direction tools, and astronomical timing; render only supported tools.

Every result includes source date, converted date, method, day-boundary convention, and timezone where applicable. Gregorian/Julian conversion must name the proleptic versus historical-reform convention. Islamic calculated dates must not imply local crescent observation; Hebrew dates must explain sunset boundaries; Hindu variants require a named regional/traditional convention. Other calendars appear only after their engine and reference dates are validated.

Prayer calculations expose meaningful method/Asr/high-latitude choices without forcing advanced settings on every visit. Qibla is a calculated initial bearing to the Kaaba relative to true north; distinguish it from uncertain sensor heading. Sunrise/sunset absence is a real result and may make a particular time undefined. Observance listings must identify tradition, country, and source rather than assert a universal religious date.

Primary action: **Calculate** or **Convert**. Preserve input on error. Unsupported range/method, no solar event, and source data unavailable are distinct messages. Provide copy/export of plain-text results where implemented; never add a nonfunctional download control.

### 7. Saved & Settings

Main task: reuse an intentional location/object/chart input. Empty state explains how to save, with links to the relevant task. Saved chart data stays on the device unless explicitly exported or sent to an existing optional AI feature with its own disclosure. Provide named removal controls and a clear all-data reset. Local-storage denial/quota errors must leave the app usable and say preferences will last only for the session.

Separate calculation preferences from presentation preferences. Keep location/time context visible in all result screens. Night mode, reduced-motion preference, and layers should survive refresh when storage works. Show active engine and data source/version in **Methods & data**, not in the main camera controls.

## Component and layout plan

Reuse the current modules rather than introducing a framework. In SkyLens, `main.js` owns state and lifecycles, `sensors.js` owns permission/capture, `ui.js` owns accessible DOM, `render.js` owns canvas drawing, and calculation modules stay pure. A small persistent action bar contains camera state/action, object search, and inspector toggle. The detail panel and existing inspector must not cover one another.

Use native `button` for inspector toggle with `aria-expanded`/`aria-controls`; semantic navigation buttons or properly implemented tabs; native labeled inputs; a polite status region for errors/completion, not 4 Hz telemetry; a structured search-results list; object detail headings; and a shared method-summary disclosure. Use event delegation without replacing the focused node during telemetry updates.

Retain near-black, cyan/amber instrument accents and red night palette. Correct low-contrast tertiary text and add stable opaque/scrim surfaces where arbitrary camera footage makes text unreadable. Aim for WCAG AA contrast and at least 44 × 44 CSS-pixel comfortable touch targets for primary camera controls. Use tabular numerals for measurements, normal prose sizes for instructions, clear focus outlines, and no dependence on color alone. Existing reduced-motion handling should remain.

On portrait phones, keep primary actions near the lower reach area and preserve safe-area insets. The inspector may expand to a bounded height with its own scrolling. On short landscape screens, cap the inspector to a usable portion of the viewport and allow the onboarding sheet to scroll; do not trap controls below the keyboard. At 320 CSS pixels and browser zoom, form rows wrap rather than overflow. Desktop supports search/list workflows and scoped arrow navigation. Body scroll locking is appropriate for the viewport, but content panels and dialogs must remain scrollable.

## Prioritized implementation gates

Priority definitions: P0 is broken core behavior, incorrect output/context, or a release blocker; P1 is a central requested workflow; P2 is an extension with clear dependencies. These are recommendations for the lead's living roadmap, not a downgrade of requested scope.

| ID / priority | Problem and expected behavior | Owner / affected files | Dependency / approach | Acceptance and validation | Status |
|---|---|---|---|---|---|
| UX-01 P0 | Local-only privacy claim contradicts automatic aircraft request | Lead + sensor/UI engineer; `main.js`, `planes.js`, `ui.js`, `index.html` | Explicit opt-in; truthful copy; stop poller when inactive | No aircraft request before opt-in in network trace; coordinates disclosed; frames never uploaded | Implemented: external feed opt-in and coordinate disclosure; browser network verification pending |
| UX-02 P0 | Camera lifecycle not controllable after onboarding | Camera engineer; `sensors.js`, `main.js`, UI | Persistent start/stop, cleanup, denial/busy states | Repeated start does not leak streams/listeners; background/return flow verified | Implemented: persistent start/cancel/stop/retry controls and camera state; lifecycle testing owned by camera lane |
| UX-03 P0 | Fallback sky has hidden geographic context | Lead; state/telemetry/settings | Named demo location; explicit supplied location source | Denied GPS keeps usable manual sky labeled Demo; calculations and displayed location agree | Implemented: named New York demo and supplied-location status; browser verification pending |
| UX-04 P0 | Nonpointer controls and global keyboard interference | UI engineer; HTML/CSS/`ui.js`/gestures | Native buttons, focus, input labels, scoped keys, zoom | Keyboard-only enable/manual/search/layers/dock; slider/input arrows edit only control; screen-reader labels | Implemented: native dock/list controls, tabs, visible focus, labels, scoped main keys and zoom; screen-reader verification pending |
| UX-05 P0 | Timezone/unknown-birth precision can mislead | Chart engineer; shared input and result pipeline | Explicit offset/verified resolver; omit time-dependent output | DST gap/fold and unknown-time reference journeys; exported inputs match shown UTC | Input limitation observed; full page audit pending |
| UX-06 P1 | Sky task currently hides camera behind mode decision | UI + camera engineer | Camera action first; explanation and manual fallback | First visit/return/denial reach usable sky; Stop camera always reachable | Implemented: camera action first and manual fallback in native dialog; browser verification pending |
| UX-07 P1 | Object search and stable keyboard details missing | Sky/UI engineer; `ui.js`, state, catalogs | Search existing catalogs; stable selection by ID; accessible detail list | Query, zero results, below horizon, guide/stop, focus retention checked | Implemented: search, object details, save, guide/stop and horizon context; browser verification pending |
| UX-08 P1 | Alignment quality and calibration not explained | Camera engineer; sensor/projection/settings | Named sensor states; heading/FOV calibration with reset | Sensor replay covers wrap/rotation; physical phone checklist remains explicit | Implemented: sensor text, diagonal FOV, heading/altitude correction and reset; physical verification pending |
| UX-09 P1 | Time exploration needs truthful live/simulated context | Astronomy engineer; shared clock/UI/feeds | One selected clock; reset now; suspend incompatible feeds | Selected time visible with dock closed; all deterministic outputs share instant | Implemented: UTC control, simulated banner and Return to now; astronomy lane owns shared clock/feed validation |
| UX-10 P1 | Disconnected app discovery and calculator sprawl | Lead + UI; shared nav and SkyLens links | Verified reciprocal links; preserve routes/traditions | Real deployed links and Pages subpaths resolve; no duplicate calculator shell | SkyLens links implemented; reciprocal Workbench links and live deployment checks owned by lead |
| UX-11 P1 | Method/edge states absent or ambiguous in tools | Calculation + UI engineer | Methods summaries, no-event/unsupported/error distinctions | Reference date/location tests plus complete calculator journeys | SkyLens event/no-event/freshness methods exposed; chart/calendar methods verification owned by calculation lane |
| UX-12 P1 | Small landscape/zoom and bright camera readability need evidence | UI/QA; CSS and panels | Wrap controls, bounded scrolling, stable scrims | Batched 390×844, 844×390, 320-wide zoom, desktop checks; keyboard and contrast audit | Implemented responsive CSS and opaque text surfaces; rendering/zoom verification blocked locally |
| UX-13 P2 | Saved work and observing notes improve reuse | Lead; persistence UI | Shared explicit save/remove semantics | Refresh persists valid values; corrupt/blocked storage degrades cleanly | Implemented favorites and local observation note; browser persistence verification pending |

## Bounded verification and release evidence

Pass 1 (this document): architecture/source feasibility review. Resolve privacy, lifecycle, context, accessibility, and scientific-precision issues before adding surface area.

Pass 2: independent skeptical review of working features. Verify calculations against independent references and exercise sensor/permission replays. Include unknown birth time, ambiguous/nonexistent timezone input, high latitude, stale traffic, failed engine/catalog, denied camera/location, and blocked storage. Do not count identical-formula tests as independent scientific validation.

Pass 3: one batched desktop/mobile/landscape visual and workflow review of the integrated release, one defect-fix batch, then at most one confirmation round. Capture actual screenshots, console/network errors, test commands/results, exact revision, and live deployed URL. Record any unresolved P0/P1 directly. Avoid claiming WCAG conformance or hardware alignment from a source review.

Physical-device checklist remains separate: current iOS Safari and Android Chrome; rear camera portrait/landscape; front fallback if supported; known star/planet or distant landmark; magnetic disturbance; north/heading wrap; calibration reset; motion denied/silent; camera denied/busy/revoked; lock/background/return; screen rotation; repeated start/stop; measured lag and field-of-view alignment. Record device/OS/browser/time/location, observed angular offset before/after calibration, and whether true north was measured, corrected, or estimated.

Release copy should state exactly which tests passed and which checks remain pending. The implementation must not call a locally rendered preview a deployed release or label a sensor-only overlay visual recognition.

## UI implementation checkpoint

The SkyLens UI implementation now lives in `index.html`, `js/ui.js`, and `css/style.css`; this plan's corresponding statuses above have been updated. Existing local engine loaders are maintained by the lead. No protected assets or extra UI framework were introduced. The diagram in Explore is a lazy-loaded, calculated solar-system view supplied by `js/orbits.js`.

Executed static checks: `node --check js/ui.js`; unique HTML IDs; resolution of every `for`, `aria-controls`, `aria-labelledby`, and `aria-describedby` target; resolution of literal UI ID selectors; no `innerHTML` rendering sink in the UI module; removal of the zoom lock. All passed.

Runtime checks remain pending: local HTTP binding returned `EPERM`, and `/usr/bin/chromium` could not launch because crashpad `setsockopt` returned `Operation not permitted`. No screenshot, screen-reader, zoom/reflow, physical camera, or browser-persistence result is claimed from those blocked attempts. The release browser harness covers realistic mobile/desktop journeys when run in an environment that permits a server and browser.
