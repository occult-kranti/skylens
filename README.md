# SkyLens

A camera-first, sensor-based sky overlay with a manual sky explorer. Camera frames stay on the device. Labels are calculated from your location, time and phone orientation; this is **not image recognition**.

## Use the app

Enable camera, choose your location, and point toward the sky. Use **Align** to correct heading and pitch and estimate your camera’s diagonal field of view. Phone compasses are imperfect: magnetic north, local interference and browser sensor conventions affect alignment. Manual drag, keyboard arrows and object search remain available without hardware permissions.

* **Sky:** named-object search, planets, 1,023 catalogue stars, 89 constellation figures, 110 Messier objects, filters and directional guidance.
* **Explore:** selected UTC time, return to now, rise/set/transit, Moon phases, astronomical darkness, annual meteor reference dates and a heliocentric solar-system diagram with linear distance scale.
* **Saved:** favorites and observation notes stored in this browser.
* **Settings:** saved location, night palette, magnitude, alignment and optional feeds. The initial New York demo location is explicitly labeled; GPS is requested only when chosen.
* **Charts & calendars:** connected links to the separate [Astrology Workbench](https://occult-kranti.github.io/astrology-sim-ant/), preserving its existing natal, transit, synastry, Vedic and historical tools.

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
* [Camera methods and phone checklist](docs/camera-methods.md), [calculation methods](docs/CALCULATIONS.md)
* [Licenses and attribution](docs/THIRD-PARTY.md), [performance](docs/performance.md), [verification](docs/VERIFICATION.md)

Catalogue star coordinates are J2000 rotated with precession/nutation; proper-motion propagation is not included. Astronomy Engine 2.1.19 supplies planetary positions and events; satellite.js 4.1.4 supplies SGP4. The interactive time range is 1900–2100, not a blanket precision guarantee for every object or device. Physical iOS/Android alignment and screen-reader testing remain separate release checks.

## Hindi names and mobile observing

Settings → Object names offers हिन्दी + English (default), हिन्दी, or English. Search accepts English, Hindi and reviewed Romanized aliases. Hindi planet names and42 curated star labels are available; names outside that curated set keep their original catalogue spelling. Traditional aliases and transliterations are identified in object details. See[the naming sources](docs/hindi-names.md).

Explore separates Tonight and Solar system views. Select a supported object for next rise/set/upper-transit times at the selected UTC instant/location. Settings can save up to12 named observing locations; Saved reuses/removes them. Tools opens the existing Workbench calculators and optional live-feed controls. The[October5 milestone](docs/2026-10-05-hindi-mobile.md) records implementation and verification; first-time Pages administration remains a separate publishing gate.
