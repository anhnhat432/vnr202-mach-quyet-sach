# Project Constitution

Status: Approved
Project: VNR202 - Mach Quyet Sach
Method: Hybrid SDD + ADD

## Product purpose

The product is a public educational web experience for VNR202 with an authenticated Live Arena. It SHALL combine 15 academically sourced interactive decision dossiers, a shared causal map and evidence matrix, two individually paced games, and two independent realtime leaderboards.

## Approved stack

- Design: Figma Make and Figma Design.
- Web: Next.js with TypeScript.
- Hosting: Vercel.
- Database: Supabase PostgreSQL.
- Authentication: Supabase Auth.
- Realtime: Supabase Realtime Broadcast and Presence.

Changing an approved stack element requires an Architecture Decision Record and user approval before implementation.

## Core and Shell boundary

### Core

- Student identity and account provisioning.
- Authentication, authorization, password reset, and active-session control.
- Competition schedule and lifecycle.
- One attempt per student, per game, per competition.
- Attempt recovery after disconnect or device transfer.
- Server-authoritative question allocation, scoring, timing, and leaderboard state.
- Question review, publication, source traceability, and version stability.
- Realtime consistency, privacy, auditability, and result retention.

Core behavior SHALL NOT be implemented from an unresolved or unapproved specification.

### Shell

- Visual styling, typography, layout, animation, sound, and responsive composition.
- Public content presentation and editorial copy.
- Reversible UI composition around approved Core contracts.
- Figma prototypes that do not redefine Core business rules.

Shell work MAY use bounded ADD after its Definition of Done and Core contracts are approved.

## Architecture rules

- The server and database SHALL be the source of truth for attempts, timers, answers, scores, and rankings.
- The client SHALL NOT directly write a score, rank, attempt count, remaining-time value, or publication state.
- Every answer submission SHALL be idempotent and bound to one active attempt, question instance, and session version.
- Score updates and attempt state transitions SHALL be transactional.
- Realtime events SHALL be treated as notifications; clients SHALL be able to resynchronize authoritative state after a missed event.
- Public content SHALL be accessible without authentication.
- Student and administrative operations SHALL be authorized server-side.
- Database tables exposed through an API SHALL use Row Level Security or an equivalent server-only boundary.

## Security and privacy rules

- Validate every server input.
- Enforce authorization on the server for every protected operation.
- Never commit passwords, service-role keys, access tokens, secrets, or a real student roster.
- Supabase service-role credentials SHALL be used only in server-side code.
- Passwords SHALL be managed and hashed by the authentication provider; application code SHALL NOT store plaintext passwords.
- Public leaderboards SHALL display a classroom display name (for example "An N.V.") and SHALL NOT display full names or student IDs. *(Amended 2026-10-29 by owner decision N1, `live-arena-game-spec.md` `LA-PRV-003`; previously: full names only.)*
- Student IDs and detailed attempt records SHALL be visible only to authorized administrators and the owning student where applicable.
- Administrative mutations SHALL be audit logged.
- User-facing errors SHALL not disclose secrets, authorization logic, internal queries, or stack traces.

## Academic integrity rules

- Every playable question SHALL include chapter, topic, type, difficulty, answer, explanation, and source metadata.
- Only Published questions MAY be allocated to a competition attempt.
- AI MAY assist with drafting but SHALL NOT approve or publish academic content.
- A human administrator or lecturer SHALL review the answer, explanation, and source before publication.
- Question versions already allocated to an active competition SHALL remain immutable for that competition.

## Quality rules

- Support at least 60 concurrent players and 200 concurrent leaderboard viewers.
- A newly committed answer and rank SHALL be visible to connected viewers within 1 second under the approved load target.
- Missing a realtime event SHALL NOT cause permanent score or ranking divergence.
- New business logic SHALL have automated tests for happy paths, boundaries, authorization failures, duplicates, concurrency, and state transitions.
- Mobile gameplay and the projector leaderboard SHALL be verified as first-class experiences.
- Accessibility, reduced motion, sound controls, loading states, empty states, and error recovery SHALL be designed explicitly.

## Validation gate

Completion requires evidence at all four layers:

1. Automated checks: tests, lint, type checks, build, and relevant security checks.
2. Spec compliance: every SHALL and acceptance criterion is traced to code and tests.
3. Constitution and safety: approved stack, authorization, privacy, audit, and architecture rules pass review.
4. Acceptance: end-to-end flows are demonstrated for public exploration, student play, disconnect recovery, device transfer, administration, and realtime leaderboards.

## Agent rules

- Read this Constitution, the approved feature specs, PLAN.md, and TASKS.md before implementation.
- Do not implement Core behavior while a material question is open.
- Do not silently change a business rule, API contract, state machine, schema, dependency, or approved stack element.
- Preserve traceability from rule to task, code, test, and evidence.
- Stop after three failed attempts at the same blocker, record evidence, and use the documented escape hatch.
- Do not report completion from a clean diff or an agent assertion alone.
