# vendor/

Third-party JS lives here **locally only** (gitignored — the repo stays text-only).

At runtime the app tries local files first, then falls back to pinned CDN URLs, so the GitHub Pages deployment works without these files committed.

To set up fully-offline local dev:

```bash
npm pack astronomy-engine@2.1.19 satellite.js@4.1.4
# astronomy-engine-2.1.19.tgz → package/esm/astronomy.js  → vendor/astronomy.js
# satellite.js-4.1.4.tgz      → package/dist/satellite.min.js → vendor/satellite.min.js
```

Both packages are MIT licensed.
