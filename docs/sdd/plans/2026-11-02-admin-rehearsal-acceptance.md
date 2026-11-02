# Admin Control Center and Rehearsal Studio acceptance continuation

> Execution: root agent works inline on the existing `feat/admin-control-center` branch, preserving the handoff. Follow `executing-plans` task by task; no delegation is required.

**Goal:** Finish the owner's pending PR #10 acceptance with reproducible tests, direct screenshots and truthful deployment/database provenance.

**Architecture:** Keep the approved server-authoritative PostgreSQL/Auth/Realtime contracts and the existing admin interface. Correct the browser test's inherited timed-attempt dependency; no production gameplay or schema change is planned.

**Stack:** Next.js/TypeScript, Supabase PostgreSQL/Auth/Realtime, Vercel, Playwright. Use Supabase CLI 2.115.0 as pinned in CI.

## Constraints and scope

- Continue from `b373701`; keep the current branch and unrelated work.
- No merge, Production deployment, hosted migration, official Open, real-student gameplay, or academic publication.
- Synthetic mutations run only against localhost Docker/CI. Do not use the existing hosted Preview as a disposable sandbox.
- Do not change game deadlines, score/rank authority, answer secrecy, test success thresholds, or existing skip rules.
- Preserve failing CI trace/load evidence outside Git; commit no tokens, provider keys, roster or temporary passwords.

## Tasks

- [x] Recover the Antigravity handoff, latest commit and exact owner scope from its local transcript; verify PR #10 head.
- [x] Inspect CI 41396232968 at `b373701`: web/security/database logic pass; browser fails because the leaderboard test submits an incorrect answer after its inherited question changes. Preserve the trace and load artifact.
- [x] Independently reset the local database, pass 175 pgTAP assertions, and pass the full Rehearsal Studio closed-loop browser scenario with desktop/mobile screenshots.
- [x] Correct `web/tests/e2e/arena-ui.spec.ts`: warm the viewer, use the unused synthetic student for a fresh race attempt, assert a correct committed answer, then assert the viewer reaches the exact authoritative score without reload. Retain offline recovery/privacy/projector checks. The isolated scenario and full suite pass.
- [x] Correct only the screenshot setup in `web/tests/e2e/rehearsal-studio.spec.ts`: override global smooth scrolling with an instant scroll to the top before captures, rerun the rehearsal scenario and inspect the resulting images. The full scenario passes and the sticky header is correctly positioned.
- [x] Verify the corrected full browser suite with one worker (51 passed / 13 configured skips), targeted scenarios, local lint/typecheck/security/SDD checks and live screenshots. Final unit/build/integration/load checks also run against the pushed correction in CI.
- [x] Record rule/test/evidence traceability and the hosted-preview blocker in `docs/sdd/evidence/admin-rehearsal-acceptance-2026-11-02.md`, with a TASKS.md entry.

**External completion gate:** commit/push this bounded correction and update the existing PR. The final remote CI result and exact source SHA are recorded in the PR validation handoff/checks rather than causing another documentation-only CI loop. Do not merge. The hosted Preview gate remains blocked below regardless of a green code CI.

## Deployment evidence and blocker

Read-only Vercel API checks on 2026-11-02 establish that deployment `dpl_3dEJ4vn5uGy9FrHvBttjiQgvFuDi` is Ready but sourced from `9788646`, older than the handoff. The main project's Preview and Production configurations both select the same Supabase project. The class project's separate Supabase database is also shared between that project's Preview and Production configurations. Neither is a disposable third database.

The logged-in Supabase dashboard lists exactly those two projects. Its New Project page explicitly blocks creation because the account has reached its two-active-Free-project limit. CLI management credentials are also absent. A hosted isolated Preview therefore remains blocked until the owner supplies a separate sandbox or authorizes an account/plan change; do not pause/delete either existing project or purchase an upgrade automatically.

## Validation commands

- Local Supabase `db reset --local`, `test db` with localhost-only environment guards.
- `npm --prefix web test`, `npm --prefix web run lint`, `npm --prefix web run typecheck`, `npm --prefix web run build`.
- `npx playwright test tests/e2e/arena-ui.spec.ts --project=desktop-chromium --workers=1` and the full suite with `CI=1`, `E2E_REALTIME=1`, generated local-only secrets.
- `node scripts/security/scan-secrets.mjs`, `node tools/sdd/check-live-arena-docs.mjs`, `git diff --check`.
- Full CI on the pushed PR head, including production-mode 70-player load and retained screenshots/traces.
