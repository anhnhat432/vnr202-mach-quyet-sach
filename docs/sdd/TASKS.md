# VNR202 Task Register

Status values: `[ ] pending`, `[-] in progress`, `[x] complete`, `[!] blocked`.

## Phase 0 - Figma

- [x] `T000` Create the Figma Design file and page structure. Depends: approved Figma brief. DoD: file URL recorded and ten required pages exist.
- [-] `T001` Build variables, styles, grids and foundations. Depends: T000. DoD: tokens match approved palette/type/spacing and have desktop/mobile/projector modes.
- [ ] `T002` Build component library and variants. Depends: T001. DoD: required interaction/loading/error/connection/rank states exist.
- [-] `T003` Compose public desktop/mobile flows. Depends: T002. DoD: homepage, dossier index, one full dossier, cause map and evidence matrix prototype.
- [ ] `T004` Compose Live Arena, two games, Passport, auth and projector flows. Depends: T002. DoD: both games and two independent leaderboards have responsive/projection states.
- [ ] `T005` Compose admin and motion/reduced-motion prototypes. Depends: T002. DoD: roster/content/competition/monitor states and four approved motion patterns.
- [ ] `T006` Figma handoff audit. Depends: T003-T005. DoD: token/component names map to code, no Core rule invented, screenshots approved.

Phase 0 evidence snapshot (2026-08-19): Figma Make Version 5 and the Figma Design file are recorded in `docs/sdd/evidence/phase-0/README.md`. The Design file has ten ordered pages, 31 variables, nine text styles, an `Action Button` set with six variants and a `Status Chip` set with four variants. `T001` and `T003` remain in progress because responsive/projector modes and two captures are incomplete; the broader component, Arena/admin/motion and handoff gates remain open.

## Phase 1 - Foundation and public slice

- [x] `T010` Initialize Git, project context and ignore rules. Depends: T006. DoD: clean repository with no secrets/roster data tracked.
- [x] `T011` Scaffold `web` Next.js app and pin dependencies. Depends: T010. DoD: dev, lint, typecheck and build scripts pass.
- [x] `T012` Configure Vitest, Playwright and CI. Depends: T011. DoD: sample unit and browser smoke tests pass locally/CI.
- [x] `T013` Implement design tokens and responsive app shell from Figma. Depends: T006,T011. DoD: visual token contract tests and desktop/mobile shell.
- [!] `T014` Initialize Supabase and public content migration/RLS. Depends: T010. DoD: `supabase db reset` and public/anon RLS tests pass.
- [x] `T015` Implement API envelope, errors, request IDs and public repositories. Depends: T011,T014. DoD: contract tests return stable envelopes/codes.
- [x] `T016` Implement homepage and dossier metadata index. Depends: T013,T015. DoD: local catalogue validates all 15 planned records; public UI renders only the three Published vertical-slice dossiers, responsive.
- [x] `T017` Implement Scenario Engine vertical slice. Depends: T013,T015. DoD: one complete representative dossier per chapter traverses six stages.
- [x] `T018` Implement cause map and evidence matrix vertical slices. Depends: T015,T017. DoD: source-backed node/edge/claim navigation works desktop/mobile.
- [!] `T019` Phase 1 accessibility, E2E and build gate. Depends: T012-T018. DoD: phase exit gate and traceability evidence recorded.

Phase 1 evidence snapshot (2026-08-19): lint, typecheck, 11 unit tests, 10 desktop/mobile E2E tests, production build and dependency audit pass. The public preview is live at `https://vnr202-mach-quyet-sach.vercel.app`. The migration and static RLS contract tests pass, but `supabase db reset` and `supabase test db` cannot run because Docker and Podman are not installed; therefore `T014` and the complete `T019` exit gate remain blocked rather than falsely marked complete. This preview does not close the full production `T064` gate. See `docs/sdd/evidence/phase-1/README.md`.

## Phase 2 - Full public content

- [-] `T020` Finalize 15 dossier source packages. Depends: T017. DoD: each dossier has reviewed claims, sources and rights notes.
- [-] `T021` Populate Chapter 1 dossiers. Depends: T020. DoD: five Published dossiers and content tests.
- [ ] `T022` Populate Chapter 2 dossiers. Depends: T020. DoD: five Published dossiers and content tests.
- [ ] `T023` Populate Chapter 3 dossiers. Depends: T020. DoD: five Published dossiers and content tests.
- [ ] `T024` Complete global cause map/evidence matrix. Depends: T021-T023. DoD: every node/claim traces to dossier/source.
- [ ] `T025` Add local progress, authenticated sync placeholder and AI/source disclosure. Depends: T021-T024. DoD: UX-AC-003/004/005/006/012 evidence.

Phase 2 Checkpoint A1 evidence snapshot (2026-08-20): the canonical authoring model is split into 15 ordered dossier files, a Verified source registry, causal-link registry and publication manifest. Dossiers 01, 03, 04 and 05 are complete source-backed Drafts with six evidence cards, three options, six claims and six causal nodes; they have no human review or publication metadata. The generated runtime and public API still expose exactly three legacy-baseline Published dossiers (02, 06 and 13). Automated gates pass with 28 unit tests, 12 desktop/mobile E2E tests, lint, typecheck, production build and zero audit vulnerabilities. `T020` and `T021` remain in progress because the source packages have not completed human academic review and Chapter 1 does not yet contain five Published dossiers. See `docs/sdd/evidence/phase-2/chapter-1/README.md`.

## Phase 3 - Identity and roster

- [ ] `T030` Add profiles/roles/Auth SSR migration and clients. Depends: T014. DoD: anon/student/admin actor tests pass.
- [ ] `T031` Implement student ID sign-in and first-password change. Depends: T030. DoD: synthetic email hidden and protected routes enforce flag.
- [ ] `T032` Implement roster CSV preview/apply/compensation. Depends: T030. DoD: malformed/duplicate atomic and valid import audited.
- [ ] `T033` Implement admin password reset and session revocation. Depends: T031,T032. DoD: reset requires new change and old gameplay session fails.
- [ ] `T034` Implement Student Passport and progress sync. Depends: T025,T031. DoD: profile, 15 markers and result-card states render.
- [ ] `T035` Identity security/RLS/E2E gate. Depends: T030-T034. DoD: ACC/ACCESS and security acceptance tests pass.

## Phase 4 - Competition and Core games

- [ ] `T040` Implement competition schema/state machine/readiness/snapshots. Depends: T014,T035. DoD: legal transitions and insufficient-pool blocking tests.
- [ ] `T041` Implement balanced allocation and one-attempt RPC. Depends: T040. DoD: concurrent start creates exactly one immutable attempt/allocation.
- [ ] `T042` Implement timer, heartbeat, disconnect grace and resume. Depends: T041. DoD: boundary/gap/cumulative grace tests pass.
- [ ] `T043` Implement device transfer/session version. Depends: T042. DoD: old device invalid immediately and new device resumes state.
- [ ] `T044` Implement Dòng Chảy scoring. Depends: T041-T043. DoD: normalized 1000, idempotency and tie-break tests.
- [ ] `T045` Implement Phòng Quyết Sách scoring. Depends: T041-T043. DoD: 10% problem + 25% evidence + 35% decision + 20% consequence + 10% speed and staged feedback tests.
- [ ] `T046` Implement leaderboard projection/version/finalization. Depends: T044,T045. DoD: two independent deterministic ranks retained by competition.
- [ ] `T047` Core concurrency/state integration gate. Depends: T040-T046. DoD: TRY/ATT/SESSION/SCORE/EVT traceability passes.

## Phase 5 - Live UI and admin

- [ ] `T050` Implement Arena Lobby and attempt/resume/transfer UX. Depends: T034,T047. DoD: UX-AC-007 and all connection states.
- [ ] `T051` Implement Dòng Chảy desktop/mobile gameplay. Depends: T044,T050. DoD: 15-question flow, accessible drag/tap/keyboard and feedback.
- [ ] `T052` Implement Phòng Quyết Sách desktop/mobile gameplay. Depends: T045,T050. DoD: six scenarios/four stages and feedback pause.
- [ ] `T053` Implement Broadcast subscriber/resync and two web leaderboards. Depends: T046,T050. DoD: version validation, missed-event recovery and separation.
- [ ] `T054` Implement two projector leaderboards. Depends: T053. DoD: 1920x1080 top 10/live/final views.
- [ ] `T055` Implement question/dossier governance admin. Depends: T032,T040. DoD: Draft-Reviewed-Published and source validation.
- [ ] `T056` Implement competition admin/monitor/audit viewer. Depends: T040,T046. DoD: schedule, readiness, transitions, attempts and audit visible.
- [ ] `T057` Live Arena E2E and realtime outage gate. Depends: T051-T056. DoD: complete two-game rehearsal and convergence tests.

## Phase 6 - Hardening and public deployment

- [ ] `T060` Security headers, CSRF, rate limits, logging redaction and secret scan. Depends: T057. DoD: security-spec acceptance tests.
- [ ] `T061` Accessibility, reduced motion, performance and cross-browser audit. Depends: T057. DoD: WCAG AA target and mobile/projector evidence.
- [ ] `T062` Load test 60 players + 200 viewers. Depends: T057,T060. DoD: rank visibility p95 under one second or documented fix/retest.
- [ ] `T063` Production Supabase/Vercel environments and migration runbook. Depends: T060-T062. DoD: preview isolated, production secrets configured, cron protected.
- [ ] `T064` Public deploy and production smoke test. Depends: T063. DoD: public URL, auth, one test competition and both leaderboards verified.
- [ ] `T065` Demo/content evidence pack and final traceability closure. Depends: T020-T025,T064. DoD: four validation layers complete with no required Pending row.
