# Premium tracking and observing workflow research

Research date: **2026-10-05**, approximately 23:35–23:42 UTC (19:35–19:42 America/New_York). Scope: the SkyLens geographic globe and live local Sky. This is an official-source comparison and code review, not a hands-on usability study of paid products. No subscriptions, accounts, paid APIs, provider feed probes or remote product installations were used for this research.

## Decision

Keep the existing **native ES modules, Canvas 2D, D3 geographic projection and bounded traffic Worker**, deployed on GitHub Pages. Improve the connected Sky/Globe workflow, coverage hierarchy, searchable loaded-object list and selected-object actions. These address the useful interaction patterns in the products below with the data and calculation engines already available.

A worldwide globe is a viewing surface, not evidence of complete worldwide aircraft coverage. Consumer subscriptions also do not grant permission to redistribute a vendor's API, imagery or historical records. See [globe-data-research.md](globe-data-research.md) and [aircraft-nearby-sources.md](aircraft-nearby-sources.md) for the separately verified source and delivery constraints. The accepted design and implementation ledger are in [tracking-design-brief.md](tracking-design-brief.md).

## Representative products and tier boundaries

The selection covers flight monitoring, geospatial exploration and observing workflows. It is not an exhaustive comparison of every app or every feature in these apps. Product claims below describe their own published offerings; they are not independent accuracy measurements.

| Product and user task | Official workflow and verified tier distinctions | Applicable SkyLens implementation | Entitlement or validation boundary |
| --- | --- | --- | --- |
| **Flightradar24:** find an aircraft, inspect it, revisit a flight or place | Map selection opens flight details; last-clicked flights and bookmarks support revisiting. The feature explainer labels list view Gold/Business and fleet view Business. History/global playback: Free 7 days, Silver 90 days, Gold 365 days, Business 3 years. Bookmarks: 1/10/25/60 respectively. [FR1–FR2] | Use our loaded-object list, stable selection, follow and factual inspector. Keep actions reachable before dense telemetry. Local bookmarks are technically possible, but are deferred in this pass. | FR24 explicitly says API access is **not included** in Silver/Gold/Business. Routes, schedules, ETA, airport databases, historical global playback and weather cannot be inferred from a position report. No FR24 assets, logos, code or data are imported. |
| **FlightAware:** monitor selected aircraft and airports across a map and table | Enterprise's MyFlightAware map/table supports unlimited aircraft versus Basic 5, and 50 airports versus Basic 3; Enterprise history is 8 months versus Basic 3. Enterprise also describes unlimited flight alerts. [FA1–FA2] | Preserve the selected object through updates; show identity, available observations and age together. A local observing list can follow the same task structure without using their service. | Notification delivery, predictive ETA and retained history require data and service infrastructure. AeroAPI is a **separate usage-priced API**, with explicit storage/distribution tiers; a consumer workflow is not an API licence. [FA3] |
| **ADS-B Exchange:** inspect an aircraft report and understand source coverage | Official member table separates Member, Premium and Feeder. Tracking/MLAT map is in all three; ad-free map is Premium/Feeder; notifications/alerts are shown as Feeder-only. Store advertises personal ad-free map access plus premium map layers. [AD1–AD3] | Distinguish aircraft reports from calculated satellite positions. Keep altitude type, report age, source and missing fields visible. Avoid decorating unreported fields with plausible values. | Their product page lists map features alongside the subscription; it does **not** prove every listed feature is exclusive to Premium. Global/streaming/historical data are separately sold data products, with contractual scope. [AD4] |
| **Google Earth:** explore an area, orient oneself, annotate and return to a place | Official versions page describes globe exploration, imagery/terrain/buildings, placemarks and collaborative maps; desktop Pro adds GIS import/export and historical imagery. Current plan page names Standard, Professional and Professional Advanced, differentiated by import capacity, project limits, layers and modeling. [GE1–GE2] | Readable geography, obvious zoom/reset controls and explicit observer versus map centre; optional future saved viewpoints. Keep the geographic view as the primary visual artifact. | Earth imagery and terrain are not bundled with D3 or freely reusable because an end-user viewer is accessible. Google's Photorealistic 3D Tiles API requires billing setup, API key, policy compliance and attribution. [GE3] |
| **Sky Guide:** point, identify an object, explore time and plan a night | Current US store listing describes camera AR, time travel, a location-filtered calendar, ISS notifications and offline operation; it is free with purchases. Official support describes Plus expanded catalogues/dark-sky finder/meteor forecasts, and Pro additional catalogue depth, zoom, tours and FOV tools. [SG1–SG2] | Direct camera entry with an accessible manual fallback; selected-object facts, visible time/location and return-to-live action. Reuse local catalogue and calculations for planning. | The Plus/Pro support matrix was last updated **2022-06-15**; the current store also lists a Pro Lifetime purchase. Exact present platform-wide tier limits were not established. AR descriptions do not establish visual recognition of camera pixels. |
| **Stellarium Mobile / Plus:** orient, inspect, plan observation | Current comparison puts sky objects, constellations, imagery, satellites, cultures and night mode in both; Plus adds 3D view, observation calendar, instrument ocular and telescope control. Official AR instructions: compass → Sensor Mode → point skyward → compass again for camera blending. [ST1–ST2] | Keep camera/motion state understandable, use restrained observing colours, and make methods and alignment controls reachable. Existing ephemeris-backed visibility and event calculations can support planning. | Large online catalogue packaging and survey imagery have separate data obligations. Telescope control requires compatible hardware/protocols. Sensor-based pointing does not verify phone alignment without physical-device checks. |
| **SkySafari:** plan targets, observe, record a session and configure equipment | The current official homepage promotes **version 8**: Tonight at a Glance, Observe menu, equipment/FOV, event finder, lists/sessions/notes and LiveSky synchronization. Pro has expanded/on-demand catalogues and image integration. Optional Premium membership applies to V7/V8; **StarPX Remote Solve is explicitly Premium-only**. [SS1] | Connect current target selection to local Sky, tonight context and existing saved observations. FOV visualization and an altitude/time chart are separately implementable from licensed local catalogues and validated geometry. | Imported-image plate solving is a distinct image-analysis workflow. Remote solving, cloud sync, high-resolution images and hardware integrations are not supplied by our sensor overlay. The still-live V7 comparison must not be relabelled as a V8 tier matrix. [SS2] |

### Price evidence, without an invented universal price list

Prices change by platform, region, taxes, promotion and billing interval. Only the following numeric prices were unambiguously available in the fetched official sources:

- ADS-B Exchange's storefront lists **USD 2.99/month or USD 29.95/year** for its personal ad-free subscription; commercial use is excluded from that offer. This does not buy a global feed for this application. [AD1–AD2]
- FlightAware's **AeroAPI**, distinct from its consumer subscriptions, lists Personal with no monthly minimum and a USD 5 monthly free allowance (USD 10 for feeders); Standard has a USD 100/month minimum and Premium USD 1,000/month, plus applicable usage charges. Its table restricts Personal storage/distribution of derivative works to personal or academic use; historical APIs and alerting are not included in that tier. No account is created or proposed here. [FA3]
- Current FR24 plan names and feature differences were readable, but reliable locale-specific checkout prices were not. FlightAware consumer prices and current Google Earth numeric plan prices were not established from the retrieved pages. The Sky Guide and SkySafari evidence does not establish a complete current cross-platform purchase matrix. No numeric estimates are substituted for these gaps.

### Source conflicts and read-depth limits

- FR24's detailed feature text labels turbulence Business-only while a nearby FAQ groups turbulence with Gold weather benefits. This report therefore does not infer an exact turbulence entitlement. A multi-select paragraph also repeats AR wording; it is not treated as a reliable interaction specification.
- Sky Guide's older Plus/Pro support article is retained with its date, rather than presented as a complete current storefront matrix.
- Stellarium's published catalogue counts vary between official/store descriptions. Catalogue-size superiority is not part of this recommendation.
- SkySafari's V7 comparison is legacy; text extraction loses some feature checkmarks. The current V8 homepage supports the specific claims made above, not a reconstructed Basic/Plus/Pro matrix. No Basic tier is described here as free.
- Google's fetched Earth plans page names tiers but exposes no complete numeric rate card. Its older Enterprise/Pro licence pages were not used to infer current consumer prices.

## Existing code and reuse boundary

The branch inspected is `feat/globe-flight-radar-2026-10`. Implementation is concurrent with this research; the files below are integration boundaries, not proof that a release has passed its gates. In particular, category controls/reset and the action-first inspector order were being added by the UX agent during this review. Their presence in inspected source is not evidence that the preceding release already contained them.

| Module | Responsibility observed in the working branch | Boundary to preserve |
| --- | --- | --- |
| `globe.html`, `css/globe.css`, `js/globe-ui.js` | Globe controls, loaded-object list/search, source forms, inspector, follow and Sky action | Improve hierarchy and mobile layout without a second competing dashboard. List filters are explicitly list-only in this release. |
| `js/globe.js`, `js/globe-math.js`, `js/globe-render.js` | Controller, geographic projection, geographic marker/label layout and hit testing | Geographic subpoints and symbolic marker sizes are not physical satellite scale. Backside objects must not become visible/pickable frontside markers. |
| `js/traffic-feed.js`, `js/traffic-worker.js` | Bounded permitted-receiver parsing, explicit schema/source state and optional Worker normalization | No unauthorized tiling of nearby queries into a global feed; no silent provider switch. Worker fallback must remain bounded. |
| `js/planes.js`, `js/aircraft-geometry.js` | Nearby aircraft source lifecycle, freshness and observer geometry | Preserve geometric versus pressure-altitude distinctions and uncertainty. Do not generate routes or destinations from heading. |
| `js/satellites.js`, local satellite.js | Orbital elements, source age and SGP4 propagation | Display computed positions with orbital epoch/freshness; do not depict stale elements as fresh measurement. |
| `index.html`, `js/main.js`, `js/ui.js`, `js/render.js`, `js/sensors.js` | Camera/Sky entry, observer state, manual and sensor interaction | Navigation does not itself grant camera, motion, location or provider consent. Device pose and map centre are separate concepts. |
| `js/sky.js`, `js/events.js`, `js/names.js` | Shared sky objects, event calculations and English/Hindi names | Preserve object IDs, ephemeris time/location and documented naming conventions across views. |

## Stack evaluation and costs

These are maintenance/engineering assessments based on the actual architecture and current official documentation, not benchmark results. No alternative renderer was installed or timed for this report. Open-source software licence costs below exclude hosting, data, support and engineering time.

| Option | Capabilities and licence | Integration/data cost | Decision |
| --- | --- | --- | --- |
| **Current ES modules + Canvas 2D + D3-geo + native Worker** | Static browser delivery; existing geographic clipping, orthographic projection, local cartography and bounded record processing. D3-geo's primary licence is ISC with included GeographicLib notice. [TO1–TO2] | No additional framework or mandatory paid service. Continue preserving notices, caching cartography, limiting label work and suspending hidden views. Canvas requires the existing DOM list/inspector for keyboard/screen-reader access. | **Adopt for this pass.** Refine the current tested boundaries; measure actual render/parse cost using the release benchmarks. |
| **Three.js** | MIT general-purpose 3D scene/renderer library; current homepage identifies r186. [TO3–TO4] | No engine licence fee. Geographic precision, clipping, tile/data delivery, labels, picking and accessible alternatives remain engineering responsibilities. Models/textures would need provenance and downloads. | **Defer.** Appropriate for a demonstrated 3D mesh/lighting task; changing renderer solely for appearance does not address current user or data problems. |
| **CesiumJS** | Apache-2.0 WGS84 globe, time-dynamic entities, 3D Tiles, terrain/imagery, KML/GeoJSON/CZML and glTF; accepts ion **or another source**. [TO5] | Engine is free for commercial/noncommercial use. Additional assets/workers and data deployment need Pages-path/CORS testing. Optional ion is separate: Community is personal/noncommercial, 5 GB storage and 15 GB/month streaming; Commercial individual is USD 149/month, with additional integration terms for solutions outside an organization. These are not engine fees. [TO6] | **Defer.** Reconsider if true 3D altitude/terrain or large standardized 3D datasets become an accepted requirement with a suitable data source. Ion is not mandatory for CesiumJS. |
| **MapLibre GL JS** | BSD-3-Clause main licence with bundled third-party notices; WebGL vector-tile maps, styles and a globe-style example in current docs. Current docs describe v6 ESM and explicit worker packaging. [TO7–TO8] | No engine licence fee. Tile styles, data, glyphs, sprites, attribution, CORS and hosting remain separate. The docs explicitly tell users of MapTiler examples to obtain their own key. Its worker/shared-module paths require deliberate static deployment packaging. | **Defer.** Good candidate if street-level maps and tile styling become the primary task. Do not replace the current globe or adopt a demo tile endpoint as a production service by assumption. |

No React, Vue, Next.js or additional parallel UI framework is needed for this bounded change. Native modules and a Worker already separate presentation, calculations and ingestion. A future framework decision should name a measurable problem, migration cost and acceptance test; plugin availability alone is not a reason to add one.

### AI and simulation choices

AI advisors and subagents are used to compare sources, challenge design assumptions and review implementation. They are not a flight-data source or a replacement for validated ephemerides, SGP4, WGS84 transforms or sensor replay tests. No paid model endpoint or hosted AI dependency is introduced into the static app.

An optional future assistant could explain supplied fields and methods or prepare a local observing plan while preserving source/time/uncertainty. It must not invent missing callsigns, aircraft positions, future manoeuvres, celestial coordinates, historical observations or physical-device alignment. Simulated sky time and calculated satellite motion remain visibly distinct from reported aircraft positions. A high-quality visual treatment must preserve those distinctions.

## Accepted improvements for this release

The lead and art-direction reviewer accepted the following four bounded changes. They refine existing mechanisms rather than claiming four new calculation engines. Implementation and final browser evidence are tracked in the design brief and release verification, not inferred from this research.

| Priority / task | Expected behavior and affected files | Acceptance and validation |
| --- | --- | --- |
| **P1: Connected Sky and Globe** | Explicit current-view navigation connects `index.html` and `globe.html`. Preserve the existing selected-object Sky action in `js/globe-ui.js`/`js/globe.js`; retain camera and Auto AR controls in Sky. | Native links have current-page semantics and reachable targets; round trip works under the Pages project path. Switching views alone causes no camera/motion/location prompt or new recipient request. Existing observer location is not replaced by a panned map centre. Test keyboard and mobile navigation. |
| **P1: Coverage hierarchy** | Compact scope, state and loaded count in `globe.html`/`js/globe-ui.js`; full provider time, response receipt time, quota and errors in Data & coverage. `css/globe.css` contains long-source text without obscuring the globe. | Off, loading, regional/receiver, empty-success, paused, limited and unavailable remain distinct. Receipt age is not position age. A valid empty response does not claim empty airspace. Test long source descriptions, narrow portrait and error/cooldown fixtures. |
| **P1: Searchable loaded list** | Add/clarify All, Aircraft and Satellites category controls with counts and a clear reset; retain existing search fields and stable IDs in `js/globe-ui.js`. Label these controls **list filters**. | Search/category changes affect only loaded list results, never map layers, polling or consent. Layer toggles remain the map controls. Reset clears query and category and restores focus. Selection/focused control survives ordinary data refresh. Test no-match versus no-data states and far-side objects accessible through the list. |
| **P1: Action-first inspector** | Object identity, Follow and View in Sky precede source/coordinate facts; use the existing handlers in `js/globe-ui.js`, styled in `css/globe.css`. | Current selection is legible; actions remain reachable in bounded phone/landscape sheets. Old/missing objects explain expiry and cannot follow a stale marker. Unknown altitude and ground state remain unknown; satellite positions remain labelled calculated. Verify focus retention, selected-centre visibility, night palette and reduced-motion behavior. |

The visual direction remains an observing instrument: dark navy/near-black surfaces, blue actions, amber selection and a red night palette; geographic information carries the scene. No generated celestial imagery, copied vendor artwork, airline liveries or photorealistic terrain is required. Visual polish is tested against overlap, focus, contrast and available viewing area, rather than measured by added decoration.

## Deferred boundaries and reasons

- **Shared map/list search filters:** deferred this iteration. The existing list filter and map layer controls have different contracts; silently applying a list query to the map could hide the selected marker. A shared-filter design needs explicit state, visible effects and selection rules before implementation.
- **Saved map viewpoints/watchlists:** feasible with local storage, but deferred until the actual navigation need is validated. The accepted improvements do not need another saved-state collection. Future storage must have validated records, stable IDs and no automatic provider reconnect merely because a bookmark was loaded.
- **Routes, arrivals/ETA, weather, global archive playback and cloud alerts:** require independently licensed sources/service operations. Current nearby or authorized receiver reports do not establish these facts. No mandatory paid account is introduced.
- **Global aircraft completeness:** remains a source limitation, not a UI milestone that can be satisfied by drawing more markers. Do not fabricate traffic, tile a restricted nearby API or hide quota exhaustion.
- **3D terrain, detailed aircraft models and street maps:** deferred until the workflow justifies their downloads, licence obligations, GPU requirements and additional testing. Review Cesium/MapLibre then with a real data source and measured prototype.
- **Remote image solving, telescope control and account synchronization:** separate product work needing image-analysis/hardware/service contracts. Camera AR remains sensor projection; actual phone alignment is a physical-device validation item.

## Source ledger

All sources below were reviewed on **2026-10-05**. Full relevant product descriptions/tables were fetched where available; a missing or ambiguous tier cell is not inferred. No claim is made that every platform build or paid screen was exercised.

| ID | Official source | Read depth / caution |
| --- | --- | --- |
| FR1 | <https://www.flightradar24.com/premium/> | Plans, API-separation FAQ, payment/region context; no reliable numeric locale price extracted. |
| FR2 | <https://www.flightradar24.com/blog/product-features/> | Detailed feature descriptions, labelled history/bookmark/list-view tiers; conflicting weather text noted above. Page's original publication is 2022, not today's date. |
| FA1 | <https://www.flightaware.com/commercial/premium/> | Consumer monitoring/history/bookmark overview. |
| FA2 | <https://support.flightaware.com/hc/en-us/articles/41484535495831-What-Are-My-Enterprise-Subscription-Features> | Enterprise versus Basic limits and MyFlightAware workflow. |
| FA3 | <https://www.flightaware.com/commercial/aeroapi/> | Current API tier, storage/distribution, rate and pricing tables; not a consumer subscription matrix. |
| AD1 | <https://store.adsbexchange.com/products/annual-ad-free-adsbexchange-subscription> | USD price, personal-use scope and included ad-free/premium-layer description. |
| AD2 | <https://store.adsbexchange.com/products/monthly-ad-free-adsbexchange-subscription> | USD monthly price and personal-use scope. |
| AD3 | <https://www.adsbexchange.com/community/member-hub/> | Member/Premium/Feeder feature table. |
| AD4 | <https://www.adsbexchange.com/data/> | Data subscription products; current page specifies ongoing subscriptions/minimum annual commitments and separate low-cost community API. Marketing coverage/speed claims are not independently verified here. |
| GE1 | <https://earth.google.com/web/plans> | Tier names and capability categories; incomplete numeric rate-card extraction. |
| GE2 | <https://www.google.com/earth/about/versions/> | Web/mobile/desktop workflow descriptions. |
| GE3 | <https://developers.google.com/maps/documentation/tile/3d-tiles> | Billing, API key, policy and attribution prerequisites for Photorealistic 3D Tiles. |
| SG1 | <https://apps.apple.com/us/app/sky-guide/id576588894> | Current US store description/free-with-purchases and purchase-name evidence, independently read by research reviewer. |
| SG2 | <https://support.fifthstarlabs.com/article/25-plus-and-pro> | Complete support article, last updated 2022-06-15; independently checked by two research agents. |
| ST1 | <https://stellarium-labs.com/stellarium-mobile-plus/> | Complete comparison and observation/instrument descriptions. |
| ST2 | <https://stellarium-labs.com/blog/arfeature/> | Complete sensor-to-camera instructions. |
| SS1 | <https://skysafariastronomy.com/> | Current V8/Pro/Premium narrative, explicit remote-solve restriction and observing workflow. |
| SS2 | <https://skysafariastronomy.com/skysafari-7-comparison-chart.html> | Legacy V7 reference only; checked by research reviewer, tier checkmarks not reliably extracted. |
| TO1 | <https://d3js.org/d3-geo> | Projection/geometry/clipping and GeoJSON conventions; preserve winding/antimeridian tests. |
| TO2 | <https://github.com/d3/d3-geo/blob/main/LICENSE> | ISC licence plus GeographicLib notice. |
| TO3 | <https://threejs.org/> | Current official library entry, r186 displayed. |
| TO4 | <https://github.com/mrdoob/three.js/blob/dev/LICENSE> | MIT licence; official docs index also inspected, not used to claim browser performance. |
| TO5 | <https://cesium.com/platform/cesiumjs/> | Apache-2.0, supported data and time-dynamic globe capabilities. |
| TO6 | <https://cesium.com/platform/cesium-ion/pricing/> | USD plans, Community scope/quotas and external-integration licensing note. |
| TO7 | <https://maplibre.org/maplibre-gl-js/docs/> | Current ESM/worker installation, globe style in quickstart and tile-provider guidance. A separate old display-a-globe example URL did not fetch and is not relied on. |
| TO8 | <https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt> | Main BSD-3-Clause text plus bundled third-party notices. |

Research tools: Exa search and primary-page fetch, local source inspection, one independent astronomy-product research subagent and coordination with the lead/art-direction agents. No benchmark improvement, successful release, human usability outcome or physical-device alignment is claimed by this document; those need their own recorded evidence.
