# Traceability Matrix

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

## Live Arena V1.0 (spec `live-arena-game-spec.md`, ADR-004)

| Requirement IDs | Plan tasks | Planned automated evidence | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| LA-SCOPE-001..005 | T051,T052,T058 | route/label tests; practice page has no leaderboard | lobby shows two games; practice mode separate | Planned (spec drafted, T090) |
| LA-ACC-001..002, LA-ACC-010..011, LA-AC-018 | T032,T035 | `.xlsx`/`.csv` parser unit tests; preview-before-apply integration test | import real-format sample with synthetic data | Planned; O9, O12 open |
| LA-ACC-003..009, LA-AC-019 | T031,T033,T035 | sign-in contract tests; bundle/log scan for pepper and default password; Supabase short-password check | MSSV + default password login, no change step | Planned; O9, O13 open |
| LA-TRY-001..007, LA-AC-001..003 | T041,T043,T047 | concurrent start pgTAP; one-active-attempt constraint test | start/resume/second-game block walkthrough | Planned |
| LA-TIME-001..012, LA-AC-004, LA-AC-009 | T042,T043,T047,T066 | deadline boundary pgTAP (at, within allowance, after); F5/transfer deadline-stability tests | offline/reconnect and device transfer rehearsal; latency measurement | Planned; O1, O2 open; P2 trial |
| LA-ALLOC-001..007 | T041,T048 | blueprint/allocation property tests; option-order persistence | compare allocations across students | Planned |
| MINE-BOARD-001..008, LA-AC-006..007 | T041,T044 | board composition and first-open pgTAP; cell idempotency | board walkthrough | Planned; O10 open |
| MINE-Q-*, MINE-BOMB-*, MINE-ITEM-*, MINE-END-*, LA-AC-008 | T044,T049 | ledger formula pgTAP + TypeScript parity; balance simulation | scored Game 1 rehearsal | Planned; P6 baseline in `docs/sdd/evidence/live-arena/balance-baseline.md` |
| RACE-001..011, LA-AC-010 | T045,T049,T052 | combo/sprint pgTAP + parity | scored Game 2 rehearsal | Planned (Game 2 V0.1) |
| LA-FB-001..006, LA-AC-014, UX-AC-015 | T047,T051,T052,T058 | response/event scan for correct answers before finalization; review endpoint state test | feedback and post-final review walkthrough | Planned; P3 trial |
| LA-LB-001..012, LA-AC-011..013, LA-AC-015, UX-AC-013..014 | T046,T053,T054 | rank()/tie tests; board separation; provisional/official label tests; 1920x1080 screenshot | projector rehearsal | Planned; O3, O4, O5 open |
| LA-ANTI-001..007, LA-AC-020 | T047,T048,T060 | bundle/public API/event leak scans | anti-AI rehearsal (P5) | Planned |
| LA-IDEM-001..004, LA-AC-017 | T044,T045,T047 | duplicate key / concurrent request tests | retry under flaky network | Planned |
| LA-ADMIN-001..004 | T056 | audit and no-auto-attempt tests | incident drill | Planned; O6 open |
| LA-CONTENT-001..009, LA-AC-021 | T040,T048,T055 | question validator; fixture-blocking readiness test | review pack for real bank | Planned; no reviewer appointed; O7, O8, O11 open |
| LA-UX-001..006, UX-AC-016..017 | T050-T054,T061 | keyboard/reduced-motion/sound tests | laptop and projector review | Planned |
| LA-NFR-001..002, LA-AC-016 | T062,T066,T067 | load script; latency report | 60 players + 200 viewers rehearsal | Planned |

