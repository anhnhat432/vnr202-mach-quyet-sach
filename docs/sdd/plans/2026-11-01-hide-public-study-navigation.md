# Hide public study entry points for the classroom

T121; owner request 2026-11-01. Hybrid / Light Shell-only presentation change, under the existing continuous execution authorization on PR9. No approval gate or new worktree; no merge/deployment.

Design: hide Hồ sơ, Mạch nguyên nhân, Bằng chứng and Phương pháp from desktop/mobile header, homepage study cards/chapter links and footer. A single public presentation constant restores all entry points later. Keep underlying routes, catalogue, academic publication, Passport progress, Auth and Arena behavior unchanged; hiding links is not access control or task completion. This temporarily narrows the visible entry points in Product spec §3.1, not the 15-dossier scope.

Plan:
- [x] Existing shell expectation fails on the old `/ho-so` header link, then passes with the new presentation flag.
- [x] Add `web/src/lib/config/public-experience.ts`; use the shared false flag in header, footer and homepage. Remaining cards fill the grid; chapter shortcuts are hidden with the same flag.
- [x] Existing homepage browser acceptance checks desktop/mobile hidden entry points and remaining Arena/admin links, retaining axe/security assertions. Direct dossier-route/public-Draft-boundary checks remain green. No synthetic gameplay or content changes.
- [x] Local verification: 42 unit files / 198 tests, lint, typecheck, production build and six desktop/mobile production-browser cases pass. SDD checks 53 documents / zero errors; secret/whitespace checks pass. Commit/push and update PR9 under continuous authorization; remote CI runs independently. No deployment or merge: the live site does not change until a deployment is separately authorized.

Local screenshots reviewed: external artifact folder `hide-study-navigation/desktop.png` and `mobile.png`. Restore the entry points by setting `SHOW_PUBLIC_STUDY_SECTIONS` to true; this flag never grants access or changes publication.
