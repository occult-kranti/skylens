# Third-party sources and attribution

Reviewed 2026-10-05. Source code, adapted catalogues and external data retain their own licenses.

| Component | Source/version | Terms and treatment |
|---|---|---|
| Astronomy Engine | [2.1.19](https://github.com/cosinekitty/astronomy/tree/v2.1.19) | MIT, Don Cross. Full notice retained in vendor/astronomy.js. Same engine as the workbench. |
| satellite.js | [7.1.0](https://github.com/shashwatak/satellite-js/tree/v7.1.0) | MIT; vendor/satellite-LICENSE.md retained. TypeScript erased and explicit native-ESM imports; upstream source/blob/output hashes in vendor/satellite/upstream.json; optional WASM excluded. |
| Star catalogue | [HYG Database v4.1](https://github.com/astronexus/HYG-Database), [license](https://github.com/astronexus/HYG-Database/blob/main/LICENSE) | **CC BY-SA 4.0**, David Nash / Astronexus and underlying catalogue contributors. data/stars.json is a filtered, reordered derivative (1,023 stars, magnitude ≤4.6), distributed under the same CC BY-SA 4.0 terms. Earlier README wording “permissive” was incomplete. |
| Constellations and Messier data | [d3-celestial](https://github.com/ofrohn/d3-celestial), [license](https://github.com/ofrohn/d3-celestial/blob/master/LICENSE) | BSD-3-Clause, copyright 2015 Olaf Frohn. Adapted JSON; full license in data/d3-celestial-LICENSE.txt. |
| Orbital elements | [CelesTrak](https://celestrak.org/NORAD/elements/) | Source/time shown in Tools. Supplied public elements are not an accuracy guarantee or a blanket license assertion. Cached/snapshot data can become stale; >7 days from element epoch suppressed. |
| Aircraft | [AvioADSB](https://avioadsb.org/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) per the [current API documentation](https://avioadsb.org/docs/api), reviewed 2026-10-05; anonymous service is personal/education/research use, commercial access by agreement. Provider and licence attribution displayed; explicitly enabled request sends rounded coordinates. Community data, not navigation. |

No proprietary application assets or code are copied. Stellarium, Sky Guide, Sky Tonight, Star Walk and SkySafari inform workflows only. Swiss Ephemeris, Skyfield and Stellarium Web Engine were researched and are not bundled. No remote font request is needed in the revised UI.

Hindi labels use original editorial transliterations and limited source-supported aliases; see [naming sources and provenance](hindi-names.md). All 88 IAU identities are preserved, with distinct drawing anchors for the two Serpens sections. No third-party illustrated constellation artwork was added.

| Additional component | Source | Terms |
|---|---|---|
| Optional aircraft alternate | [adsb.fi official API/terms](https://github.com/adsbfi/opendata/blob/main/README.md) | Personal, noncommercial access with attribution/link required; no blanket open-data licence asserted. User-selected, consented separately, no automatic fallback. Current browser availability unverified. |

Only satellite.js and existing Astronomy Engine are bundled calculation dependencies; aircraft geometry and motion estimation are original local code. readsb/tar1090 were researched, not copied or bundled. See [provider matrix](aircraft-nearby-sources.md).
