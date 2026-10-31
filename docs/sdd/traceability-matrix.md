# Traceability Matrix

Student Passport T025/T034: profile/class, fifteen status markers, account-scoped progress and official non-void history use server projections; private progress has no client table permissions. `passport.test.ts`, `passport-view.test.tsx`, `dossier-progress.test.ts`, `arena-admin.test.ts` and `passport.spec.ts` cover grouping, validation, access and transfer. Versioned writes reject stale progress; `offline-progress.test.ts` and `passport-offline.spec.ts` cover local drafts, retry and explicit conflict choices, including a production-build offline reload. Isolated CI verification and hosted/classroom acceptance remain open.

Status: Phase 2 Checkpoint A1 integration snapshot (2026-08-20)
Live Arena V1.0 re-scope (2026-10-29): rows for superseded v1.0 rules are marked Superseded and point to their replacements; new rule families are traced in the Live Arena section below. Stage A documents await owner approval and no Live Arena code exists yet.
Evidence is recorded only for implemented scope. Four new Chapter 1 dossiers are Drafts awaiting human academic review; Core identity, competition, gameplay and realtime rows remain Planned.

| Requirement IDs | Plan tasks | Planned automated evidence | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| ACC-001..002, ACC-004..005, AC-AUTH-001..002 (ACC-001 amended; ACC-003 superseded by LA-ACC-004) | T030-T033,T035 | roster parser (.xlsx/.csv), duplicate, compensation, secret/log tests | import valid/invalid class roster | Planned |
| ACCESS-001..004 | T016-T019,T031-T035 | `content-catalog.test.ts`, `public-dossier.spec.ts`, `home.spec.ts`; database RLS runtime blocked | anonymous public browse verified; protected actor flows not implemented | Partial: ACCESS-001 |
| SCOPE-001..006 | T016,T020-T025,T040,T046 | `content-files.test.ts` validates 15 ordered canonical files; `content-catalog.test.ts` validates five/chapter and three Published | approved Figma future catalogue shows 15; runtime catalogue remains the three Published preview dossiers | Partial: SCOPE-005 canonical metadata; UX-AC-002 not released |
| EVT-001..005 (EVT-004 amended by LA-TIME-011), AC-FINAL-001 | T040,T042,T046,T047,T056 | state machine, deadline/max-end/finalize tests | scheduled competition rehearsal | Planned |
| TRY-001..004, AC-TRY-001..002 | T041,T047 | concurrent start and unique constraint tests | start/resume/second-attempt denial | Planned |
| ATT-001,002,005 (ATT-006 amended; ATT-003/004, AC-DISC-001/002 superseded by LA-TIME-001/008) | T042,T047,T050,T057 | no-pause clock, absolute deadline, reconnect tests | offline/reconnect rehearsal | Planned |
| SESSION-001..005, AC-SESSION-001 | T043,T047,T050,T057 | session-version concurrency tests | device transfer rehearsal | Planned |
| GAME1-001..002 | — | — | — | Superseded by LA-SCOPE-001, MINE-*, LA-ALLOC-002 |
| GAME2-001..002 | — | — | — | Superseded by LA-SCOPE-001, RACE-*, LA-ALLOC-002 |
| CFG-001..002 (CFG-001 amended) | T040,T047,T056 | config lock and locked-rule validation tests | admin readiness/open flow | Planned |
| ALLOC-001, ALLOC-003 (ALLOC-002 superseded by LA-ALLOC-002) | T041,T047 | randomized blueprint allocation/property tests | compare allocations across students | Planned |
| LEARN-001..005 | — | — | — | Superseded by LA-FB-001..004; LEARN-004 amended by LA-LB-002 |
| CONTENT-001..006, AC-CONTENT-001 | T020-T025,T040,T055 | `content-validation.test.ts` enforces Draft/publication and immutable legacy contracts; `chapter-1-drafts.test.ts` validates four complete Drafts; `content-files.test.ts`, `dossier-contract.test.ts`, `public-knowledge.test.ts`, `migration-contract.test.ts`; pgTAP runtime blocked | human review pack generated for dossiers 01, 03, 04 and 05; no AI review/publication assertion; three legacy Published projections retained | Partial: Draft authoring and publication safety pass; human review/admin pending |
| SCORE-003, SCORE-004 (amended), AC-SCORE-001 (amended), AC-SCORE-002; SCORE-001/002/005 and GAME2-SCORE-001/002 superseded by MINE-*, RACE-*, LA-LB-008 | T044-T047,T049 | formula, idempotency, transaction, tie-break tests | score/rank result inspection | Planned |
| PRV-001..004, AC-PRV-001 | T030,T046,T053,T054 | response/event redaction and duplicate-name tests | public leaderboard inspection | Planned |
| NFR-RT-001..005, AC-RT-001..002 | T053,T057,T062 | load, duplicate/out-of-order/missed-event tests | live class/projector rehearsal | Planned |
| UX-AC-001..006 | T013,T016-T019,T024 | `site-shell.test.tsx`, `content-catalog.test.ts`, `public-dossier.spec.ts`, `public-evidence.spec.ts`; Phase 2A Figma evidence covers future 15-dossier catalogue, global cause overview and evidence filters | desktop/mobile homepage, six-stage Published dossier, cause Slice and evidence-source walkthrough; Phase 2A frames approved | Partial: UX-AC-001,003-006 on 3 Published dossiers; UX-AC-002 remains future state |
| UX-AC-007..010 | T050-T054,T057 | lobby separation, realtime resync tests | two-game live walkthrough | Planned |
| UX-AC-011 | T001-T006,T013,T061 | global `prefers-reduced-motion` CSS present; dedicated motion E2E pending | reduced-motion implementation review pending | Partial |
| UX-AC-012 | T014,T020-T025,T055 | `public-draft-boundary.spec.ts` proves four Chapter 1 Drafts absent on desktop/mobile, API returns exactly three Published records and a Draft slug returns HTTP 404; local repository filters Published/Verified; migration contract asserts RLS; pgTAP runtime blocked | public catalogue/API Draft exclusion demonstrated in both Playwright projects | Automated application boundary passes; runtime RLS remains unverified |
| Security spec sections 3-15 | T030-T035,T040-T047,T060,T063 | `home.spec.ts` security-header test, secret scan, `npm audit`; Core security tests pending | public read-only preview only; no auth/game mutation claim | Partial: preview hardening |
| Figma Definition of Done | T000-T006 | Design file structure/foundations plus Phase 2A editable frame IDs and screenshot audit | Phase 2A catalogue, dossier comparison, cause map, evidence matrix, failure, focus and reduced-motion states approved; Arena/admin/projector handoff incomplete | Partial: Phase 2A gate complete |

## Live Arena V1.0 (spec `live-arena-game-spec.md`, ADR-004) — revision 2

| Requirement IDs | Plan tasks | Planned automated evidence | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| LA-SCOPE-001..005 | T051,T052,T058 | route/label tests; practice page has no leaderboard | lobby shows two games; practice mode separate | Planned (spec drafted, T090) |
| LA-ACC-001..002, LA-ACC-010..014, LA-ACC-017..018, LA-AC-018, LA-AC-028 | T032,T035 | `.xlsx`/`.csv` parser unit tests (leading zeros, numeric cells, duplicates, formula prefix); preview-before-apply integration test | import a copy of the real class file format with synthetic data | Implemented (stage B): `roster-files`, `roster-preview`, `student-id` unit tests; `identity.test.ts`; `auth-roster.spec.ts`; real class file not yet inspected (N6); `.xlsx` reader tested against files from XlsxWriter, openpyxl and LibreOffice (`roster-xlsx-producers.test.ts`), **not** Excel/Google Sheets/WPS-saved files (T103) |
| LA-ACC-003..009, LA-ACC-015..016, LA-AC-019 | T031,T033,T035 | sign-in contract tests; bundle/log scan for pepper and default password; hosted Supabase short-password verification | MSSV + default password login, no change step; NAT rate-limit check (P10) | Implemented (stage B) except hosted verification LA-ACC-016: `provider-password`, `csrf` unit tests; `identity.test.ts` (real GoTrue); `identity_rls.sql` pgTAP; secret/bundle scans; see `docs/sdd/evidence/phase-3/README.md` |
| LA-TRY-001..007, LA-AC-001..003, LA-AC-005 | T041,T043,T047 | concurrent start pgTAP; one-active-attempt constraint test; stale-session rejection after transfer | start/resume/second-game block and device-transfer walkthrough | Implemented in database (stage D, `competition-core.test.ts`, `competition_core.sql`); API wrapper T047 |
| LA-TIME-001..023, LA-AC-004, LA-AC-009, LA-AC-022..027, LA-AC-033..035 | T042,T043,T044,T047,T066 | timeline tests (content release, held/425 request, late fetch, deadline beyond attempt end, exact boundary and +1 ms, defuse at attempt end); stale-transaction, lock-wait and lock-timeout tests with two connections; injected-latency integration tests | offline/reconnect and device transfer rehearsal; latency measurement | Implemented in database (stage D); latency/load measurements P2/P7 pending (stage G) |
| LA-ALLOC-001..012, LA-AC-036..037 | T041,T048,T110 | blueprint/allocation property tests; 60 concurrent starts (balance ≤ 1, no repeats, two-option cap); allocated vs displayed counters; disclosed-question exclusion | compare allocations across students | Implemented (stage C function, stage D wiring); `QB002` for the hard cap (Q1) |
| MINE-BOARD-001..008, LA-AC-006..007 | T041,T044 | board composition and first-open swap pgTAP; cell idempotency; pending-interaction block | board walkthrough | Implemented in database (stage D, `arena-games.test.ts`) |
| MINE-Q-*, MINE-BOMB-*, MINE-ITEM-*, MINE-END-*, LA-AC-008 | T044,T049 | ledger formula pgTAP + TypeScript parity; balance simulation | scored Game 1 rehearsal | Implemented in database (stage D) with TypeScript parity; balance baseline in `balance-baseline.md` |
| RACE-001..011, LA-AC-010 | T045,T049,T052 | combo/sprint pgTAP + parity | scored Game 2 rehearsal | Implemented in database (stage D, Game 2 V0.1) with TypeScript parity; RACE-010/011 UI in stage F |
| LA-FB-001..007, LA-AC-014, UX-AC-015 | T047,T051,T052,T058 | response/event scan for correct answers before finalization; review endpoint state test | feedback and post-final review walkthrough; P5 sharing signals | Database side implemented (stage D: no answers before Finalized, review after); API scans in stage E |
| LA-LB-001..012, LA-AC-011..013, LA-AC-015, LA-AC-031, UX-AC-013..014 | T046,T053,T054 | rank()/tie tests incl. rank-1 cases; board separation; provisional/official/rehearsal label tests; 1920x1080 screenshot | projector rehearsal | Database side implemented (stage D); realtime/projector/UI in stages E-F |
| LA-PRV-001..005, LA-AC-032, LA-AC-038, PRV-001..004 (PRV-001 amended) | T032,T033,T046,T053,T054 | public endpoint scans (no MSSV, no full name, no roster, no non-participants, anonymous ≤ 10 rows); display-name generator unit tests | public board inspection | Implemented (stage B): `display-name.test.ts`, RLS tests, `/api/v1/admin/*` 404 for students; public leaderboard endpoints arrive with stage D |
| LA-ANTI-001..007, LA-AC-020 | T047,T048,T060 | bundle/public API/event leak scans | anti-AI and answer-sharing rehearsal (P5) | Planned |
| LA-IDEM-001..004, LA-AC-017 | T044,T045,T047 | duplicate key / concurrent request tests | retry under flaky network | Implemented in database (stage D, concurrency tests) |
| LA-ADMIN-001..004 | T056 | audit and no-auto/no-replacement-attempt tests | incident drill | Planned |
| LA-CONTENT-001..014, LA-AC-021, LA-AC-029..030 | T040,T048,T055,T110,T111,T113,T114,T115,T116 | question validator; fixture-blocking and disclosed-question readiness tests; rehearsal separation test; `competition-core.test.ts` bank acknowledgement and hard blockers | review pack for real bank; exposure report (P9) | Governance and 31 AI drafts; no reviewer appointed so nothing is Published. LA-CONTENT-014 approved by owner and implemented with audited acknowledgement; isolated integration passed, final browser/hosted acceptance pending. |
| LA-UX-001..006, UX-AC-016..017 | T050-T054,T061 | keyboard/reduced-motion/sound tests | laptop and projector review | Planned |
| LA-NFR-001..002, LA-AC-016 | T062,T066,T067 | load script; latency report | 60 players + 200 viewers rehearsal | Planned |
| Stage A documentation consistency | T098,T099 | `node tools/sdd/check-live-arena-docs.mjs` | `docs/sdd/evidence/live-arena/consistency-check.md` | Passing at revision 2 (structural only, not semantic) |

## Stage D evidence (competition core, 2026-10-30)

| Rule family | Test file / case |
| --- | --- |
| LA-TRY-001..007, LA-AC-001..003 | `competition-core.test.ts` "one attempt per student, game and competition" (20 concurrent starts, cross-game race, resume after F5/other key) |
| LA-TIME-003/013..017, LA-AC-022..024 | "question timeline and content release" (no content before `available_at`, 425 + `availableInMs`, late fetch keeps deadline, `available_at ≥ ends_at` never released) |
| LA-TIME-005/009, LA-AC-025/026 | latency sweep 100/300/600/1000 ms: accepted at deadline+latency, timed out +1 ms |
| LA-TIME-019..023, LA-AC-033..035 | real-clock test: lock wait, stale transaction, `lock_timeout` (55P03, nothing written); pgTAP "no function reads now()" |
| LA-ALLOC-012, LA-AC-037 | "display counter moves exactly once per released question" (F5, repeat, 12 concurrent, answered, unopened, unreleased) |
| LA-TRY-006, LA-AC-005 | "device transfer and stale sessions" |
| MINE-*, LA-AC-006..008 | `arena-games.test.ts` Bãi Mìn cases (composition, swap, x2, shield, floor, 2 460, time-up defuse) |
| RACE-*, LA-AC-010 | Đường Đua cases (5/7/3 order, 2 300, combo reset, time-up) |
| T049 parity | randomized SQL vs `scoring.ts` ledgers |
| LA-LB-*, LA-AC-011..013/031/032/038 | leaderboard cases (1,2,2,4 ranks, tie-breakers, Top 10 cap, privacy keys, personal gaps, labels) |
| LA-IDEM-*, LA-AC-015 | concurrency cases + 60-player load test |
| LA-CONTENT-009, LA-FB-004 | "finalization and review" (only displayed questions marked disclosed and reviewable) |
| Q1 / Q3 | `question-allocation.test.ts` (QB002), `sources-sync.test.ts` |

## Stage E evidence (gameplay API, 2026-10-30)

| Rule family | Test |
| --- | --- |
| LA-TRY-006, LA-AC-005 over HTTP; profile from Auth, never from the request | `tests/e2e/arena-api.spec.ts` (second Auth session takes control, old one `409 stale_session`; forged `profileId` → 422), `arena-session.test.ts` |
| LA-ANTI-003 strict bodies; LA-IDEM-001 Idempotency-Key | `arena-service.test.ts`, e2e replay (`replayed: true`, same result) |
| LA-FB-001/003 no answer before Finalized | e2e scans every gameplay response for `correctOptionId`/`explanation`; review `409` before Finalized |
| LA-LB-003/011, LA-PRV-004 public Top 10 | e2e: anonymous board lists classroom display names and none of the identifiers |
| api-contracts §12 OpenAPI | `openapi-contract.test.ts` |

## Stage F evidence (UI, leaderboards, projector, admin, 2026-10-30)

T117 grouped human review: `QB-BULK-001..007` in `specs/question-bank-bulk-review.md` map to `question-bank-admin.tsx`, `question-bulk-actions.tsx`, `tests/unit/question-bank-admin.test.tsx` and `tests/e2e/question-bank-bulk.spec.ts`. The unchanged transition route, `transition_question_version` and `question-governance.test.ts` retain server authorization, academic checks and per-version audit. Validation evidence: `evidence/question-bank-bulk-review.md`.

| Rule family | Test |
| --- | --- |
| LA-TRY-004/006 (F5, transfer only after confirmation), LA-TIME-007 (display-only clock) | `tests/e2e/arena-ui.spec.ts` (F5 keeps question/score/clock; dialog before transfer; old device locked) |
| LA-FB-001..003, LA-ANTI-007 in the browser | `arena-ui.spec.ts` response scan; feedback never covers the next question |
| LA-LB-002/003/004/007, realtime-contracts §3 | `arena-ui.spec.ts` board follows a player without reload, offline/online resync, projector zoom; pgTAP broadcast envelope |
| LA-PRV-004, LA-LB-011 | board text has display names only (no MSSV, no full name); MSSV only in `/admin/.../monitor` |
| LA-ADMIN-002, LA-FB-004, LA-CONTENT-003 | `tests/e2e/arena-admin.spec.ts` (finalize refused while an attempt runs; review only after Finalized), `arena-admin.test.ts` |
