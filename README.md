# SkyLens

**Point your phone at the sky. Name every star, satellite and plane.**

A zero-build, fully client-side, open-source AR sky tracker that runs in the browser — no install, no account, no backend. Camera + compass + gyroscope overlay of stars (HYG catalog), constellations, Messier deep-sky objects, Sun/Moon/planets, satellites (live CelesTrak TLEs, SGP4) and aircraft (live ADS-B).

**Features:** AR camera overlay with tap-to-identify · 1,023 stars + 89 constellation figures + all 110 Messier objects · planet rise/set/magnitude/visibility, moon phases, sun & astro-darkness times, meteor showers (Tonight tab) · live satellites & aircraft with a "Guide me ▸" chevron that points you at any object · manual mode (drag/arrow keys) for desktop · night-vision red mode · layer chips for one-tap filtering · in-browser diagnostics page (`test.html?auto=1`) + node test suite (36 checks).

## Run it

Any static file server works (ES modules need HTTP, not `file://`):

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Open on a phone over HTTPS for full AR (camera + motion sensors require a secure context). On desktop or without sensors, **Manual mode** gives the full sky — drag to look around, arrow keys work too.

## Deploy (GitHub Pages)

**Option A — one click, no CI:** Settings → Pages → Source: **"Deploy from a branch"** → `main` / `(root)`. The repo is self-contained (`data/*.json` committed), so the site goes live immediately at `https://<you>.github.io/skylens/`.

**Option B — Actions (fresh TLEs baked into every deploy):** copy `docs/github-workflow-pages.yml` to `.github/workflows/pages.yml`, then Settings → Pages → Source: **"GitHub Actions"**. The workflow runs `tools/build_data.py` on each push, regenerating the star catalog and TLE snapshot from upstream.

## Vendor libraries

Large third-party JS is **not committed** — the app loads it local-first with a pinned-CDN fallback:

| File | Package | License |
|---|---|---|
| `vendor/astronomy.js` | astronomy-engine 2.1.19 | MIT |
| `vendor/satellite.min.js` | satellite.js 4.1.4 | MIT |

For fully-offline local dev: `npm pack astronomy-engine@2.1.19 satellite.js@4.1.4`, then copy `esm/astronomy.js` → `vendor/astronomy.js` and `dist/satellite.min.js` → `vendor/satellite.min.js` (the ESM build `dist/satellite.es.js` → `vendor/satellite.esm.js` is needed for the node test suite).

## Data files

`data/*.json` are committed (so branch-based Pages "just works") and can be regenerated any time with `python3 tools/build_data.py` — the optional Actions workflow (Option B) does this on every deploy for fresh TLEs. Constellation/DSO data comes from d3-celestial (see below).

## Data sources & licenses

| Data | Source | License |
|---|---|---|
| Star positions (1,023 stars ≤ mag 4.6, J2000) | [HYG Database v4.1](https://github.com/astronexus/HYG-Database) | permissive |
| Constellation figures + Messier objects | [d3-celestial](https://github.com/ofrohn/d3-celestial) data | BSD, © Olaf Frohn |
| Satellite TLEs (live) | [CelesTrak](https://celestrak.org) `gp.php` | public data |
| Satellite TLEs (offline snapshot) | bundled `data/tle-snapshot.json` | public data |
| Aircraft | [AvioADSB](https://avioadsb.org) | **CC BY 4.0** — attribution shown in-app |
| Planets / Sun / Moon / events | astronomy-engine | MIT |
| SGP4 propagation | satellite.js | MIT |
| Fonts | Inter, Fira Code | OFL |

ADS-B data is a best-effort community feed — **never for navigation or safety-critical use**.

## Testing

```bash
node tests/node/run.mjs        # 36 checks: math vs astronomy-engine oracle, SGP4, events, edge cases, stress
# browser: open /test.html?auto=1  → functional + edge + stress report (title = PASS/FAIL)
```

Edge/stress matrix: see `SkyLens-Roadmap.md` §9 (sensor denial, iOS permission flow, poles/dateline, stale/malformed TLEs, API backoff, 3k-sat propagation, 10k-star render).

## URL parameters

`?manual=1` skip AR prompt · `?nointro=1` skip straight in · `?lat=…&lon=…` override location · `?fov=75` field of view · `?dock=tonight` open a dock panel

## Stack

Vanilla ES modules + Canvas 2D. No framework, no bundler. Design system: full-bleed camera, corner telemetry, layer chips, glass inspector dock, red-shifted night-vision mode. See `SkyLens-Roadmap.md` for the full product/technical plan (advisory review, phases P0–P6, perf budgets).
