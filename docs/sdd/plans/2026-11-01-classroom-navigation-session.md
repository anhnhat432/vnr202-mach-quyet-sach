# Classroom navigation and session implementation plan

**Goal:** make administration discoverable, waiting screens self-updating and account switching explicit before the class.

**Architecture:** retain existing server APIs and server-authoritative game rules. Add a visibility-aware read-refresh hook, private client account bar and admin navigation. Handle provider logout failure before reporting success. No schema/dependency changes.

**Execution:** root agent implements and verifies inline under the owner's continuous authorization; preserve this checkout and unrelated changes. No subagents or merge. Spec: `../specs/classroom-navigation-session.md`, CLASS-011..016, T119.

## 1. Read refresh (CLASS-012/013)

- [x] Add failing `web/tests/unit/waiting-refresh.test.tsx` and waiting game assertions: ten-second visible updates, focus recovery, no hidden/offline/overlapping reads, cleanup, no attempt creation, no stale waiting overwrite after Start. Observed old hook remain in no_competition and never issue its second read.
- [x] Add `web/src/features/arena/client/use-visible-refresh.ts`; integrate lobby, pre-start game hook and current-competition projector refresh. Add manual refresh and explicit projector waiting text.
- [x] Focused units pass; inspect effect cleanup and start/refresh ordering. Initial/manual lobby reads coalesce; a late waiting result cannot replace a playing projection.

## 2. Navigation and session (CLASS-011/014/015)

- [x] Add failing session-bar and server sign-out tests: only display name, cancel is read-only, successful 204 navigates, failed logout stays, provider errors return sanitized 503 without false sign-out audit. Observed old route return 204 on provider failure.
- [x] Add `web/src/components/account-bar.tsx`, `web/src/features/admin/ui/admin-navigation.tsx`, admin layout and bounded responsive CSS. Wire existing `/me` and CSRF `/auth/sign-out`; header/footer links and root layout. Use auth-configured boolean only; never send server secrets to clients.
- [x] Make the existing sign-out route validate returned/thrown provider errors before recording success and returning 204. Keep actor/CSRF checks, local scope and cookie deletion.
- [x] Eleven focused tests and all 188 unit tests pass; lint, typecheck and production build pass.

## 3. Acceptance and delivery (CLASS-011..016)

- [x] Extend synthetic first-name browser flow with administrator entry/tabs and student logout. Six new desktop/mobile navigation/waiting/projector tests pass locally against the production build; mocked read responses create no attempts. The real Auth/roster extension runs in isolated CI.
- [ ] Run unit/type/lint/build/security/SDD gates and full CI, including existing database/realtime/load assertions. No academic bank or real-student gameplay writes.
- [ ] Update runbook/evidence, commit/push on current branch, update PR9, deploy only the existing class project and verify uploaded source/alias. Leave the official event prepared and unopened; keep a proof screenshot and report remaining onsite checks.
