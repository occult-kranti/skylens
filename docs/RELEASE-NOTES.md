# Camera-first release — 0.3.0

- Persistent Enable/Cancel/Stop/Retry camera; direct gesture motion permission; cleanup on pagehide/background/revocation; explicit manual fallback.
- Calibrated sensor basis, source-aware heading feedback, estimated diagonal lensFOV with cover-crop compensation, smoothing, front lens convention, collision-managed labels and guidance.
- Search named stars, planets and Messier objects, including below horizon; save favorites and observation notes; current/simulatedUTC visible; return to now; persisted location/settings.
- Shared precession/nutation across fixed catalogues,1Hz sky cache, nonblocking optional satellite data, aircraft off until explicitly enabled; honest data-sharing/freshness text.
- Correct morning/evening planets, precise astronomical twilight search, upper transit times, UTC event dates; lazy heliocentric solar-system diagram/table with units and scale disclosure.
- Local pinned MIT dependencies and corrected HYG CC BY-SA attribution. Accessible native dialog/tabs, named controls, keyboard exploration, focus states and unlocked zoom.
- Links preserve the mature companion astrology application rather than copying its calculators. New companion calendar/natal improvements have their own roadmap and test evidence.

Full Node and real mobile/desktop Chromium gates passed; screenshot findings were repaired and rechecked before PR #5 merged. See VERIFICATION.md for commit/workflow/deployment evidence. Physical alignment and assistive-technology checks remain pending.

Publishing status: implementation is merged; first-time SkyLens Pages creation is blocked by GitHub administration permissions. See VERIFICATION.md for the exact error and the single setup step. The companion Workbench release is live.
