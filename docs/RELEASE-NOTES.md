# Hindi names, mobile observing and tracking — 2026-10-05

- Default Hindi + English naming, optional Hindi/English modes, mixed-script search, 42 named stars and all 88 IAU constellations (89 catalogue parts). Original IDs and astronomical positions remain language-independent.
- Search/save/guide to constellation drawing anchors; separate anchors correct inherited Serpens Caput/Cauda duplication. The HYG solar-origin row is excluded without shifting saved-star IDs.
- Selected-object next rise/set/transit for Sun, Moon, planets and named catalogue stars, with UTC/location snapshots and independent USNO reference checks.
- Mobile Explore splits Tonight and Solar system; Tools links the existing Workbench and explains local calculations versus optional feeds. Save, reuse and remove up to 12 named observing locations. Mixed-script orbit labels reserve markers/scale labels and use leaders.
- Satellite status discloses source, partial groups, fetch time, epochs and retry time; two-hour attempts/caches survive reload, errors stop remaining requests and cancellation prevents late writes.
- Aircraft uses truthful combined position age, expires stale reports, separates receipt/provider/position timestamps and stops at quota. No private key, paid account or new data recipient was added.
- README includes concrete Pages administrator, device, Hindi/accessibility and optional provider-account actions. [API delivery](tracking-apis.md) has actual Chromium evidence and explicitly bounded coverage.

Calculation engines remain Astronomy Engine 2.1.19 and satellite.js 4.1.4. Sky projection is sensor-based; physical-phone and screen-reader validation remain pending. Current CI/merge/publication evidence is linked from [PR #6](https://github.com/occult-kranti/skylens/pull/6); Pages is live after successful run 37329557778 attempt 2; first-time administrator setup is resolved.

# Camera-first release — 0.3.0

- Persistent Enable/Cancel/Stop/Retry camera; direct gesture motion permission; cleanup on pagehide/background/revocation; explicit manual fallback.
- Calibrated sensor basis, source-aware heading feedback, estimated diagonal lensFOV with cover-crop compensation, smoothing, front lens convention, collision-managed labels and guidance.
- Search named stars, planets and Messier objects, including below horizon; save favorites and observation notes; current/simulatedUTC visible; return to now; persisted location/settings.
- Shared precession/nutation across fixed catalogues,1Hz sky cache, nonblocking optional satellite data, aircraft off until explicitly enabled; honest data-sharing/freshness text.
- Correct morning/evening planets, precise astronomical twilight search, upper transit times, UTC event dates; lazy heliocentric solar-system diagram/table with units and scale disclosure.
- Local pinned MIT dependencies and corrected HYG CC BY-SA attribution. Accessible native dialog/tabs, named controls, keyboard exploration, focus states and unlocked zoom.
- Links preserve the mature companion astrology application rather than copying its calculators. New companion calendar/natal improvements have their own roadmap and test evidence.

Full Node and real mobile/desktop Chromium gates passed; screenshot findings were repaired and rechecked before PR #5 merged. See VERIFICATION.md for commit/workflow/deployment evidence. Physical alignment and assistive-technology checks remain pending.

Publishing status: both applications are live. SkyLens first-time setup was initially blocked by administration permissions, then resolved on October 5; see VERIFICATION.md for the successful deployment evidence.
