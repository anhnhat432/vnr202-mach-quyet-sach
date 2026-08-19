# Traceability Matrix

Status: Phase 1 integration snapshot (2026-08-19)
Evidence is recorded only for implemented scope. Core identity, competition, gameplay and realtime rows remain Planned.

| Requirement IDs | Plan tasks | Planned automated evidence | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| ACC-001..005, AC-AUTH-001..002 | T030-T033,T035 | roster parser, duplicate, compensation, secret/log tests | import valid/invalid class roster | Planned |
| ACCESS-001..004 | T016-T019,T031-T035 | `content-catalog.test.ts`, `public-dossier.spec.ts`, `home.spec.ts`; database RLS runtime blocked | anonymous public browse verified; protected actor flows not implemented | Partial: ACCESS-001 |
| SCOPE-001..006 | T016,T020-T025,T040,T046 | `content-catalog.test.ts` validates 15 planned, five/chapter and three Published | public catalogue labels the 3/15 Phase 1 slice; competition scope pending | Partial: SCOPE-005 metadata |
| EVT-001..005, AC-FINAL-001 | T040,T042,T046,T047,T056 | state machine, deadline/max-end/finalize tests | scheduled competition rehearsal | Planned |
| TRY-001..004, AC-TRY-001..002 | T041,T047 | concurrent start and unique constraint tests | start/resume/second-attempt denial | Planned |
| ATT-001..006, AC-DISC-001..002 | T042,T047,T050,T057 | heartbeat/gap/grace/time boundary tests | offline/reconnect rehearsal | Planned |
| SESSION-001..005, AC-SESSION-001 | T043,T047,T050,T057 | session-version concurrency tests | device transfer rehearsal | Planned |
| GAME1-001..002 | T040,T044,T051 | blueprint/count/duration/scoring tests | 15-question six-minute configured game | Planned |
| GAME2-001..002 | T040,T045,T052 | blueprint/count/duration/stage tests | six-scenario nine-minute configured game | Planned |
| CFG-001..002 | T040,T047,T056 | config lock and update-state tests | admin readiness/open flow | Planned |
| ALLOC-001..003 | T041,T047 | randomized balanced allocation/property tests | compare allocations across students | Planned |
| LEARN-001..005 | T044,T045,T051,T052 | feedback pause and stage-disclosure tests | immediate feedback/rank update flow | Planned |
| CONTENT-001..006, AC-CONTENT-001 | T020-T025,T040,T055 | `dossier-contract.test.ts`, `public-knowledge.test.ts`, `migration-contract.test.ts`; pgTAP runtime blocked | three source-backed Published dossier projections; governance/admin pending | Partial: public projection only |
| SCORE-001..005, GAME2-SCORE-001..002, AC-SCORE-001..002 | T044-T047 | formula, idempotency, transaction, tie-break tests | score/rank result inspection | Planned |
| PRV-001..004, AC-PRV-001 | T030,T046,T053,T054 | response/event redaction and duplicate-name tests | public leaderboard inspection | Planned |
| NFR-RT-001..005, AC-RT-001..002 | T053,T057,T062 | load, duplicate/out-of-order/missed-event tests | live class/projector rehearsal | Planned |
| UX-AC-001..006 | T013,T016-T019,T024 | `site-shell.test.tsx`, `content-catalog.test.ts`, `public-dossier.spec.ts`, `public-evidence.spec.ts` | desktop/mobile homepage, six-stage dossier, cause Slice and evidence-source walkthrough | Partial: UX-AC-001,003-006 on 3 dossiers |
| UX-AC-007..010 | T050-T054,T057 | lobby separation, realtime resync tests | two-game live walkthrough | Planned |
| UX-AC-011 | T001-T006,T013,T061 | global `prefers-reduced-motion` CSS present; dedicated motion E2E pending | reduced-motion implementation review pending | Partial |
| UX-AC-012 | T014,T020-T025,T055 | local repository filters Published/Verified; migration contract asserts RLS; pgTAP runtime blocked | Draft dossiers and Pending sources absent from current public projection | Partial; runtime RLS unverified |
| Security spec sections 3-15 | T030-T035,T040-T047,T060,T063 | `home.spec.ts` security-header test, secret scan, `npm audit`; Core security tests pending | public read-only preview only; no auth/game mutation claim | Partial: preview hardening |
| Figma Definition of Done | T000-T006 | Design file structure/foundations and editable capture evidence | Make prototype plus selected Design captures; Arena/admin/motion handoff incomplete | Partial |
