# VNR202 Master Delivery Plan

Goal: Deliver a polished public VNR202 website with 15 interactive decision dossiers, two secure one-attempt games, two realtime leaderboards, administration and public deployment.

> **Re-scope 2026-10-29 — Live Arena V1.0.** The two competition games are now Bãi Mìn Tri Thức (`minefield`) and Đường Đua Lịch Sử (`race`) per `docs/sdd/specs/live-arena-game-spec.md`, Core Spec Amendment v1.1 (§16) and ADR-004. Dòng Chảy Lịch Sử becomes a free practice mode; Phòng Quyết Sách stays inside the public dossiers. Implementation follows stages A–G below; stage A (documentation) must be approved before any Core code, migration or gameplay is written.

Approach: Execute as a sequence of independently demonstrable vertical slices. Figma locks the design language and responsive behavior first. Code then establishes the platform, public experience, identity, competition engine, realtime UI, administration and production hardening. Core logic is test-first and database-authoritative; Shell work follows the approved Figma brief.

## Global constraints

- One developer; prefer reusable engines and shared content schemas.
- 15 dossiers: exactly five per main course chapter.
- One active competition accepting starts; historical competitions retained.
- Two games (Bãi Mìn Tri Thức, Đường Đua Lịch Sử), one attempt per game per competition, at most one active attempt per student at a time, two independent leaderboards and no combined leaderboard.
- Trial durations 3:00 and 2:30; per-question limits 6/8/10 s (+5 s defuse) and 5/7/9 s; no clock pause on disconnect.
- Shared default student password with a documented, accepted identity risk (classroom use only).
- 60 concurrent players and 200 concurrent viewers; committed rank visible within one second under target load.
- Public content needs no login; Live Arena/Passport require student login; admin is separate.
- Node 22.14+, Next 16.3.1, React 19.2.8, TypeScript 6.0.3 (ADR-002; 7.0.2 when the lint toolchain allows), Supabase JS 2.112.3.
- No code implementation may redefine Core rules in the approved specs.

## Phase 0 - Figma source of truth

Deliverables:

- New Figma file with foundations, variables, typography and responsive grids.
- Component library with all required states.
- Desktop/mobile public flows, both games, Passport, auth and admin.
- 1920x1080 projector leaderboards and reduced-motion prototype.
- Handoff notes mapping components and tokens to planned code names.

Exit gate: Figma Make brief Definition of Done passes and screenshots show no missing Core states.

## Phase 1 - Platform and public vertical slice

Deliverables:

- Git repository, Next.js app, tests, CI and environment contracts.
- Supabase local project, public content schema, RLS and seed framework.
- App shell using Figma tokens.
- Homepage, dossier index, one complete dossier per chapter, basic cause map and evidence matrix.
- Content validators and source traceability tests.

Exit gate: anonymous visitor completes three representative dossiers on desktop/mobile and every claim links to a source.

Detailed plan: `docs/sdd/plans/2026-08-19-phase-1-foundation-public-slice.md`.

## Phase 2 - Full public experience

Deliverables:

- All 15 dossiers populated and reviewed.
- Complete Scenario Engine interactions, Mạch Nguyên Nhân and Ma trận Bằng chứng.
- Local progress plus authenticated sync contract.
- Source/AI disclosure and accessibility/reduced-motion coverage.

Exit gate: exactly 15 Published dossiers, five/chapter, content audit complete and public flow meets UX acceptance criteria.

## Phase 3 - Identity, roster and Passport

Deliverables:

- Unblock local Supabase (`supabase start`, `supabase db reset`, `supabase test db`) so RLS and RPC tests run on a real Postgres; plain PostgreSQL 16 + pgTAP is only a fallback for RPC logic and never replaces Supabase Auth/RLS/Realtime verification.
- Student ID login over Supabase Auth synthetic email with the shared default password and server-side password derivation (`LA-ACC-003..007`); no forced first-login change in V1.
- Admin reset-to-default, session revocation, sign-in/transfer log (proposed) and session protection.
- `.xlsx` and `.csv` roster preview/apply with duplicate/missing-data validation, compensation and audit.
- Student Passport with dossier progress and competition result cards.

Exit gate: RLS actor matrix passes on Supabase; malformed roster is atomic; no public/private response leaks student ID; pepper/default password absent from bundle, logs and repository.

## Phase 4 - Competition and game Core

Deliverables:

- Question bank pipeline (authoring JSON, validation, human review pack, seed) with fixtures isolated from the real bank; no question marked Published without a human academic reviewer.
- Competition lifecycle, readiness (blueprint coverage, no fixtures in official competitions), snapshots and schedule transitions.
- Per-attempt allocation by difficulty blueprint, option shuffling, Game 1 board generation, one-attempt and one-active-attempt constraints.
- Absolute question deadlines, latency allowance, resume and device transfer with no clock pause.
- Transactional event ledger and scoring for Bãi Mìn (board, bombs, shields, x2, chests) and Đường Đua (combo, sprint), per-game tie-breakers with shared ranks, provisional/official standing.
- Versioned API routes and OpenAPI for the new gameplay endpoints; TypeScript reference model used only for simulation and SQL parity tests.

Exit gate: concurrency tests prove one attempt, one active attempt and one score per interaction; deadline/state-machine tests cover boundaries; no correct answer leaves the server before finalization; pgTAP and Supabase integration runs both pass.

## Phase 5 - Live Arena and administration

Deliverables:

- Bãi Mìn Tri Thức and Đường Đua Lịch Sử responsive gameplay UIs (keyboard, sound toggle, reduced motion, ~10-second rules intro).
- Arena lobby, personal rank and score gap, post-finalization answer review.
- Two live leaderboard projections, Broadcast events, resync and a 1920x1080 projector mode with both Top 10 boards side by side plus single-game zoom.
- Dòng Chảy Lịch Sử relabelled as free practice outside the competition.
- Admin question workflow, competition controls, monitor, audited incident actions and audit viewer.
- All failure/reconnect/resume/transfer UI states from Figma.

Exit gate: 60-player/200-viewer rehearsal, rank update under one second target, realtime outage converges by REST resync; classroom rehearsal measures latency allowance, durations, feedback timing, AI-lookup effectiveness and Game 1 luck (spec §11, P1–P8).

## Phase 6 - Production hardening and launch

Deliverables:

- Full content review, security headers, rate limits, secret scan and accessibility audit.
- Load tests, cross-browser/mobile QA, projector rehearsal and disaster/recovery runbook.
- Supabase production migrations, Vercel production project, cron and environment isolation.
- Public deployment, smoke tests, demo script and evidence pack.

Exit gate: four-layer Hybrid validation passes in production and no required acceptance criterion remains Pending.

## Live Arena V1.0 stages (2026-10-29)

| Stage | Scope | Phase / tasks | Gate |
| --- | --- | --- | --- |
| A | Spec, ADR, contracts, plan, tasks and traceability updates; balance simulation baseline | T090–T095 | Owner approves documents and open items O1–O14 |
| B | Local Supabase unblock; identity, default password, roster `.xlsx`/`.csv` | T014, T019, T030–T035 | Phase 3 exit gate |
| C | Question bank pipeline and isolated fixtures | T048 | Validation + review pack; no Published without reviewer |
| D | Competition and game Core in PostgreSQL (TDD) | T040–T046, T049 | pgTAP + Supabase integration |
| E | Versioned API and OpenAPI for gameplay | T047 | Contract + integration tests |
| F | Player, projector, review and admin UI | T050–T058 | Live Arena E2E |
| G | Load, latency, rehearsal, hardening | T060–T067 | Phase 6 exit gate |

Stages B–G must not start until stage A is approved. Tasks blocked by open items are listed in `live-arena-game-spec.md` §12.

## Dependencies and critical path

`Phase 0 -> Phase 1 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6`

Phase 2 content production can run after the Scenario Engine contract in Phase 1 and in parallel with Phase 3/4 work by the same developer in bounded batches. It must finish before Phase 6.

## Primary risks

- Content volume: mitigate with one versioned Scenario Engine and content validation scripts.
- Timer/disconnect concurrency: implement in PostgreSQL functions with deterministic tests before UI.
- Auth roster partial failure: stage, validate, audit and compensate Auth users.
- Public Broadcast spoofing: event contains no authority; validate version, debounce and refetch.
- Question bank volume (87 reviewed questions) and no appointed academic reviewer yet: build with fixtures, block official competitions until the bank is Published.
- Shared default password allows impersonation: accepted for classroom use, mitigated only by audit and admin incident actions.
- Game 1 luck: monitored by simulation (`docs/sdd/evidence/live-arena/balance-baseline.md`) and rehearsal data; balancing changes require owner approval.
- One-person schedule: keep each phase demoable and do not add VR, chatbot, social or multi-class scope.

## Validation commands by phase

- `npm --prefix web run lint`
- `npm --prefix web run typecheck`
- `npm --prefix web run test`
- `npm --prefix web run test:integration`
- `npm --prefix web run test:e2e`
- `npm --prefix web run build`
- `supabase db reset`
- `supabase test db`
- `npm --prefix web run test:load`
- `npm --prefix web audit --audit-level=high`

Exact availability starts after scaffold; each detailed plan records expected results and alternatives.
