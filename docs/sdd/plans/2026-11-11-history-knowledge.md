# History knowledge page — bounded Shell addition

Scope: `/kien-thuc`, shared navigation, static sourced timeline, event details and unscored recall questions. This user-requested page is separate from the 15 governed decision dossiers; it does not change their publication manifest. No database, official game scoring, identity or competition contract changes. Existing Figma-derived fonts/layout remain the shared foundation; `references/index.html` is an unmodified visual reference.

## Delivery checklist / traceability

- [x] K01: Six chronological periods, at least 20 events; typed data, per-event source links, 40–80 word summaries and 2–4 bullets per knowledge group. Content contract tests.
- [x] K02: Accent-insensitive keyword/person/year search, combined period filtering, empty state and URL/back/forward preservation. Domain + browser tests.
- [x] K03: Accessible native event dialog; previous/next within filtered results, Escape/focus restoration, recall answers with explanations. Browser tests.
- [x] K04: Actual media with source/rights metadata, lazy loading, image failure/no-media fallback; no unverified video copied from reference. Browser tests.
- [x] K05: Shared navigation and working links to existing practice; no artificial question-filter links or changes to game rules. Browser regression smoke.
- [x] K06: Responsive 390/768/1440 layouts, keyboard/reduced motion, axe, lint/typecheck/unit/E2E/build. Checks executed; default-build and baseline-suite limits explicitly recorded in evidence.

## Content boundary

At initial implementation, `references/` contained only HTML, no textbook PDF. The user subsequently supplied the 440-page 2021 scan from the parent course directory. Twenty event page references are now checked visually, with explicit scopes and a visible WTO date discrepancy note. Each event also retains its institutional web sources. AI-assisted summaries and source cross-checking are not claims of lecturer approval. No copyrighted historical image is copied without a checked reuse statement. The supplied textbook PDF is not redistributed by the app.

## Implementation

1. Test pure search/state contracts before implementation.
2. Add static data, scoped CSS, timeline and detail/quiz/media components.
3. Integrate shared navigation and return links from game entry screens.
4. Verify all new flows and run existing gates; keep known baseline failures distinct.
5. Record evidence. Do not commit, push, merge or deploy (explicit user constraint).

Evidence and actual verification results: `docs/sdd/evidence/history/README.md`; scan locators: `docs/sdd/evidence/history/textbook-crosscheck.md`. Human academic review remains separate.
