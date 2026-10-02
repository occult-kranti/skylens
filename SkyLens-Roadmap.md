# SkyLens — Product & Technical Roadmap

**Live-sky AR tracker: stars, constellations, deep-sky objects, planets, satellites, and aircraft — point your phone camera at the sky and name everything.**
Version 0.2 · Prepared 2026-10-03 · License: MIT · Stack: 100% open source, zero-build static site, GitHub Pages hosted.

---

## 0. Executive summary

SkyLens is a browser-based augmented-reality sky tracker. It overlays labeled stars, constellation figures, Messier deep-sky objects, planets, the Sun/Moon, satellites (SGP4-propagated from live TLEs), and real aircraft (live ADS-B) on the phone's camera feed, positioned by the device's compass + gyroscope. No app install, no build step, no backend: a static site that runs entirely client-side and deploys to GitHub Pages.

**Why this shape:** every competing product is a native app (Sky Guide, Star Walk 2, Stellarium Mobile, Flightradar24 AR). The web platform can now do the core job — `getUserMedia` (camera), `deviceorientationabsolute` (compass), `geolocation`, and ES-module JS astronomy libraries — with zero install friction. The constraint is sensor fragmentation and CORS-restricted data; both are solved below.

**Status at roadmap publication:** v0.1 MVP is implemented (camera AR overlay, 1,023-star catalog, planets/Sun/Moon, live satellites, live aircraft, manual mode, self-test suite) and ships with this document.

**v0.2 (same day):** constellation figures + name labels (89, d3-celestial data), all 110 Messier deep-sky objects, Tonight engine (sunrise/sunset, astronomical-darkness window, moon phase + next quarters, planet rise/set/magnitude/morning-evening visibility, 11 annual meteor showers with live radiant positions), "Guide me ▸" off-screen chevron guidance from any list/card, layer chip row (Stars / Constellations / Deep sky / Satellites / Aircraft / Grid / Night), 4-tab dock (Sky / Tonight / Traffic / Settings). Test coverage: 36 node checks + 28 browser checks, all green.

---

## 1. Vision & personas

**Vision:** the fastest possible answer to *"what is that?"* pointed at the sky — under 3 seconds from URL to identified object.

| Persona | Need | Key flow |
|---|---|---|
| Casual stargazer | Name the bright dot | Point → label appears |
| Plane spotter | Identify overhead flights | Point → callsign, altitude, speed |
| ISS hunter | Know when/where to look | Visible-pass list → AR arrow guidance |
| Educator | Show constellations/planets live | Manual mode on projector, big labels |
| Developer | Trustworthy open data pipeline | Self-test page, repo, reproducible build |

**Non-goals for v1:** telescope control, deep-sky imaging, astrophotography stacking, social features, accounts.

---

## 2. Advisory board review

Five advisor personas reviewed the plan before build. Each entry: top concern → the recommendation adopted → sign-off criteria.

### 2.1 Product advisor
- **Concern:** AR apps die on the first-run experience; permission dialogs (camera + motion + location) arrive as a confusing triple-prompt.
- **Adopted:** Single "Enable AR view" consent screen that explains *why* for each permission, triggers all requests from one user gesture (required by iOS Safari for `DeviceOrientationEvent.requestPermission`), and offers **Manual mode** as a first-class fallback rather than an error state.
- **Sign-off:** first-time user reaches an identified object in ≤ 3 taps; every denial path leaves a usable app.

### 2.2 Mobile AR / UX advisor
- **Concern:** Google's AR design guidelines flag user fatigue and screen-locked UI obscuring the camera view; Apple HIG warns against over-relying on precise motion tracking.
- **Adopted:** chrome is confined to corner telemetry + a collapsible bottom dock, keeping ≥ 85% of the camera view clear; labels fade when dense; a "rest mode" (hold-still dims UI) defers to long sessions; seated/standing/fixed-hands all work because pointing is optional — drag-to-look works too.
- **Sign-off:** WCAG 2.2 AA contrast on all text (scrim behind chrome), touch targets ≥ 44 px, `prefers-reduced-motion` respected.

### 2.3 Astronomy data advisor
- **Concern:** coordinate correctness is the product. A 2° systematic error makes labels lie.
- **Adopted:** layered math with independent cross-checks — `astronomy-engine` (MIT) for ephemerides and sidereal time as the reference oracle; our fast RA/Dec→Alt/Az path validated against it in the node test suite; stars fixed at J2000 (max ~0.5° drift, acceptable for pointing; precession-of-date scheduled P3); satellites via `satellite.js` SGP4 (Vallado lineage) with structural sanity tests.
- **Sign-off:** node suite green: Polaris within 1° of true position, Sun cross-check within 0.1°, SGP4 radius within physical LEO bounds.

### 2.4 Performance / reliability advisor
- **Concern:** SGP4 propagation of hundreds of satellites + live polling can jank the render loop and hammer free APIs.
- **Adopted:** propagation on a 1 Hz scheduler (not per frame), render at rAF with cached unit vectors, DPR capped at 2, TLE cache 2 h in `localStorage` with bundled snapshot fallback, ADS-B poll 12 s (respects AvioADSB's anonymous 1-req-per-10-s tier), Web Worker + WASM SGP4 (satellite.js v7) reserved for P4 if budgets break.
- **Sign-off:** budgets in §8 met on a mid-tier Android; 3,000-satellite stress propagation < 2 s.

### 2.5 Open-source compliance advisor
- **Concern:** free community data has licenses and rate limits; ignoring them kills the endpoints for everyone.
- **Adopted:** license table (§3) ships in README + in-app About; CC BY 4.0 attribution for AvioADSB rendered in the UI; ODbL note for ADSB.lol; conservative poll intervals; graceful degradation when any endpoint dies.
- **Sign-off:** every third-party asset has a named license and an attribution surface.

---

## 3. Open-source stack & data sources

| Layer | Choice | License | Role |
|---|---|---|---|
| Satellite propagation | `satellite.js` 4.1.4 (shashwatak) | MIT | SGP4/SDP4 from TLEs, look angles |
| Planets/Sun/Moon/time | `astronomy-engine` 2.1.19 (Don Cross) | MIT | Ephemerides, sidereal time, moon phase, rise/set, elongation |
| Star catalog | HYG Database v4.1 (astronexus) | permissive | 1,023 stars ≤ mag 4.6, J2000 RA/Dec |
| Constellations + Messier | d3-celestial data (Olaf Frohn) | BSD | 89 figures + label points, 110 DSOs |
| Satellite TLEs (live) | CelesTrak `gp.php` (CORS: `*`) | public data | stations + visual groups |
| Satellite TLEs (fallback) | bundled `data/tle-snapshot.json` (173 sats) | public data | offline/degraded mode |
| Aircraft (live) | AvioADSB `/v1/point` (CORS: `*`) | CC BY 4.0 | ADS-B within 50 nm, 12 s poll |
| Fonts | Inter + Fira Code (Google Fonts) | OFL | UI / telemetry |
| Hosting/CI | GitHub Pages + Actions | — | static deploy |

**Rejected/for-later:** OpenSky (now OAuth-gated), adsb.lol (no CORS header on GET), airplanes.live (Cloudflare-blocks non-browser clients), satellite.js v7 WASM (multi-file ESM — planned P4 upgrade), three.js/WebGL (unnecessary for 2D overlay; revisit for sky-sphere mode).

**Coordinate pipeline (v0.2):**
```
Stars/constellations/DSOs J2000 RA/Dec ─┐
Planets/Sun/Moon ───┼─→ hour angle via GMST(+lon) → Alt/Az (WGS-84 geodetic)
TLEs → SGP4 → ECI → ECF → look angles ─┤
ADS-B lat/lon/alt → great-circle Az + geometric Alt (Earth curvature) ─┘
Device (α,β,γ,screen angle) → quaternion → camera boresight in ENU → gnomonic projection to screen px
Tonight: SearchRiseSet / MoonPhase / SearchMoonQuarter / Elongation (astronomy-engine) + static meteor table
```

---

## 4. UI/UX plan (documents, books, competitive teardown)

### 4.1 Governing documents & books
- **Google AR Design Guidelines** — four user modes (seated/standing × hands fixed/moving), fatigue, break prompts; drives minimal screen-locked chrome.
- **Apple HIG — Augmented Reality** — coaching before permission, direct manipulation, don't require precise motion; drives Manual mode parity.
- **WCAG 2.2** — AA contrast over arbitrary camera imagery (scrim + text-shadow), target size ≥ 24 px (we use ≥ 44 px), reduced motion.
- **Don Norman, *The Design of Everyday Things*** — affordances: the camera *is* the interface; every control earns its pixel.
- **Stephen Few, *Information Dashboard Design*** — telemetry legibility: monospace tabular numerals, status-color discipline (green/yellow/red only for feed health).
- **Cooper, *About Face*** — modeless where possible; settings collapse into one dock.

### 4.2 Competitive teardown → what we copy, what we skip
| Product | Steal | Skip |
|---|---|---|
| Sky Guide | calm, sparse labeling; tap-to-identify; tonight/events card | paywalled layers |
| Star Walk 2 | time scrubbing (P6); quick layer toggles | heavy chrome |
| Sky Tonight | object visibility metrics (rise/set/mag/visibility window) | account prompts |
| Stellarium Mobile | accurate alt/az grid toggle; constellation figures | desktop UI density |
| Flightradar24 AR | plane card: callsign/alt/speed | account wall |
| Satellite AR (AGI) | visible-pass arrow guidance | dated visuals |

### 4.3 Design system (v0.2, implemented)
- **Canvas:** full-bleed camera; overlay canvas `touch-action:none`; DPR ≤ 2.
- **Chrome layout:** live telemetry in viewport **corners** (mono, `text-shadow: 1px 1px 5px rgba(0,0,0,.7)`), brand top-left with `mix-blend-mode:difference`, **layer chip row** (horizontal scroll pills: transparent → accent-filled when on) above the bottom **inspector dock** (glass, `backdrop-blur`, drag handle, tabs: Sky / Tonight / Traffic / Settings), transitions `cubic-bezier(0.25,0.46,0.45,0.94)`.
- **Palette:** near-black `#050608` base; text ladder `#fff / hsl(0 0% 62%) / hsl(0 0% 34%)`; semantic accents — stars warm-white by magnitude, planets `#ffd9a0`, satellites amber `#ffb454`, aircraft/interactive cyan `#58c6ff`, constellation lines `rgba(140,170,255,.30)`, DSOs violet `#c4aaff`, Sun/Moon `#ffe9b0`; feed status green/yellow/red. **Time-adaptive chrome** by computed Sun altitude + red-shift **night-vision mode**.
- **Type:** Inter 400/600 for UI, Fira Code 11–13 px tabular for data; Google Fonts with system fallbacks, `font-display:swap`.
- **Micro-interactions:** tap → nearest-object identification card with "Guide me ▸"; off-screen targets get an edge chevron with Δaz/Δalt readout; label collision fade; horizon ribbon; compass ribbon in dock header; list rows tappable for guidance.

---

## 5. Architecture (v0.2, zero-build ES modules)

```
index.html ── js/main.js (bootstrap, rAF loop, state store)
  ├─ js/astro.js      pure math: GMST/LST, RA/Dec→Alt/Az, ENU vectors, gnomonic projection, great-circle plane geometry  [node-testable]
  ├─ js/events.js     Tonight engine: sunEvents, moonEvents, planetEvents, activeShowers (AE injected → node-testable)
  ├─ js/objects.js    constellation figures + Messier DSOs (d3-celestial data), per-frame alt/az projector
  ├─ js/sensors.js    camera (getUserMedia), orientation (absolute→fallback→iOS permission), geolocation, manual mode    [browser]
  ├─ js/sky.js        stars.json loader + planet/moon/sun positions via vendor/astronomy.js (null-safe degradation)
  ├─ js/satellites.js TLE fetch (CelesTrak, 2 h cache) → snapshot fallback → 1 Hz SGP4 scheduler via vendor/satellite.min.js
  ├─ js/planes.js     AvioADSB poll 12 s, exponential backoff on 429/5xx, empty-state handling
  ├─ js/render.js     canvas overlay: grid, constellation lines/labels, stars, DSOs, glyphs, guidance chevron, hit-testing
  └─ js/ui.js         chips, dock tabs (Sky/Tonight/Traffic/Settings), Tonight cards, toasts, info card, About/licenses
test.html             in-browser self-test + stress harness (?auto=1)
tests/node/run.mjs    node suite: 36 checks — math oracle, SGP4, events, datasets, projection, stress
tools/build_data.py   regenerates data/stars.json + data/tle-snapshot.json from upstream (used by optional CI)
vendor/               astronomy.js (MIT), satellite.min.js (MIT) — local-first, pinned-CDN fallback, gitignored
data/                 stars.json, tle-snapshot.json, constellations.json, dsos.json
```

**State model:** single `state` object (`location`, `attitude`, `time`, `layers`, `highlight`, `feeds`) mutated by named actions; render is a pure function of state + cached vectors. **No framework** — zero-build is what makes GitHub Pages trivial.

---

## 6. Workstream "swarm" lanes

Parallel agent lanes, each with sub-agent roles, inputs, outputs, and done-criteria. Lanes run concurrently; integration via the state contract above.

| Lane | Sub-agent roles | Owns | Done when |
|---|---|---|---|
| **A. Data pipelines** | catalog-builder, TLE-fetcher, ADS-B-integrator | `data/*`, fetch+cache+fallback logic | all feeds green or gracefully degraded, licenses attributed |
| **B. AR & sensors** | orientation-engineer, permission-flow, manual-mode | camera, quaternion pipeline, iOS/Android quirks | fixed-case orientation tests pass; denial paths usable |
| **C. Rendering** | projection, glyph/label engine, telemetry | canvas overlay, hit-test | 60 fps at DPR 2 with 1,000 stars + 150 sats + 893 constellation vertices |
| **D. UX/system** | design-system, dock/tabs, accessibility | CSS, UI states, night mode | WCAG AA pass, reduced-motion honored |
| **E. QA & perf** | node-tests, browser-selftest, stress-harness | `tests/`, budgets | §8 budgets + §9 matrix green |
| **F. Ship/DevRel** | repo-steward, CI, docs | README, LICENSE, Actions, Pages, issues | public repo, Pages deploy, roadmap issues filed |

---

## 7. Phased roadmap

- **P0 — Research & de-risk (done).** CORS verified for CelesTrak + AvioADSB; star catalog validated against 5 known stars; SGP4 + ephemeris smoke-tested; library licenses cleared.
- **P1 — MVP AR core (shipped v0.1).** Camera + orientation overlay; stars/planets/Sun/Moon; manual mode; tap-to-identify; corner telemetry; night mode.
- **P2 — Live traffic (shipped v0.1).** Satellites (CelesTrak live + snapshot fallback) and aircraft (AvioADSB, callsign/alt/speed cards).
- **P2.5 — Catalog & events breadth (shipped v0.2).** Constellation figures + labels, Messier DSOs, Tonight engine, guidance chevron, layer chips, 4-tab dock.
- **P3 — Accuracy & delight.** ~~Constellation figures~~ (shipped v0.2), precession to of-date for stars, atmospheric refraction toggle, time scrubber, planet rise/set cards (shipped v0.2), label decluttering v2, moon terminator rendering.
- **P4 — Performance hardening.** Web Worker propagation pool; satellite.js v7 WASM evaluation; star catalog to mag 5.5 with LOD; `OffscreenCanvas` where supported; battery-saver mode (30 fps, 30 s polls).
- **P5 — Launch.** GitHub Pages deploy (one-click branch deploy; optional Actions workflow in `docs/` regenerates data per deploy); Lighthouse ≥ 95; README with live badge; roadmap filed as repo issues; announcement assets.
- **P6 — Post-launch.** PWA/offline shell; ISS-visible-tonight notifications (opt-in, local computation); shareable pointing URLs (`?az=&alt=&time=`); multi-language (constellation names already multilingual upstream); accessibility audit with real users.

**Exit criteria per phase** are the §8/§9 budgets and matrices that touch that phase's features; nothing ships red.

---

## 8. Optimization plan (budgets + how)

| Budget | Target | Mechanism |
|---|---|---|
| Time to first identified object | ≤ 3 s on 4G | zero-build static, total payload < 800 KB, stars parse < 50 ms |
| Render frame | ≤ 8 ms overlay @ DPR 2 | cached star unit vectors; per-frame trig only; no allocations in rAF loop |
| SGP4 propagation | ≤ 4 ms / 150 sats / tick | 1 Hz scheduler, not per-frame; measured 0.9 µs/sat/step on desktop node |
| Constellation+DSO pass | ≤ 8 ms / frame | single projector closure per frame (cached lst/lat terms) |
| ADS-B poll | 12 s fixed, backoff ×2 on error (max 120 s) | respects AvioADSB anonymous tier; UI shows feed age |
| TLE freshness | ≤ 2 h stale | localStorage cache + versioned snapshot fallback |
| Memory 30-min session | no growth > 10 MB | object pooling for propagation results; no per-frame closures |
| Battery | optional saver | 30 fps cap + 30 s polls + reduced DPR (P4) |

**Load order:** inline critical CSS → fonts (swap) → stars/constellation/DSO JSON fetch in parallel with camera/permission flow → TLE cache read (network refresh async) → first paint of sky even before camera grants (degraded but visible).

---

## 9. Edge & stress test matrix

| # | Case | Expected |
|---|---|---|
| E1 | iOS Safari: motion permission denied | Manual mode, compass ribbon hidden, no crash |
| E2 | Android Chrome: `deviceorientationabsolute` null α | fall back to relative α + compass hint |
| E3 | Camera denied/unavailable | dark-sky backdrop, overlay still fully functional |
| E4 | Geolocation denied | manual city picker (lat/lon entry), remembered locally |
| E5 | No sensors at all (desktop) | full Manual mode, drag-to-look, demo location |
| E6 | High latitude (φ = 89.9°) | no NaN, grid converges gracefully at zenith/nadir |
| E7 | Date line (λ = ±179.99°) | LST continuous, no azimuth flip |
| E8 | UTC midnight / month rollover during session | ephemeris step continuous, no flicker |
| E9 | TLE epoch in future / decayed satellite | propagate anyway, flag "TLE age" if > 10 days, skip NaN recs |
| E10 | Malformed TLE line | per-satellite try/catch, quarantine, count shown in feed health |
| E11 | CelesTrak down | snapshot fallback with staleness badge |
| E12 | AvioADSB 429/5xx/empty | backoff, "no aircraft in range" state, never spin |
| E13 | HTTPS absent (http://) | clear banner: sensors require secure context |
| E14 | Screen rotation mid-session | projection follows `screen.orientation.angle` |
| E15 | Compass accuracy poor (`webkitCompassAccuracy` > 20°) | figure-8 calibration hint, wide FOV tolerance |
| E16 | astronomy-engine + satellite.js both unreachable | stars/sats degrade independently; app never blanks (null-AE path tested) |
| S1 | 3,000-satellite propagation × 30 steps | < 2 s total (node), < 4 s (browser mid-tier) |
| S2 | 10,000-star synthetic render | ≥ 30 fps or LOD sheds |
| S3 | 89 constellations + 110 DSOs × 60 frames | < 8 ms/frame |
| S4 | 200 req/min ADS-B burst (simulated) | backoff engages, UI stays responsive |

**Current status:** E1–E15 covered by `test.html` (in-browser, `?auto=1` runs headless-friendly); S1 covered by `tests/node/run.mjs`; S2–S3 scripted in the browser harness.

---

## 10. Risk register

| Risk | L/I | Mitigation |
|---|---|---|
| CelesTrak/AvioADSB CORS policy changes | M/M | snapshot fallback; endpoint health surfaced in UI; swap list documented |
| iOS sensor behavior changes | M/H | permission flow isolated in `sensors.js`; manual parity maintained |
| Pages/Actions limits on free tier | L/L | static, < 1 MB; branch deploy needs no build minutes |
| License drift on data sources | L/M | quarterly license check item in P6; attribution centralized in About |
| SGP4 accuracy near decay | L/L | TLE-age flagging (E9); no safety-critical claims anywhere in UI |
| Vendor CDN fallback blocked (jsdelivr) | L/L | local-first loading; `vendor/README.md` documents offline setup |

---

## 11. Launch checklist & KPIs

**Checklist:** node suite green → browser selftest green (E1–E15) → Lighthouse ≥ 95 → README badges → Pages live → issues filed per P3–P6 → announcement.
**KPIs:** TTFF ≤ 3 s · 60 fps overlay on 2021 mid-tier Android · zero console errors on first run · 100% of denial paths usable · ≥ 95 Lighthouse.

---

## Appendix A — API endpoints (all CORS-verified 2026-10-03)
- TLE: `https://celestrak.org/NORAD/elements/gp.php?GROUP={stations|visual}&FORMAT=tle` (ACAO `*`)
- Aircraft: `https://avioadsb.org/v1/point/{lat}/{lon}/{radiusNm}` (ACAO `*`, anonymous tier 1 req/10 s, attribution "Data: AvioADSB (CC BY 4.0)")
- TLE backup API: `https://tle.ivanstanojevic.me/api/tle/{norad}` (ACAO `*`)

## Appendix B — Data schemas
- `data/stars.json`: `{epoch:"J2000", stars:[[raHours, decDeg, mag, name?], …]}` sorted by magnitude.
- `data/tle-snapshot.json`: `{fetchedAt, groups[], satellites:[{name,l1,l2}]}`.
- `data/constellations.json`: `[{id, name, label:[raH,dec], lines:[[[raH,dec],…],…]}]` (d3-celestial, BSD).
- `data/dsos.json`: `[{name, alt, type, ra, dec, mag, dim}]` (Messier; d3-celestial, BSD).
- ADS-B aircraft: `ac[]` with `lat, lon, alt_baro(ft), gs(kt), track, flight, hex, seen`.

## Appendix C — Repository map
```
index.html · test.html · css/style.css · js/{main,astro,sensors,sky,satellites,planes,render,ui,objects,events}.js
vendor/ (local-first libs with pinned-CDN fallback; gitignored) · data/*.json (committed; tools/build_data.py refreshes stars+TLEs)
tests/node/run.mjs · tools/build_data.py · docs/github-workflow-pages.yml · README.md · LICENSE
```
