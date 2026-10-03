# Measured performance — 2026-10-03

Measurements below were collected in the managed Linux execution container, Node v24.19.0. They are CPU computation measurements, not phone FPS, camera latency, browser paint or network-load measurements. No physical device was available.

## Fixed-sky work moved off the frame loop

Baseline: source from upstream `335b1be90e7531a7d7b548d2efd406861ebcb28b`, recovered as local snapshot `3fefd7380ca35ef80f8c6caf9f47a5b7890159a3`. Original `main.js` called stars, constellation figures and Messier-coordinate conversion from every animation frame. New code computes a snapshot at one-second cadence; sensor attitude/projection continue on the animation loop. Date/location/refraction changes invalidate the snapshot immediately. Hidden documents stop timers, animation, camera, motion and optional aircraft polling.

Dataset: 1,023 bundled stars, 89 constellation figures, 110 Messier objects. Observer 51.5°N, 0.1°W. Time starts 2026-10-03 21:00:00 UTC. Workload advances 3,600 synthetic frames over 60 simulated seconds (60 Hz). Each old frame recalculates catalogue coordinates; each new frame reads a cache, whose keys cause exactly 60 calculations. Both paths perform the same public catalogue operations and default horizon/magnitude filtering. New calculations also rotate the J2000 catalogue into the horizon of the selected date using Astronomy Engine, which the old calculations omitted.

Method: 100 warmup passes; seven paired rounds; `performance.now()` elapsed measurement. No DOM, canvas, camera, feeds or planetary/event computations included. Rounds execute synchronously rather than waiting 60 real seconds.

| Round | Baseline catalogue CPU work, ms | New cache + catalogue CPU work, ms | New calculations |
|---|---:|---:|---:|
| 1 | 994.825 | 47.241 | 60 |
| 2 | 902.322 | 42.695 | 60 |
| 3 | 849.948 | 43.307 | 60 |
| 4 | 855.402 | 36.516 | 60 |
| 5 | 839.353 | 38.282 | 60 |
| 6 | 866.687 | 44.467 | 60 |
| 7 | 869.876 | 36.586 | 60 |
| Median | **866.687** | **42.695** | **60 vs 3,600** |

This workload uses about 95.1% less catalogue-calculation CPU time. It does **not** establish a 95% improvement in total application speed, battery life or FPS. An isolated catalogue pass increased from median 0.277 ms to 0.561 ms because it now handles precession/nutation and richer searchable records. The measured benefit comes from the reduced update frequency, not faster ephemeris math. At 1 Hz, maximum coordinate-cache age is approximately one second during normal foreground operation; orientation remains current. Static sky motion in one second is about 15 arcseconds at the celestial equator, much smaller than typical phone-heading uncertainty. Satellite propagation separately remains at 1 Hz; aircraft retains its source-limited polling rate.

## Reproduction

Create separate copies of the baseline and current modules, supply the same local catalogues, and import both `sky.js` / `objects.js` versions in Node. The old sky adapter requires `globalThis.window={__aeReady:Promise.resolve(null)}` for this fixed-star-only benchmark. Stub `fetch` to read the same local JSON files; load all three catalogues before timing. Await the current `engineReady`. For each simulated frame, call the old `visibleStars(date,51.5,-0.1,4.6)`, `constellationFrame(date,51.5,-0.1)`, and `dsoFrame(date,51.5,-0.1)`. Wrap the same current operations in exported `createSkyCache` from `main.js`, then invoke `.get(date,{lat:51.5,lon:-0.1},{magLimit:4.6,refraction:false})`. Advance dates by `frame*1000/60` milliseconds. Repeat the warmup/round counts above and report medians. `tests/integration.mjs` separately asserts exactly one computation for 60 frames inside one second and immediate input invalidation.

## Baseline source transfer sizes

These are Python `gzip.compress` results on newline-concatenated resources; actual HTTP resources are compressed individually. They exclude runtime vendor modules, fonts and feeds, so they are not an initial page-load bundle metric.

| Baseline group | Raw bytes | Combined gzip bytes |
|---|---:|---:|
| index.html + style.css | 20,768 | 6,179 |
| Ten application JS modules | 58,309 | 18,926 |
| Four catalogue JSON files | 95,253 | 36,385 |
| All 27 upstream tracked files | 229,074 | not measured |

The release adds local pinned vendor files, which increases tracked bytes but removes missing-local-file requests and CDN dependency for core calculations. That is a reliability change; no measured first-load speedup is claimed. The final release inventory records resulting bundle sizes separately.

## Still requiring browser/device measurement

Main-thread frame duration, label-layout cost on mobile, memory across camera restarts, camera crop/alignment, sensor lag, network waterfalls, initial paint and battery behavior need representative browsers/phones. Automated lifecycle tests prove resource ownership in their mocked conditions; they do not certify physical camera alignment or a real-device FPS budget.

## Final static resource inventory

2026-10-03, exact release candidate sources. Raw bytes and sum of individually gzip-compressed files (Python gzip.compress; not an HTTP waterfall): HTML+CSS28,563/8,947;11 applicationJS modules95,002/33,909;18 locally included engine modules501,346/135,614;4 catalogue JSON files95,250/36,146. Orbit is dynamically loaded on Explore; satellite source is local, and core startup performs no CDN/font fetch. These sizes do not establish first-paint or network performance. The baseline group gzip figures above combined files and therefore are not a directly comparable transfer metric.
