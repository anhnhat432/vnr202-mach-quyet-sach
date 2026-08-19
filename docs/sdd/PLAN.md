# VNR202 Master Delivery Plan

Goal: Deliver a polished public VNR202 website with 15 interactive decision dossiers, two secure one-attempt games, two realtime leaderboards, administration and public deployment.

Approach: Execute as a sequence of independently demonstrable vertical slices. Figma locks the design language and responsive behavior first. Code then establishes the platform, public experience, identity, competition engine, realtime UI, administration and production hardening. Core logic is test-first and database-authoritative; Shell work follows the approved Figma brief.

## Global constraints

- One developer; prefer reusable engines and shared content schemas.
- 15 dossiers: exactly five per main course chapter.
- One active competition accepting starts; historical competitions retained.
- Two games, two attempts per competition total, two independent leaderboards.
- 60 concurrent players and 200 concurrent viewers; committed rank visible within one second under target load.
- Public content needs no login; Live Arena/Passport require student login; admin is separate.
- Node 22.14+, Next 16.3.1, React 19.2.8, TypeScript 7.0.2, Supabase JS 2.112.3.
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

- Student ID login over Supabase Auth synthetic email.
- First-login password change, admin password reset and session protection.
- CSV preview/apply with validation, compensation and audit.
- Student Passport with dossier progress and competition result cards.

Exit gate: RLS actor matrix passes; malformed roster is atomic; no public/private response leaks student ID.

## Phase 4 - Competition and game Core

Deliverables:

- Competition lifecycle, readiness, snapshots and schedule transitions.
- Balanced allocation, one-attempt constraint and immutable attempt content.
- Heartbeat, disconnect grace, resume, device transfer and authoritative timer.
- Transactional scoring for both games and tie-breakers.

Exit gate: concurrency tests prove one attempt and one score per interaction; timing/state-machine tests cover boundaries.

## Phase 5 - Live Arena and administration

Deliverables:

- Dòng Chảy Lịch Sử and Phòng Quyết Sách responsive gameplay UIs.
- Two live leaderboard projections, Broadcast events, resync and projector mode.
- Admin question workflow, competition controls, monitor and audit viewer.
- All failure/reconnect/resume/transfer UI states from Figma.

Exit gate: 60-player/200-viewer rehearsal, rank update under one second target, realtime outage converges by REST resync.

## Phase 6 - Production hardening and launch

Deliverables:

- Full content review, security headers, rate limits, secret scan and accessibility audit.
- Load tests, cross-browser/mobile QA, projector rehearsal and disaster/recovery runbook.
- Supabase production migrations, Vercel production project, cron and environment isolation.
- Public deployment, smoke tests, demo script and evidence pack.

Exit gate: four-layer Hybrid validation passes in production and no required acceptance criterion remains Pending.

## Dependencies and critical path

`Phase 0 -> Phase 1 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6`

Phase 2 content production can run after the Scenario Engine contract in Phase 1 and in parallel with Phase 3/4 work by the same developer in bounded batches. It must finish before Phase 6.

## Primary risks

- Content volume: mitigate with one versioned Scenario Engine and content validation scripts.
- Timer/disconnect concurrency: implement in PostgreSQL functions with deterministic tests before UI.
- Auth roster partial failure: stage, validate, audit and compensate Auth users.
- Public Broadcast spoofing: event contains no authority; validate version, debounce and refetch.
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
