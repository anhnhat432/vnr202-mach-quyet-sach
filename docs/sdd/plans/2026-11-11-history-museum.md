# Interactive history museum — bounded Shell extension

User request: extend `/kien-thuc` into a digital museum. Existing 20 sourced events and scan locators remain the academic baseline. No publication, score, database, attempt, session or authentication changes. Do not commit/push this extension.

Audit: Next 16.3.1 App Router, React 19.2.8, TypeScript 6, npm; Tailwind 4 plus scoped CSS, motion/lucide, shared Vietnamese fonts. Supabase SSR/Auth clients and PostgreSQL migrations exist; deployed competitive Core acceptance is not established. Current public game routes are browser practice; only public dossiers API currently exists. Vitest/Playwright/axe are available. Preserve untracked `references/index.html`.

Architecture: reuse HistoryExplorer state + URL, add optional bounded year/location/topic filters; lazy Three.js globe only on museum route, Natural Earth public-domain land geometry; native accessible location buttons parallel canvas. Render on demand, cap DPR, dispose all GPU/listener resources, context loss -> list fallback. SVG overlay on attributed CC BY-SA reference campaign map, phase controls without invented troop routes. Reuse HistoryPhoto/HistoryFilm/HistoryQuiz; one verified same-square photo pair with different-viewpoint disclosure. Unscored challenge route reuses existing quiz and validates museum return state.

Acceptance / traceability:

- M01: actual WebGL globe, rotate/zoom/reset, pick and cancelable camera fly; keyboard place selection and no-WebGL/context-loss recovery.
- M02: year interval overlap (including spanning events), topic/location/search/period synchronized across globe/list, validated shareable URL and browser history.
- M03: three sourced Điện Biên Phủ phases, select/previous/next/overview; descriptive highlights only, map source/legend/limitations visible.
- M04: theater classifies original/documentary/dramatization; opt-in player and source fallback, explicit empty category.
- M05: valid Ba Đình 1945/2008 comparison, mouse/touch/keyboard/reset, attribution + different viewpoint/time labels, image failure.
- M06: event -> existing quiz component on challenge route -> exact filtered event return; official scores untouched.
- M07: desktop/mobile/keyboard/reduced-motion/axe + existing regression tests, lint/type/unit/build; measure bundle/resources and disclose unmeasured production metrics.

Implementation sequence: content/geometry contracts and tests; museum data/components; integration; source/license evidence; browser QA/performance/build and final report. Human academic approval remains pending independently of source checking.

Implementation evidence: `docs/sdd/evidence/history/museum/README.md`. M01–M07 exercised in 34 passing history browser cases; 64 unit tests, lint, typecheck and webpack production build pass. Full regression run: 40 pass / four documented baseline failures. Production resource capture and screenshots recorded separately. No claims of authenticated Core or lecturer acceptance.
