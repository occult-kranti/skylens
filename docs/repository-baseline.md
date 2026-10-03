# Repository and release baseline

Research date: 2026-10-03 UTC. This audit is read-only. Connector metadata and source files establish repository state; README claims about features are not treated as execution proof.

## Ownership and scope

The supplied `occult-kranti/astro-sim-ant` was reported 404 by the coordinating agent's connector inspection. The actual relevant repository is [occult-kranti/astrology-sim-ant](https://github.com/occult-kranti/astrology-sim-ant), repository ID 1279764019. It is separate from [occult-kranti/skylens](https://github.com/occult-kranti/skylens), ID 1402309348. Both are public and default to main.

- [SkyLens README](https://github.com/occult-kranti/skylens/blob/main/README.md) identifies a standalone zero-build browser AR sky tracker using vanilla modules and Canvas 2D. It owns camera/compass/gyroscope projection, manual drag/keyboard sky view, stars/constellations/Messier objects, Sun/Moon/planets, satellites, aircraft, search/guidance and Tonight. Main currently loads astronomy-engine 2.1.19 and satellite.js 4.1.4 through local-first/CDN fallback. Functional claims need independent local verification.
- [Astrology Workbench README](https://github.com/occult-kranti/astrology-sim-ant/blob/main/README.md) identifies an independent static historical study edition and calculation suite. It owns Western horary/nativity/dignity/planetary-hour tools; Vedic sidereal charts/Panchang/dashas/vargas; historical text tools and related oracles. Its astronomy-engine is vendored, with pure engine modules under assets/js/core and DOM logic under assets/js/app. Preserve this larger historical application when adding coherent navigation/calendars.
- [occult-kranti/astrology-sim](https://github.com/occult-kranti/astrology-sim), ID 1279763526, is also separate. README contains only “# astrology-sim”. Its complete 7-file tree at `6cff760fd970af71911bef4535ca6fbb6d7d71b5` contains Picatrix workbook .md/.xlsx, `picatrix_book1.html`, JS/Python engines, .nojekyll and README. It is related by subject, but there is no README evidence establishing it as Skylens or the active Workbench. Do not modify it in this scope without an integration need.

## skylens

- Repository: https://github.com/occult-kranti/skylens
- Default branch: `main`.
- Baseline default SHA: `335b1be90e7531a7d7b548d2efd406861ebcb28b`.
- Branches: `main` at `335b1be90e7531a7d7b548d2efd406861ebcb28b` (protected=false).
- Repository rulesets API: empty array.
- Open PRs: 0.
- Open issues: 4.

### Recent commits

- 2026-10-02T22:13:01Z: [`335b1be9`](https://github.com/occult-kranti/skylens/commit/335b1be90e7531a7d7b548d2efd406861ebcb28b) data: offline TLE snapshot (stations + visual, 173 satellites)
- 2026-10-02T22:07:45Z: [`66fb93b5`](https://github.com/occult-kranti/skylens/commit/66fb93b56421b986079a4d71057841644cd58be8) fix: star catalog join byte (Beid RA)
- 2026-10-02T22:02:27Z: [`46dfa7ca`](https://github.com/occult-kranti/skylens/commit/46dfa7cad24cd0e458523c53a6fb8bd692f6186e) data: star catalog (HYG v4.1, 1023 stars ≤ mag 4.6)
- 2026-10-02T21:50:56Z: [`2729cadc`](https://github.com/occult-kranti/skylens/commit/2729cadcb503d0a89cc95fdf76bd806dc513d1e8) v0.2: roadmap update (catalog breadth, tonight engine, guidance, new lanes/tests)
- 2026-10-02T21:49:42Z: [`84d5ce5a`](https://github.com/occult-kranti/skylens/commit/84d5ce5a3e463b1184f9f0c96cba1d9a0c83734e) v0.2: constellation figures data (d3-celestial, BSD)
- 2026-10-02T21:47:49Z: [`2820ac3d`](https://github.com/occult-kranti/skylens/commit/2820ac3d5367494bf35fac510ddee8ff1f439e58) v0.2: Messier deep-sky catalog data (d3-celestial, BSD)
- 2026-10-02T21:46:44Z: [`03c2b72f`](https://github.com/occult-kranti/skylens/commit/03c2b72f6ede046e1db7f42f194686f37f30d5a8) v0.2: node suite + README (features, data sources, deploy)
- 2026-10-02T21:45:32Z: [`857b4108`](https://github.com/occult-kranti/skylens/commit/857b410805aad42b9b4c1dcc3fbad009c9d88fb4) v0.2: diagnostics page extended (constellations, DSOs, tonight, stress S3)

### Open issues

- [#4 [P5] Launch: enable GitHub Pages, Lighthouse pass, announcement](https://github.com/occult-kranti/skylens/issues/4)
- [#3 [P6] Post-launch: PWA/offline, ISS notifications, shareable URLs, i18n, eclipses](https://github.com/occult-kranti/skylens/issues/3)
- [#2 [P4] Performance hardening: worker pool, WASM SGP4, LOD catalog, battery saver](https://github.com/occult-kranti/skylens/issues/2)
- [#1 [P3] Accuracy & delight: of-date precession, refraction toggle, time scrubber](https://github.com/occult-kranti/skylens/issues/1)

### Deployment runs

Actions API returned total_count=0; no workflow run exists at baseline.

## astrology-sim-ant

- Repository: https://github.com/occult-kranti/astrology-sim-ant
- Default branch: `main`.
- Baseline default SHA: `3a3ce9953e47a078e659723a52187648f1f08486`.
- Branches: `claude/kind-noether-b17h3i` at `03990f37ed4a8b0a8d89e987e221e4a9ae4601ea` (protected=false); `main` at `3a3ce9953e47a078e659723a52187648f1f08486` (protected=false).
- Repository rulesets API: empty array.
- Open PRs: 0.
- Open issues: 0.

### Recent commits

- 2026-08-02T02:46:53Z: [`3a3ce995`](https://github.com/occult-kranti/astrology-sim-ant/commit/3a3ce9953e47a078e659723a52187648f1f08486) docs+ui: the Vedic cell now says WHY it is empty, and master plan v3 is brought current
- 2026-08-02T02:35:59Z: [`7d88b3d1`](https://github.com/occult-kranti/astrology-sim-ant/commit/7d88b3d1d5b767e395e8441f8a2e21d27a546cac) research(vedic-materia): the sourced round — and the conflation risk is in the CELL, not the data
- 2026-08-02T00:03:22Z: [`76807249`](https://github.com/occult-kranti/astrology-sim-ant/commit/7680724971553a1f75ab6367aba964d3b3a7eca3) feat(vedic): the horā — a sourced convergence, not an inferred one
- 2026-08-01T23:48:15Z: [`c386a6fd`](https://github.com/occult-kranti/astrology-sim-ant/commit/c386a6fd434a3fe2f73359dd49ff6f19544d9b79) fix(opgraph): ship the inherited-witness cap — the cascade was a category error in my own fix
- 2026-08-01T21:44:13Z: [`cd49f9af`](https://github.com/occult-kranti/astrology-sim-ant/commit/cd49f9affe0fbafdb06563bdf7c7e195ca345139) fix(incense): aloes is not aloe vera · aloeswood is oud · the Vedic column, left honestly empty
- 2026-08-01T21:40:52Z: [`3f61cb3e`](https://github.com/occult-kranti/astrology-sim-ant/commit/3f61cb3ea65022317a6588219567d1e0010d4cce) docs(loop): two hypotheses for the cascade tested and killed — and where to look next
- 2026-08-01T21:06:49Z: [`3686efd4`](https://github.com/occult-kranti/astrology-sim-ant/commit/3686efd4fa4d4516f77fcfd37e6daeef8a83f6b3) feat(incense): the live hour — current time and place, bound to the CITED materia
- 2026-08-01T20:51:26Z: [`2eb36d28`](https://github.com/occult-kranti/astrology-sim-ant/commit/2eb36d286c496bbae9e6cb7268c10020b9ffd5d0) feat(incense): the two tables compared — and FRAMING §11, the documented-practice amendment

### Open issues

None returned.

### Deployment runs

- [Deploy to GitHub Pages 30729460682](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30729460682): completed/success, 2026-08-02T02:47:15Z, `3a3ce9953e47a078e659723a52187648f1f08486`, push.
- [pages build and deployment 30729460390](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30729460390): completed/success, 2026-08-02T02:47:19Z, `3a3ce9953e47a078e659723a52187648f1f08486`, dynamic.
- [Deploy to GitHub Pages 30729145424](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30729145424): completed/success, 2026-08-02T02:36:19Z, `7d88b3d1d5b767e395e8441f8a2e21d27a546cac`, push.
- [pages build and deployment 30729145280](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30729145280): completed/success, 2026-08-02T02:36:33Z, `7d88b3d1d5b767e395e8441f8a2e21d27a546cac`, dynamic.
- [Deploy to GitHub Pages 30724512326](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30724512326): completed/success, 2026-08-02T00:03:49Z, `7680724971553a1f75ab6367aba964d3b3a7eca3`, push.
- [pages build and deployment 30724511994](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30724511994): completed/success, 2026-08-02T00:03:49Z, `7680724971553a1f75ab6367aba964d3b3a7eca3`, dynamic.
- [Deploy to GitHub Pages 30724052242](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30724052242): completed/success, 2026-08-01T23:49:15Z, `c386a6fd434a3fe2f73359dd49ff6f19544d9b79`, push.
- [pages build and deployment 30724051772](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30724051772): completed/success, 2026-08-01T23:49:15Z, `c386a6fd434a3fe2f73359dd49ff6f19544d9b79`, dynamic.

## Deployment evidence and configuration findings

### Astrology Workbench

The checked workflow [pages.yml](https://github.com/occult-kranti/astrology-sim-ant/blob/main/.github/workflows/pages.yml) is active under .github/workflows. It checks out the repository, configures Pages with enablement=true, uploads the entire repository as the static artifact, and deploys with actions/deploy-pages@v4. Permissions: contents:read, pages:write, id-token:write. It runs on both main and the old `claude/kind-noether-b17h3i` branch plus manual dispatch, with a shared pages concurrency group. No tests run in the current deploy workflow. Recommended release improvement: deploy production only from tested main; a push to the old branch can otherwise overwrite production.

The latest explicit deployment [job 91446994400](https://github.com/occult-kranti/astrology-sim-ant/actions/runs/30729460682/job/91446994400) has every step successful. Its decoded job log confirms:

- artifact 8827457765 uploaded, final ZIP size 4,685,898 bytes;
- pages_build_version = `3a3ce9953e47a078e659723a52187648f1f08486` (matches baseline default HEAD);
- “Reported success!”;
- evaluated environment URL = https://occult-kranti.github.io/astrology-sim-ant/.

An independent Exa URL fetch on 2026-10-03 returned the live home page titled “The Astrologer's Workbench — Western & Indian astrology, the oracles & the esoteric arts, computed honestly,” with its Workbench, Right Now and historical study links. This verifies reachability and correct product content, but is not a rendered-browser or asset-hash verification. The simultaneous dynamic “pages build and deployment” run also succeeded at the same SHA; inspect actual Pages settings before choosing whether both deploy routes should remain.

### Skylens

The only deployment YAML verified is [docs/github-workflow-pages.yml](https://github.com/occult-kranti/skylens/blob/main/docs/github-workflow-pages.yml). It is a dormant template, not an Actions workflow. It runs tools/build_data.py before upload (a network dependency) and does not run tests. It has pages:write/id-token:write but lacks explicit contents:read. It does not self-enable Pages. The source README describes either branch-based Pages or moving that template into .github/workflows.

[Open issue #4](https://github.com/occult-kranti/skylens/issues/4) says enablement remains unchecked and records that the earlier creation token lacked workflow OAuth scope. That is historical evidence, not proof of the current connector's write capability. The Actions API returns zero runs. Exa's live URL fetch returned CRAWL_NOT_FOUND at https://occult-kranti.github.io/skylens/. Together these do not establish an existing successful Skylens deployment; treat initial deployment as outstanding and verify it directly after implementation.

### Read-access and release limitations

- The GitHub connector rejects GET /repos/{owner}/{repo}/pages with INVALID_ARGUMENT/HTTP 400 because that endpoint is outside its public endpoint allowlist. Exact Pages settings, custom-domain details, and enabled/source state cannot be verified through that call.
- Both branch detail endpoints report protected=false and required checks off; rulesets endpoint returns []. Managed app administration/protection endpoints may still be unavailable. Repository metadata reports push/maintain/admin permission, but that is not proof that workflow mutations or Pages administration are supported by this connector.
- No GitHub mutation was performed in this audit. No source branch or user change was discarded. Deployment of new work remains to be established by the lead engineer after tests.
- Physical phone camera alignment is outside this read-only audit.

## Source API routes

For each owning repository under https://api.github.com/repos/occult-kranti/{repo}/ : branches?per_page=100, branches/main, rulesets, actions/runs?per_page=8. Open issues and PRs were queried independently via GitHub search (all results fit within the requested limit 100). Recent commits were queried with topn=8. Files were read through the connector at main. The exact run/jobs routes and public URLs are linked above.

