# Traceability Matrix

Status: Phase 2 Checkpoint A1 integration snapshot (2026-08-20)
Evidence is recorded only for implemented scope. Four new Chapter 1 dossiers are Drafts awaiting human academic review; Core identity, competition, gameplay and realtime rows remain Planned.

| Requirement IDs | Plan tasks | Planned automated evidence | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| ACC-001..005, AC-AUTH-001..002 | T030-T033,T035 | roster parser, duplicate, compensation, secret/log tests | import valid/invalid class roster | Planned |
| ACCESS-001..004 | T016-T019,T031-T035 | `content-catalog.test.ts`, `public-dossier.spec.ts`, `home.spec.ts`; database RLS runtime blocked | anonymous public browse verified; protected actor flows not implemented | Partial: ACCESS-001 |
| SCOPE-001..006 | T016,T020-T025,T040,T046 | `content-files.test.ts` validates 15 ordered canonical files; `content-catalog.test.ts` validates five/chapter and three Published | approved Figma future catalogue shows 15; runtime catalogue remains the three Published preview dossiers | Partial: SCOPE-005 canonical metadata; UX-AC-002 not released |
| EVT-001..005, AC-FINAL-001 | T040,T042,T046,T047,T056 | state machine, deadline/max-end/finalize tests | scheduled competition rehearsal | Planned |
| TRY-001..004, AC-TRY-001..002 | T041,T047 | concurrent start and unique constraint tests | start/resume/second-attempt denial | Planned |
| ATT-001..006, AC-DISC-001..002 | T042,T047,T050,T057 | heartbeat/gap/grace/time boundary tests | offline/reconnect rehearsal | Planned |
| SESSION-001..005, AC-SESSION-001 | T043,T047,T050,T057 | session-version concurrency tests | device transfer rehearsal | Planned |
| GAME1-001..002 | T040,T044,T051 | blueprint/count/duration/scoring tests | 15-question six-minute configured game | Planned |
| GAME2-001..002 | T040,T045,T052 | blueprint/count/duration/stage tests | six-scenario nine-minute configured game | Planned |
| CFG-001..002 | T040,T047,T056 | config lock and update-state tests | admin readiness/open flow | Planned |
| ALLOC-001..003 | T041,T047 | randomized balanced allocation/property tests | compare allocations across students | Planned |
| LEARN-001..005 | T044,T045,T051,T052 | feedback pause and stage-disclosure tests | immediate feedback/rank update flow | Planned |
| CONTENT-001..006, AC-CONTENT-001 | T020-T025,T040,T055 | `content-validation.test.ts` enforces Draft/publication and immutable legacy contracts; `chapter-1-drafts.test.ts` validates four complete Drafts; `content-files.test.ts`, `dossier-contract.test.ts`, `public-knowledge.test.ts`, `migration-contract.test.ts`; pgTAP runtime blocked | human review pack generated for dossiers 01, 03, 04 and 05; no AI review/publication assertion; three legacy Published projections retained | Partial: Draft authoring and publication safety pass; human review/admin pending |
| SCORE-001..005, GAME2-SCORE-001..002, AC-SCORE-001..002 | T044-T047 | formula, idempotency, transaction, tie-break tests | score/rank result inspection | Planned |
| PRV-001..004, AC-PRV-001 | T030,T046,T053,T054 | response/event redaction and duplicate-name tests | public leaderboard inspection | Planned |
| NFR-RT-001..005, AC-RT-001..002 | T053,T057,T062 | load, duplicate/out-of-order/missed-event tests | live class/projector rehearsal | Planned |
| UX-AC-001..006 | T013,T016-T019,T024 | `site-shell.test.tsx`, `content-catalog.test.ts`, `public-dossier.spec.ts`, `public-evidence.spec.ts`; Phase 2A Figma evidence covers future 15-dossier catalogue, global cause overview and evidence filters | desktop/mobile homepage, six-stage Published dossier, cause Slice and evidence-source walkthrough; Phase 2A frames approved | Partial: UX-AC-001,003-006 on 3 Published dossiers; UX-AC-002 remains future state |
| UX-AC-007..010 | T050-T054,T057 | lobby separation, realtime resync tests | two-game live walkthrough | Planned |
| UX-AC-011 | T001-T006,T013,T061 | global `prefers-reduced-motion` CSS present; dedicated motion E2E pending | reduced-motion implementation review pending | Partial |
| UX-AC-012 | T014,T020-T025,T055 | `public-draft-boundary.spec.ts` proves four Chapter 1 Drafts absent on desktop/mobile, API returns exactly three Published records and a Draft slug returns HTTP 404; local repository filters Published/Verified; migration contract asserts RLS; pgTAP runtime blocked | public catalogue/API Draft exclusion demonstrated in both Playwright projects | Automated application boundary passes; runtime RLS remains unverified |
| Security spec sections 3-15 | T030-T035,T040-T047,T060,T063 | `home.spec.ts` security-header test, secret scan, `npm audit`; Core security tests pending | public read-only preview only; no auth/game mutation claim | Partial: preview hardening |
| Figma Definition of Done | T000-T006 | Design file structure/foundations plus Phase 2A editable frame IDs and screenshot audit | Phase 2A catalogue, dossier comparison, cause map, evidence matrix, failure, focus and reduced-motion states approved; Arena/admin/projector handoff incomplete | Partial: Phase 2A gate complete |
