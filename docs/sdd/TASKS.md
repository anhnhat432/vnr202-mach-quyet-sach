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
- [-] `T022` Populate Chapter 2 dossiers. Depends: T020. DoD: five Published dossiers and content tests.
- [ ] `T023` Populate Chapter 3 dossiers. Depends: T020. DoD: five Published dossiers and content tests.
- [ ] `T024` Complete global cause map/evidence matrix. Depends: T021-T023. DoD: every node/claim traces to dossier/source.
- [ ] `T025` Add local progress, authenticated sync placeholder and AI/source disclosure. Depends: T021-T024. DoD: UX-AC-003/004/005/006/012 evidence.

Phase 2 Checkpoint A1 evidence snapshot (2026-08-20): the canonical authoring model is split into 15 ordered dossier files, a Verified source registry, causal-link registry and publication manifest. Dossiers 01, 03, 04 and 05 are complete source-backed Drafts with six evidence cards, three options, six claims and six causal nodes; they have no human review or publication metadata. The generated runtime and public API still expose exactly three legacy-baseline Published dossiers (02, 06 and 13). Automated gates pass with 28 unit tests, 12 desktop/mobile E2E tests, lint, typecheck, production build and zero audit vulnerabilities. `T020` and `T021` remain in progress because the source packages have not completed human academic review and Chapter 1 does not yet contain five Published dossiers. See `docs/sdd/evidence/phase-2/chapter-1/README.md`.

Phase 2 Checkpoint A2 evidence snapshot (2026-08-20): Chapter 2 dossiers 07-10 verified as source-backed Drafts with complete Scenario Engine content (6 evidence cards, 3 options, 6 claims, 6 causal nodes each). All source references resolve correctly. Draft isolation confirmed via new regression test. Build, lint, typecheck pass. Unit test environment has pre-existing vitest/jsdom configuration issue (unrelated to content changes). Dossier 06 remains legacy-baseline Published. Inter-dossier causal links for Chapter 2 deferred to T024. Human academic review pending for all Draft dossiers. `T022` remains in progress. See `docs/sdd/evidence/phase-2/chapter-2/README.md`.

## Live Arena V1.0 re-scope - Stage A (documentation)

- [-] `T090` Write `live-arena-game-spec.md` with coded rules, EARS criteria, trial parameters and open items. Depends: owner decisions Q1-Q14, O1-O14. DoD: every owner decision mapped to a rule ID with a status tag; owner approval recorded.
- [-] `T091` Amend `core-platform-spec.md` (v1.1, §16), `product-experience-spec.md` and `figma-make-brief.md`. Depends: T090. DoD: every superseded, amended or proposed-amendment v1.0 rule marked inline and listed in §16; owner approval recorded.
- [-] `T092` Write ADR-004. Depends: T090. DoD: decisions, alternatives and consequences recorded; owner approval recorded.
- [-] `T093` Update data model, API, realtime and security contracts. Depends: T090-T092. DoD: no contract still references `timeline`/`decision_room`, grace pause, 8-second feedback, forced password change or a fixed MSSV pattern; no payload carries question content before `available_at`; owner approval recorded.
- [-] `T094` Update PLAN, TASKS and traceability matrix. Depends: T090-T093. DoD: every `LA-*`, `MINE-*`, `RACE-*` rule traced to a task and planned test; owner approval recorded.
- [-] `T095` Game 1 balance simulation baseline. Depends: T090. DoD: reproducible seeded run and report in `docs/sdd/evidence/live-arena/balance-baseline.md`, explicitly limited to the no-time-pressure assumption.
- [-] `T096` Stage A revision 1: apply O1-O14 and corrections A-F (MSSV as string, server-controlled content release, bank exposure strategy, simulation limits, residual feedback-inference risk, leaderboard privacy proposal). Depends: T090-T095. DoD: owner approval recorded.
- [-] `T097` Deterministic time budget for both games. Depends: T096. DoD: `tools/simulations/time-budget.mjs` and `docs/sdd/evidence/live-arena/time-budget.md`.
- [-] `T098` Documentation consistency check. Depends: T096. DoD: `tools/sdd/check-live-arena-docs.mjs` passes and its report is recorded in `docs/sdd/evidence/live-arena/consistency-check.md`.

Re-scope snapshot (2026-10-29, revision 1): stage A is conditionally approved; revision 1 awaits owner approval before stage B. No migration, API, authentication, UI or gameplay code has been written for Live Arena V1.0. Decisions O1-O14 are applied; remaining open items N1-N9 are listed in `live-arena-game-spec.md` §12.2 and noted per task below.

## Phase 3 - Identity and roster

- [ ] `T030` Add profiles/roles/Auth SSR migration and clients. Depends: T014. DoD: anon/student/admin actor tests pass on local Supabase.
- [ ] `T031` Implement student ID sign-in with the shared default password and server-side password derivation (`LA-ACC-003..009`, `LA-ACC-015`, `LA-ACC-016`). Depends: T030. DoD: Supabase short-password behaviour verified on a real hosted Supabase project and recorded before choosing the derivation path; sign-in with MSSV + default password reaches Live Arena with no password-change step; synthetic email hidden; pepper/default password absent from bundle, logs and repository; generic errors; sign-in/transfer log; NAT rate limit measured (P10). Open: N7.
- [ ] `T032` Implement roster `.xlsx`/`.csv` preview/apply/compensation (`LA-ACC-001/002/010..014`). Depends: T030. DoD: MSSV kept as text with leading zeros (`LA-AC-028`); numeric XLSX cells flagged and confirmed; duplicate (file and roster), missing, pattern and formula issues shown in preview; nothing written before apply; valid import audited. MSSV pattern and row limit set only after inspecting the real class file. Open: N1 (display name column), N6, N9 (XLSX library after security review).
- [ ] `T033` Implement admin reset-to-default and session revocation. Depends: T031,T032. DoD: reset revokes the active gameplay session and the old session cannot act.
- [ ] `T034` Implement Student Passport and progress sync. Depends: T025,T031. DoD: profile, 15 markers, two result cards with provisional/official labels, rehearsal results excluded (`LA-AC-030`), review availability.
- [ ] `T035` Identity security/RLS/E2E gate. Depends: T030-T034. DoD: ACC/ACCESS/LA-ACC and security acceptance tests pass on Supabase, not only on plain PostgreSQL.

## Phase 4 - Competition and Core games

- [ ] `T040` Implement competition schema/state machine/readiness/snapshots. Depends: T014,T035,T048. DoD: legal transitions; `official`/`rehearsal` separation; readiness blocks insufficient blueprint coverage, fixtures in official competitions (`LA-AC-021`) and unconfirmed disclosed questions (`LA-AC-029`); readiness reports expected viewers per question. Open: N3.
- [ ] `T041` Implement allocation, Game 1 board generation and start/resume RPC. Depends: T040. DoD: concurrent start creates exactly one attempt; second game blocked while one is active (`LA-AC-001..003`); board composition and first-open swap (`LA-AC-006/007`); immutable allocation and option order. Open: N8.
- [ ] `T042` Implement question timeline, server-controlled content release, latency allowance and reconcile/timeout (§5.4.1). Depends: T041. DoD: content never in any payload before `available_at`; early content request held or `425` (`LA-AC-022`); late fetch keeps `deadline_at` (`LA-AC-023`); `deadline_at` beyond attempt end (`LA-AC-024`); exact-boundary and +1 ms tests (`LA-AC-025`); injected latency 100/300/600/1000 ms (`LA-AC-026`); F5/transfer never resets a timestamp (`LA-AC-004`). Open: N5.
- [ ] `T043` Implement device transfer/session version. Depends: T042. DoD: old device invalid immediately for answers, content fetches and cell opens; new device resumes the same interaction (`LA-AC-005`).
- [ ] `T044` Implement Bãi Mìn Tri Thức event ledger and scoring. Depends: T041-T043. DoD: §7.1 formulas, items, bombs, floor at 0, pending interaction blocks cell opens, defuse failure at attempt end (`LA-AC-008`, `LA-AC-017`, `LA-AC-027`).
- [ ] `T045` Implement Đường Đua Lịch Sử scoring. Depends: T041-T043. DoD: combo, sprint ordering and timeouts (`LA-AC-010`, `LA-AC-017`).
- [ ] `T046` Implement leaderboard projection/version/finalization. Depends: T044,T045. DoD: two independent boards, per-game tie-breakers with shared ranks, provisional/official standing, personal gap including rank-1 cases (`LA-AC-011`, `LA-AC-013`, `LA-AC-031`), no roster exposure (`LA-AC-032`), disclosure marking on finalization. Open: N1, N2.
- [ ] `T047` Implement gameplay API routes, OpenAPI and Core integration gate. Depends: T040-T046,T049. DoD: TRY/SESSION/LA-TIME/LA-IDEM/LA-LB traceability passes on pgTAP and on local Supabase; no answer leaves the server before finalization (`LA-AC-014`, `LA-AC-020`).
- [ ] `T048` Build question bank pipeline, exposure tracking and isolated fixtures. Depends: T020. DoD: validator (2-3 options, defuse and before/after exactly 2, sources, reviewer required for Published, trial length limits 80/40), review pack, seed generator, `origin = fixture` separation, exposure and disclosure records, bundle-leak test. No question marked Published without a human reviewer (`LA-CONTENT-003/004`). Open: N3, N4.
- [ ] `T049` Build TypeScript reference model and SQL parity tests. Depends: T044,T045. DoD: scripted scenarios give identical ledgers in TypeScript and SQL; balance simulation runs as a test.

## Phase 5 - Live UI and admin

- [ ] `T050` Implement Arena Lobby and attempt/resume/transfer UX. Depends: T034,T047. DoD: UX-AC-007, one-active-attempt messaging, rules intro before start, all connection states without grace pause.
- [ ] `T051` Implement Bãi Mìn Tri Thức laptop/mobile gameplay. Depends: T044,T050. DoD: 4x5 board, overlay question rendered only after content release, HUD, keyboard, sound toggle, reduced motion, 0.8-1 s feedback without answers.
- [ ] `T052` Implement Đường Đua Lịch Sử laptop/mobile gameplay. Depends: T045,T050. DoD: 15 questions, track, combo, sprint transition, rank-up feedback, keyboard, content fetched per question.
- [ ] `T053` Implement Broadcast subscriber/resync, two web leaderboards and personal standing. Depends: T046,T050. DoD: version validation, missed-event recovery, board separation, gap display (`UX-AC-014`). Open: N1, N2.
- [ ] `T054` Implement projector leaderboards. Depends: T053. DoD: both Top 10 side by side at 1920x1080, single-game zoom, completed count, overtake notices, provisional/official/rehearsal labels (`LA-AC-012`, `LA-AC-015`). Open: N1.
- [ ] `T055` Implement question governance admin. Depends: T032,T040,T048. DoD: Draft-Reviewed-Published with source validation; AI cannot review/publish; exposure view and explicit disclosed-question confirmation with audit (`LA-AC-029`).
- [ ] `T056` Implement competition admin/monitor/audit viewer and incident actions. Depends: T040,T046. DoD: schedule, readiness, transitions, attempts, audited incident actions, no automatic or replacement attempt (`LA-ADMIN-*`), impersonation warning on competition creation (`LA-ACC-006`).
- [ ] `T057` Live Arena E2E and realtime outage gate. Depends: T051-T056,T058. DoD: complete two-game rehearsal, reconnect/transfer flows and convergence tests.
- [ ] `T058` Implement post-finalization review and relabel Dòng Chảy as free practice. Depends: T047. DoD: review available only after finalization (`LA-AC-014`); practice page has no Game 01 label and no leaderboard (`UX-AC-017`).

## Phase 6 - Hardening and public deployment

- [ ] `T060` Security headers, CSRF, rate limits, logging redaction and secret scan. Depends: T057. DoD: security-spec acceptance tests.
- [ ] `T061` Accessibility, reduced motion, performance and cross-browser audit. Depends: T057. DoD: WCAG AA target and mobile/projector evidence.
- [ ] `T062` Load test 60 players + 200 viewers. Depends: T057,T060. DoD: rank visibility p95 under one second or documented fix/retest.
- [ ] `T063` Production Supabase/Vercel environments and migration runbook. Depends: T060-T062. DoD: preview isolated, production secrets configured, cron protected.
- [ ] `T064` Public deploy and production smoke test. Depends: T063. DoD: public URL, auth, one test competition and both leaderboards verified.
- [ ] `T065` Demo/content evidence pack and final traceability closure. Depends: T020-T025,T064. DoD: four validation layers complete with no required Pending row.
- [ ] `T066` Measure classroom latency and lock `latency_allowance`. Depends: T057. DoD: p50/p95/p99 RTT for cell open and answer on classroom Wi-Fi; value chosen within 300-500 ms or escalated (spec §11 P2).
- [ ] `T067` Time-pressure simulation and classroom rehearsal for trial parameters. Depends: T057,T066. DoD: simulation with reading-speed and latency models plus real-player rehearsal; report on durations, feedback timing, reveal offset, AI-lookup and answer-sharing signals, question length, per-question exposure and Game 1 luck under time pressure (spec §11 P1, P3-P6, P8-P10); owner decides any change.
