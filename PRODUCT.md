# SkyLens

SkyLens is a browser sky instrument for finding and learning about real celestial objects. Its primary task is to point a phone and understand the sky, with either a rendered sky or an optional local camera preview. The separate Astrology Workbench owns charts and calendar calculators.

Audience: curious observers using portrait phones outdoors, with desktop/manual exploration and accessible object lists as equal fallbacks. The observer's place, selected UTC time and sensor uncertainty affect every result and must remain understandable.

Product truth: Astronomy Engine and the bundled catalogues compute positions; device orientation aims the viewport. This is not image recognition. Hindi and English names share the same object identities. Camera frames remain on the device; optional aircraft requests disclose coordinate sharing. Public feed coverage, freshness and quotas are bounded.

Interaction: Auto AR means following phone direction. Motion and camera have separate permission/lifecycle ownership. Turning camera off does not turn tracking off. Manual drag/keyboard is always recoverable; denied, absent or silent sensors never fabricate alignment. Initial motion permission begins from a user gesture; authorized session tracking may resume after backgrounding without restarting video.

Preserve existing calculations, source/method disclosures, object search/favorites/notes, saved locations, time exploration, real orbit diagrams, night palette and companion links. Keep the static ES-module/Canvas architecture and GitHub Pages hosting. Do not add a framework, mandatory paid API, remote font or decorative scientific data.

Pre-redesign production baseline: https://occult-kranti.github.io/skylens/ at 9480f5df4e52edbdd40f266f4d07087c80e81248, verified October 5, 2026. Visual authority for the runtime is the matching CI screenshot set 37329169672; subsequent changes only recorded deployment in Markdown. The implemented visual direction is specified in DESIGN.md; final release evidence is linked from docs/2026-10-05-auto-ar-roadmap.md.
