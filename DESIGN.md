# SkyLens design system

Updated 2026-10-05 for the independent Auto AR and camera release. Surface mode: **Operate**, with the calculated sky as the main artifact.

## Direction: the portable observatory

The product is an observing instrument, not a recognition camera or a decorative space dashboard. A generous, scientifically positioned sky sits behind a compact console. A person can follow phone movement with or without video, see the state of both capabilities, and return to manual exploration. The lens, selected UTC time, observer and alignment quality remain explicit.

The existing catalogs, calculations, saved inputs, Hindi names, tools, methods, and sensor limitations remain product truth. No generated scientific imagery, speculative metrics, external fonts, frameworks, or mandatory services are added.

## Composition

- **Sky context:** quiet top header, product wordmark, selected time and observer. The renderer owns real horizon/cardinal marks and selection reticle.
- **Action console:** primary Auto AR, independent camera button. Search, Align, and Hindi names form a secondary row. Pressed and requesting states remain visible and cancellable.
- **State disclosure:** short tracking and camera summary; expandable full explanations. Permission failures and stale/unsupported conditions expose the explanation automatically. Simulated time stays visible with Return to now.
- **Tools:** existing Sky, Explore, Tools, Saved, Settings tabs inside a scrollable bottom sheet on phones and right sidebar on wider displays. Opening tools does not enable external feeds.
- **Selected object:** compact facts and real events, with a clear close action. Portrait uses remaining height above the console; wide layouts place it to the left. A measured CSS size variable prevents fixed-surface overlap.

## Visual system

Use the system sans-serif stack with Devanagari fallbacks for names and prose. Monospace is reserved for celestial coordinates, UTC and instrument telemetry. Body copy is 14–15px; narrow form inputs are at least16px. Labels wrap without splitting a grapheme. Titles use weight and spacing, not giant lettering.

Palette roles: near-black sky, solid blue-black console, elevated inset controls, off-white primary text, cool readable secondary text, #71d0ff interactive blue, #ffca80 simulation/selection amber. Night mode uses muted red surfaces and #ff9b87 actions; no blue or green accent is introduced there. Strong fill belongs to the primary action and active state, not every object row.

Use 4/8/12/16/24px spacing, 8px controls, 14–18px container radii, thin grouping rules, restrained shadows. No blur, generic gradient cards, decorative numerical telemetry, or empty ornament. Touch controls are at least44px. Hover, focus, pressed, pending, error and disabled states are explicit.

## Interaction invariants

Auto AR follows orientation; camera chooses the background. Stopping camera does not stop tracking. Auto AR off means manual drag/keyboard sky. A saved preference cannot silently grant a permission. Simulated time is independent from tracking, and live feeds retain their existing restrictions.

Hindi visibility uses the established persisted nameMode. Settings and the direct control synchronize; changing names does not change coordinates or restart event calculations. Search remains multilingual when names are hidden.

## Responsive and accessibility rules

Portrait: bottom console and scrollable tool sheet, with the central sky unobstructed when closed. Landscape/desktop: right console, left object inspector. Dynamic viewport units, safe-area insets, and measured console/header heights bound scrollable surfaces. At320px and200% reflow, rows wrap and content scrolls locally. Retain native buttons, dialog and tab keyboard semantics, focus restoration, reduced-motion handling, 16px mobile inputs, visible outlines and readable solid camera scrims.

Screenshots, touch-target checks, keyboard flow and browser mocks are release evidence, not proof of physical sensor alignment or screen-reader conformance. Perform one batched integrated visual review across four viewports and one repair confirmation.
