# Pinned local calculation engines

The static release includes these sources, so deterministic calculations do not require a CDN or npm installation. No mandatory paid API is used.

* `astronomy.js`: Astronomy Engine 2.1.19, MIT, Don Cross. Exact upstream Git blob `6b73063bbc90bafe1ad9a712cfd9e9b958a54d60`, [source](https://github.com/cosinekitty/astronomy/blob/v2.1.19/source/js/esm/astronomy.js). Reused from the existing Astrology Workbench and verified against that upstream blob. License retained in the header. 412,025 uncompressed bytes; shared module loading deduplicates it across sky, events and orbits.
* `satellite/` and `satellite.esm.js`: satellite.js 4.1.4, MIT. [Pinned source tree](https://github.com/shashwatak/satellite-js/tree/4.1.4/src), commit `3c1efc0cee5197ea5a28b35a993cbf24354ebc1e`. Only extensionless relative import specifiers were given `.js` extensions for native browser ESM. `satellite-LICENSE.md` retains the copyright/license. No algorithms changed. Keep the existing version for this repair; 7.x/OMM migration requires separate propagation fixtures and delivery testing.

Live satellite/aircraft data is optional and has separate freshness, privacy and availability constraints. This release does not promise completely offline first navigation; it works from any static host with these files available.
