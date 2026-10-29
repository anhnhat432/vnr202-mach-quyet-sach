# VNR202 Agent Contract

## Project

VNR202 - Mạch Quyết Sách is a public educational history experience with 15 decision dossiers and an authenticated Live Arena containing two independently paced games and two realtime leaderboards.

## Required reading order

1. `docs/sdd/CONSTITUTION.md`
2. `docs/sdd/specs/core-platform-spec.md`
3. `docs/sdd/specs/product-experience-spec.md`
4. `docs/sdd/architecture/ADR-001-platform-architecture.md`
5. `docs/sdd/PLAN.md`
6. `docs/sdd/TASKS.md`
7. The detailed plan for the active phase
8. For Live Arena work: `docs/sdd/specs/live-arena-game-spec.md` and `docs/sdd/architecture/ADR-004-live-arena-game-redesign.md` (they amend the Core spec, see its §16)

## Immutable boundaries

- Stack: Figma Make/Design, Next.js + TypeScript, Vercel, Supabase PostgreSQL/Auth/Realtime.
- Server/database is authoritative for attempts, timers, answers, scores and ranks.
- Client never writes score, rank, attempt count, remaining time or publication state directly.
- One attempt per student, game and competition; resume and device transfer reuse the same attempt.
- At most one active attempt per student across both games; the game clock never pauses and question deadlines are absolute.
- The shared default student password and its derivation pepper live only in server-side environment variables; never hard-code them in code, seeds or fixtures.
- No correct answer or explanation leaves the server before the competition is Finalized.
- Public leaderboard shows full name but never student ID.
- AI can draft academic content but cannot review or publish it.
- Never commit secrets, real roster data, temporary passwords or service-role credentials.

## Working rules

- Use Hybrid SDD+ADD: Full spec for Core, bounded ADD for Shell.
- Follow TDD for business logic and database functions.
- Preserve traceability from rule to task, code, test and evidence.
- Do not change a Core rule, schema contract, API contract or approved stack silently.
- Use migrations for schema changes; never edit an applied migration.
- Validate every server input with Zod or database constraints.
- Enforce authorization server-side and RLS where a client-accessible table exists.
- Realtime events are hints; clients resynchronize authoritative state.

## Continuous execution

- A bounded implement/fix/build request authorizes inspect -> spec/checklist -> plan -> implementation -> verification -> commit -> push -> pull request.
- Do not add approval gates between those phases unless there is a genuine blocker, missing credential, material scope expansion, destructive action or unexpected workspace change.
- Never merge unless explicitly authorized.
- Preserve unrelated user changes and stop if unexpected overlapping changes appear.

## Validation gate

Completion requires:

1. Automated: tests, lint, typecheck, build and relevant security/load checks.
2. Spec: every applicable rule and acceptance criterion traced to implementation/tests.
3. Constitution/safety: stack, RLS, auth, privacy, audit and server-authoritative rules pass.
4. Acceptance: public exploration, student play, reconnect, device transfer, admin and realtime flows demonstrated.
