# Question-bank grouped review implementation plan

**Goal:** Implement T117 so a human can review selected Drafts with one common note and separately publish selected Reviewed versions.

**Architecture:** Extend the existing client admin composition; send sequential calls to the existing per-version transition endpoint. Preserve server authorization, academic checks and audit; no schema or API additions. Use the current clean checkout on `codex/question-bank-bulk-review`, based on `codex/vnr202-continuation`.

**Stack:** Existing Next.js/TypeScript, React, Vitest/Testing Library and Playwright. No new dependencies.

**Spec:** `docs/sdd/specs/question-bank-bulk-review.md`, `QB-BULK-001..007`; retained Core `CONTENT-*`, `LA-CONTENT-003`.

## 1. Selection and human confirmation

- [ ] Write failing component tests in `web/tests/unit/question-bank-admin.test.tsx` for current-version selection, visible select-all, fixture/retired exclusion, filter reset, shared-note validation, explicit confirmation and cancellation.
- [ ] Run `npm --prefix web run test -- tests/unit/question-bank-admin.test.tsx` and verify failures for missing UI behavior.
- [ ] Add question/version shared types in `web/src/features/admin/ui/question-bank-types.ts`; update `question-bank-admin.tsx` selection and filters; add `question-bulk-actions.tsx` for the human form and report. Retain individual actions.
- [ ] Style labelled controls and the confirmation/report panel in `web/src/app/globals.css` using the existing admin tokens.

## 2. Execution, reconciliation and failure behavior

- [ ] Test separate status-specific actions, one request at a time, duplicate-submit prevention, partial failure, stop on unknown/auth outcome, no blind retry, current-version protection and reload failure.
- [ ] Implement sequential calls with exact version IDs and a shared note; require expected response status. Refetch the bank and readiness after every mutation group and discard selection. Clear stale rows before reload; offer explicit reload on failure.
- [ ] Confirm individual prompt cancellation does not mutate and readiness refreshes after individual transitions.

## 3. Verification and delivery

- [ ] Add desktop/mobile Playwright coverage with temporary synthetic records in an isolated local stack in `web/tests/e2e/question-bank-bulk.spec.ts`; never operate the real academic review/publication buttons.
- [ ] Run the targeted tests, full unit suite, lint, typecheck, production build, secret scan and relevant browser checks. Review the diff against every checklist item and existing governance guards. Use PR CI for the isolated Supabase integration suite if the local stack is unavailable.
- [ ] Record evidence under `docs/sdd/evidence/question-bank-bulk-review.md`; update T117 and traceability with actual results and any remaining limits.
- [ ] Commit, push, open a bounded PR against `codex/vnr202-continuation`, and deploy only to the existing Vercel preview project for user use. Never merge or deploy to the main production project in this task.

Owner chose selection with one common note for an already-checked group. The repository's continuous execution instruction authorizes this bounded workflow without additional phase gates. Implementation and verification stay on the root agent.
