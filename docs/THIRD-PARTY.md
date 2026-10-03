# Third-party sources and attribution

Reviewed 2026-10-03. Source code, adapted catalogues and external data retain their own licenses.

| Component | Source/version | Terms and treatment |
|---|---|---|
| Astronomy Engine | [2.1.19](https://github.com/cosinekitty/astronomy/tree/v2.1.19) | MIT, Don Cross. Full notice retained in vendor/astronomy.js. Same engine as the workbench. |
| satellite.js | [4.1.4](https://github.com/shashwatak/satellite-js/tree/4.1.4) | MIT; vendor/satellite-LICENSE.md retained. Import-path-only adaptation to native ESM. |
| Star catalogue | [HYG Database v4.1](https://github.com/astronexus/HYG-Database), [license](https://github.com/astronexus/HYG-Database/blob/main/LICENSE) | **CC BY-SA 4.0**, David Nash / Astronexus and underlying catalogue contributors. data/stars.json is a filtered, reordered derivative (1,023 stars, magnitude ≤4.6), distributed under the same CC BY-SA 4.0 terms. Earlier README wording “permissive” was incomplete. |
| Constellations and Messier data | [d3-celestial](https://github.com/ofrohn/d3-celestial), [license](https://github.com/ofrohn/d3-celestial/blob/master/LICENSE) | BSD-3-Clause, copyright 2015 Olaf Frohn. Adapted JSON; full license in data/d3-celestial-LICENSE.txt. |
| Orbital elements | [CelesTrak](https://celestrak.org/NORAD/elements/) | Source/time shown in Traffic. Supplied public elements are not an accuracy guarantee or a blanket license assertion. Cached/snapshot data can become stale; >7 days from element epoch suppressed. |
| Aircraft | [AvioADSB](https://avioadsb.org/) | CC BY 4.0 as advertised by existing integration. Attribution displayed; explicitly enabled request sends rounded coordinates. Community data, not navigation. |

No proprietary application assets or code are copied. Stellarium, Sky Guide, Sky Tonight, Star Walk and SkySafari inform workflows only. Swiss Ephemeris, Skyfield and Stellarium Web Engine were researched and are not bundled. No remote font request is needed in the revised UI.
