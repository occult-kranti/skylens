# SkyLens

A sensor-based sky instrument with Auto AR, an optional live camera backdrop and a manual sky explorer. Camera frames stay on the device. Labels are calculated from your location, time and phone orientation; this is **not image recognition**.

**Live application:** [https://occult-kranti.github.io/skylens/](https://occult-kranti.github.io/skylens/)

## Use the app

Choose your location, tap **Auto AR**, allow motion when requested, and point toward the sky. Tracking works with the camera off. Tap **Enable camera** for an optional live backdrop; stopping or losing video keeps requested Auto AR running. **Stop Auto AR**, dragging the sky or using arrow keys returns to manual exploration. Reloading never assumes a permission grant; returning from the background can resume previously allowed motion, but camera video always needs another tap.

Use **Align** to correct heading and pitch and estimate your camera’s diagonal field of view. Phone compasses are imperfect: magnetic north, local interference and browser sensor conventions affect alignment. A quiet sensor produces a visible warning while retaining the last full attitude. Manual drag, keyboard arrows and object search remain available without hardware permissions. The compact bottom console on phones becomes a side console on wide screens; expand its status row for tracking and camera explanations.

* **Sky:** named-object search, planets, 1,022 catalogue stars, 89 constellation figures, 110 Messier objects, filters and directional guidance.
* **Explore:** selected UTC time, return to now, rise/set/transit, Moon phases, astronomical darkness, annual meteor reference dates and a heliocentric solar-system diagram with linear distance scale.
* **Saved:** favorites and observation notes stored in this browser.
* **Settings:** saved location, night palette, magnitude, alignment and optional feeds. The initial New York demo location is explicitly labeled; GPS is requested only when chosen.
* **Charts & calendars:** connected links to the separate [Astrology Workbench](https://occult-kranti.github.io/astrology-sim-ant/), preserving its existing natal, transit, synastry, Vedic and historical tools.

**Observe → Cast:** open an object's details and choose **Cast this observation**, or use Tools → **Cast this sky moment**, to continue in Studio with a frozen UTC instant and observer. Hindi naming preference and constellation identity return with the snapshot. The explicit link uses a URL fragment: coordinates remain in browser history, while camera frames, permissions, notes and birth data stay out of the handoff. Imported snapshots start with camera, motion and optional feeds off. See [the handoff contract and validation](docs/sky-handoff.md). Publishing the receiving Studio adapter is a prerequisite for releasing these outgoing links.

Aircraft data is off until enabled and sends rounded observer coordinates to AvioADSB. Satellite data comes from CelesTrak or a timestamped cached/bundled snapshot. Elements more than seven days from the selected instant are omitted; even fresh elements are estimates. Neither feed is for navigation.

## Run and test

Vanilla ES modules, Canvas 2D and static JSON; no application build or npm installation required. Pinned local MIT engines are included.

```sh
python3 -m http.server 8000
npm test
```

Open `http://localhost:8000/`. Camera/motion need HTTPS or localhost and a supported browser. `?manual=1&lat=51.5&lon=0` opens a manual location; `?dock=tonight` opens Explore. Relative assets work at the GitHub Pages project path. `test.html?auto=1` runs browser diagnostics.

Browser release checks: install pinned Playwright 1.58.2 as a development tool, run `npx playwright install chromium`, then `node tests/browser.mjs`. CI runs Node and browser checks before Pages deployment; see `.github/workflows/pages.yml`. A successful local calculation test is not evidence of a live deployment or physical alignment.

## Methods and project evidence

* [Living roadmap](docs/2026-10-roadmap.md) and [product brief](docs/product-brief.md)
* [Repository baseline](docs/repository-baseline.md), [product research](docs/product-research.md), [calendar research](docs/calendar-research.md)
* [Camera methods and phone checklist](docs/camera-methods.md), [Auto AR lifecycle](docs/auto-ar-methods.md), [calculation methods](docs/CALCULATIONS.md)
* [Auto AR and design roadmap](docs/2026-10-05-auto-ar-roadmap.md), [design brief](DESIGN.md), [independent review](docs/2026-10-05-auto-ar-review.md)
* [Licenses and attribution](docs/THIRD-PARTY.md), [performance](docs/performance.md), [verification](docs/VERIFICATION.md)

Catalogue star coordinates are J2000 rotated with precession/nutation; proper-motion propagation is not included. Astronomy Engine 2.1.19 supplies planetary positions and events; satellite.js 4.1.4 supplies SGP4. The interactive time range is 1900–2100, not a blanket precision guarantee for every object or device. Physical iOS/Android alignment and screen-reader testing remain separate release checks.

## Hindi names and mobile observing

Use the Sky **Show Hindi / Hide Hindi** button to show or hide Hindi labels directly. The choice is remembered and stays in sync with Settings. Settings → Object names offers हिन्दी + English (default), हिन्दी, or English. Search accepts English, Hindi and reviewed Romanized aliases. Hindi planet names and 42 curated star labels are available; names outside that curated set keep their original catalogue spelling. Traditional aliases and transliterations are identified in object details. See [the naming sources](docs/hindi-names.md).

Explore separates Tonight and Solar system views. Select a supported object for next rise/set/upper-transit times at the selected UTC instant/location. Settings can save up to 12 named observing locations; Saved reuses/removes them. Tools opens the existing Workbench calculators and optional live-feed controls. The [October 5 milestone](docs/2026-10-05-hindi-mobile.md) records implementation and verification; GitHub Pages publication is verified; see the deployment record below.

## Human action checklist

This list distinguishes required setup from optional expansion. No account or API key is needed for the current locally calculated stars, planets, constellations, object events or solar-system view. The current satellite and aircraft feeds are public, but availability and quotas are outside this application's control. Never paste private tokens into source files, GitHub Pages assets or public issues.

- [x] **SkyLens Pages setup and first publication completed:** GitHub Actions is enabled as the Pages source. [Deployment attempt 2](https://github.com/occult-kranti/skylens/actions/runs/37329557778/attempts/2) succeeded on October 5, 2026, and the live release identity matched `367f6ee8b5ea63478e61f07e17860324ad3097bb`. The earlier administration error is resolved. Future main releases run the same verification and deployment workflow; [release.json](https://occult-kranti.github.io/skylens/release.json) records the published commit.
- [ ] **Recommended hosting cleanup — Workbench administrator:** choose GitHub Actions in [the companion Pages settings](https://github.com/occult-kranti/astrology-sim-ant/settings/pages) to stop its legacy branch publisher from competing with the validated workflow.
- [ ] **Required for a phone-alignment claim — device tester:** on iOS Safari and Android Chrome, test Auto AR both without video and while enabling/stopping camera, choose your actual location, calibrate against a known object, and test portrait/landscape, stationary intervals, front-camera fallback, denial/retry, background/resume and manual gestures. Record OS/browser and measured error using [the checklist](docs/camera-methods.md). Browser mocks do not complete this step.
- [ ] **Language/accessibility review — Hindi reader and assistive-technology tester:** review editorial transliterations and mixed-script pronunciation, large text, focus and screen-reader order. Supported aliases have sources; they are not a universal Indian sky-name standard.
- [ ] **Optional sustained aircraft tracking — project owner:** review [AvioADSB's current API terms](https://avioadsb.org/docs/api). Anonymous access needs no account but is limited to 100 requests/day per network and one request / 10 seconds; at the app's 12-second rate, a continuously enabled session can reach that daily allowance in about 20 minutes. The app pauses on quota responses. A higher allowance may require the provider's account/plan and a separately designed secure server integration. No account was created or plan purchased; GitHub Pages cannot safely hide a private API key.
- [ ] **Optional additional data — feature owner:** identify a provider, license, allowed browser/CORS use, rate limits and validation cases before adding weather, minor bodies or other feeds. NASA/JPL SSD APIs prohibit direct embedding under their published CORS policy; do not work around that restriction. The existing ISS source is CelesTrak station elements, propagated locally.

**Satellite setup:** CelesTrak stations/visual orbital elements need no API key. Data is checked no more often than every two hours; old elements are suppressed by the documented seven-day policy, and retrieval time is separate from element epoch. Tools → Optional satellites & aircraft exposes controls, status and manual checking. These feeds do not track every satellite or every aircraft.

**Constellation names:** all 88 IAU constellations (89 catalogue figure entries because Serpens has two parts) now have Hindi transliterations, English aliases and search. Details explain that guidance points to a label anchor, not a physical star or official boundary. Saptarshi, Pleiades and zodiac sectors are not silently treated as equivalent whole constellations.

Source, licensing, quota and actual browser-delivery evidence: [tracking APIs](docs/tracking-apis.md). The public feeds were browser-readable in the dated release diagnostic; this is not a promise of uninterrupted service or complete coverage.
