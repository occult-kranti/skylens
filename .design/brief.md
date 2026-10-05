# Surface brief: SkyLens observing view

Date: 2026-10-05. Requested work: independent Auto AR with camera optional, plus cohesive interface redesign. Mode: Operate. Design direction and component rules: ../DESIGN.md.

## User and task

A person outdoors wants to point a phone and learn what lies in that direction. Camera access may be unavailable or unnecessary. A second user explores on a desktop with search and manual navigation. Both need trustworthy time/location, readable real calculations, sensor quality, and a clear fallback.

## Invariants

Keep local ES modules and Canvas2D, all existing catalog/calculation APIs, stable DOM IDs where possible, Hindi controls, saved objects/locations/notes, Explore/Solar, Workbench links, feed consent, source methods, night palette and keyboard paths. Camera frames stay local. AR means sensor projection, not image recognition.

## Acceptance

1. Auto AR can be started/stopped/cancelled without requesting camera; camera can start/stop independently.
2. The interface distinguishes off, requesting, waiting, tracking, stale, denied, unsupported, paused and error states, with accessible text and manual fallback.
3. Auto AR, camera, search, alignment and Hindi control remain reachable at320px, landscape and desktop; the tool sheet and selected object never cover them.
4. Existing Hindi, date/time, location, feed, favorites, event and navigation journeys remain valid. No external request is introduced by opening a screen.
5. All primary controls have44px targets; form fields retain16px narrow-screen text; keyboard/focus paths and200% reflow are exercised.
6. Batched screenshots use real integrated CI output; physical alignment and screen-reader coverage remain separate.

## Source evidence

Incumbent screenshots: /workspace/sky-ci-37329169672, corresponding shipped Hindi-toggle release. Existing docs/product-brief.md and current HTML/CSS/UI modules supplied product context. Main Impeccable skill and Design Partner foundations, accessibility, modes and verification references informed the design. Impeccable launcher and extra playbooks were unavailable earlier in the session; no retry or invented guidance is used.

## Ownership

UI lane owns index.html, css/style.css, js/ui.js and this design context. Lead owns application state/camera integration, sensor lane owns tracking lifecycle, graphics lane owns renderer, browser lane owns journey evidence. UI must not infer successful permissions or measured heading accuracy.
