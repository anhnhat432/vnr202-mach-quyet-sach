# Question-bank grouped human review

Status: Approved scope by owner choice in chat, 2026-10-31. Method: bounded ADD around the existing Core governance contracts. Task: T117.

## Goal and boundary

An administrator can select several questions that they have already checked, enter one common academic note and explicitly review that group. Publication remains a separate explicit human action on Reviewed versions. AI does not operate either action on the real bank. No schema, RPC, API, authentication, state-machine or publication requirement changes.

## Acceptance checklist

- `QB-BULK-001`: Selection is opt-in, keyed by exact current version ID and limited to the bank rows currently displayed. Fixtures, retired versions and superseded versions cannot be selected. Select-all names its visible scope. Changing any filter clears selection and any pending confirmation.
- `QB-BULK-002`: Review targets only selected Drafts; publication targets only selected Reviewed versions. Each action displays its target count. There is no combined review-and-publish action or automatic publication.
- `QB-BULK-003`: Before grouped review, the human enters a common trimmed note of 1-500 characters and confirms that they checked the selected answers, explanations and sources. The note is not prefilled. Cancel sends no mutation. Publication has its own explicit confirmation.
- `QB-BULK-004`: Each mutation uses the existing session/CSRF-protected `POST /admin/question-versions/{id}/transitions`. The actor, source requirements, academic note enforcement, state transition and per-version audit remain authoritative on the server/database (`CONTENT-001..006`, `LA-CONTENT-003`).
- `QB-BULK-005`: The group is a sequence of independent transactions, not an atomic batch. Show progress, succeeded/failed/uncertain/unprocessed counts and a per-version report. Validation/state failures do not hide successful siblings. A network/5xx/malformed-success response stops the remaining queue as uncertain; 401/403/404 stops it as an authorization/session failure. Never automatically retry.
- `QB-BULK-006`: Lock filters, selection and competing row actions while a confirmation or operation is active; prevent duplicate submissions. Completion always clears selection and refetches the authoritative bank and readiness, including after partial failure. If reload fails, stale rows remain unavailable until a successful explicit reload.
- `QB-BULK-007`: Preserve the existing individual actions, keyboard-labelled controls, readable mobile layout, loading/empty/error states, fixture separation and answer privacy. Cancelling an individual note prompt also sends no mutation.

## Validation and traceability

Component tests exercise explicit confirmation, common notes, mixed statuses, stale versions, filters, cancellation, double submits, partial validation failures, unknown outcomes and reload failure. Desktop/mobile browser tests use temporary synthetic bank records in an isolated local Supabase stack, skip hosted database URLs and never mutate the real bank. Existing HTTP/integration governance tests retain the authorization/source/audit coverage. Run unit tests, lint, typecheck, build, secret scan, targeted desktop/mobile browser tests and PR CI; record hosted preview smoke without approving/publishing real questions.
