# Hindi names and mobile continuation — 2026-10-05

Owning application: occult-kranti/skylens. Preserve the existing camera/sensor/calculation architecture, stable catalogue IDs, and the separate astrology Workbench. This milestone begins from local release snapshot ec335ab; remote main is independently checked before publication. No unrelated user edits were present.

## Brief and decisions

The user can identify stars and planets by Hindi or English names, choose the displayed naming mode, and complete observing tasks on narrow portrait and short landscape phones. Bilingual naming is the default; it is not a claim to translate the entire application. Traditional star aliases require sources and must not equate an entire nakshatra/asterism with a single star. Unsupported catalogue names retain English rather than invented translations.

Next roadmap objectives: a focused selected-object observing screen with real next-rise/set/transit calculations; explicit Tonight/Solar-system sections; a compact route to existing chart/calendar tools; reusable named observing locations. These build on existing calculations and saved-object workflows. Keep camera access and manual fallback prominent. No new rendering framework or paid API.

## Bounded work and acceptance

| ID / priority | Owner and files | Expected behavior / approach | Verification | Status |
|---|---|---|---|---|
| H1 P1 | Research agent; names.js, names tests/docs | Source-backed Hindi planet/star names, romanized aliases, bilingual/en/hi formatting; stable English IDs and no invented asterism equivalence | Mapping/source review, Unicode search tests, fallback cases | Implemented; 9 naming groups passed |
| H2 P1 | Lead; main/sky/render/orbits | Shared naming mode applied to labels, search, guidance and solar system; cached calculation IDs remain unchanged | Existing Node suite + language persistence/browser journey | Implemented; local checks passed; real browser gate pending |
| M1 P1 | UX agent; index/ui/css | Readable 320/390px portrait and 844px landscape, restrained overlays, touch controls, explicit Explore sections and real chart/calendar links | One batched mobile/desktop screenshot pass, one repair confirmation | Implemented; local checks passed; real browser gate pending |
| O1 P1 | Astronomy agent; observing.js + tests | Selected object's next rise/set/upper transit for selected UTC/location; no-event/polar states and methods shown | Independent/reference geometry, body/stellar and invalid-input cases | Implemented; local checks passed; real browser gate pending |
| S1 P2 | Lead+UX; preferences and Saved UI | Save/reuse/remove named locations locally, validate coordinates, handle corrupt/blocked storage, retain favorites | Node persistence tests + complete browser save/reload/use/remove journey | Implemented; local checks passed; real browser gate pending |
| Q1 P0 | Lead+release reviewer; browser/workflow/docs | Preserve all passing workflows and project paths; inspect artifacts and deploy tested branch | Node, strict Chromium tests, visual review, exact deployed SHA if Pages permits | Implemented; local checks passed; real browser gate pending |

## Release boundary

The previous SkyLens release could not create its first Pages site because GitHub required administrator setup. Recheck current state; do not infer that the setting has changed. Authorized push/merge/deploy remains in scope. Never call a local run deployed. Physical phone alignment and screen-reader checks stay distinct from browser mocks. Deferred broad regional calendars/plate solving retain their earlier documented reasons.

## Integrated implementation evidence

Remote mains were rechecked on 2026-10-05: SkyLens4e91d53e and Workbench1f40e697 had no changes since the prior release. Workbench remains live; SkyLens still returns not found and its latest deploy failed first-time Pages creation. This task modifies only SkyLens.

Implemented name coverage: 11 solar-system naming records (Earth used in the orbit view; Pluto metadata does not add a rendered object), 42 named catalogue stars, and reviewed Dhruva/Rohini/Ardra aliases. Other catalogue names remain English. Scientific object IDs and positions are independent of display mode. Source notes and editorial transliteration boundaries are in hindi-names.md.

New screens: Explore has separate Tonight/Solar system tabs; Tools links actual existing chart/calendar pages and folds optional feeds; selected objects show a UTC/location snapshot and bounded next events; Saved manages up to12 named locations plus existing favorites/notes. Narrow layouts stack bilingual names and metadata and wrap forms.

Full local `npm test` passed: 36 original cases, independent ephemeris/event fixtures, 26 camera cases, 13 integration cases, 9 naming groups and 14 observing cases. Node syntax, HTML ID/ARIA linkage and git whitespace checks passed. Independent review repaired a minute-cache boundary error and unavailable-event wording; see2026-10-05-review.md. The fixed HYG Sol origin row is excluded at load after IDs are assigned, preserving all existing saved-star IDs.

Runtime evidence is not yet claimed here. Local HTTP binding still fails EPERM, so mandatory Chromium CI journeys run beneath /skylens/ at320×568,390×844,844×390 and1365×900. CI installs a Devanagari fallback font for the Linux test runner only; the application uses local system fonts and makes no font-CDN request. Physical phone alignment and screen-reader checks remain pending.
