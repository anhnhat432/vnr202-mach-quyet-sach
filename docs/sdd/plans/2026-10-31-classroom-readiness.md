# Classroom readiness implementation plan

Goal: deliver a usable class deployment for 2026-11-02, with the supplied 39 students entering their names at first login and capacity preparation up to 70.

Architecture: retain existing Auth/roster/arena contracts; add opt-in pending-name onboarding and a database-enforced attempt gate. Preserve academic governance. Root agent executes inline under the owner's continuous authorization; no additional phase approvals or merge.

## 1. Core onboarding (CLASS-001..004)

- [x] Add failing roster tests: MSSV-only mode accepted only when opted in, marks pending names, preserves duplicates/numeric warnings and existing named imports.
- [x] Add name contract/domain tests for whitespace, abbreviations, control characters, length and ID rejection; add migration tests for pending-name attempts, owner validation, one-time save, duplicate suffixes and audit.
- [x] Add migration `202610310010_student_display_name_setup.sql`; extend roster row persistence/import mode and profiles; add CSRF-protected owner endpoint and setup page. Guard new attempts in the database. Update login response/client redirect and lobby recovery.
- [x] Add isolated desktop/mobile browser test: import IDs-only, sign in, direct attempt blocked, name save, replay rejected, public name redacted; preserve existing routes and named imports. CI 41213849579: 44 browser tests passed, 12 intentional skips; load assertion required a separate classifier correction.

## 2. Auth resilience and checks (CLASS-005)

- [x] Adopt the four pre-existing auth/script edits without overwriting unrelated work; extend failing tests for network-only, 5xx-only, admin failures and meaningful login messages.
- [x] Return sanitized service-unavailable errors and show correct 429/5xx messages; retain all account/IP limits.
- [ ] Run full local gates; secret scan includes staged new files. CI runs database, integration and browser suites; add a paced-login, concurrent-play 70-player synthetic load gate using the local stack and existing load harness.

## 3. Hosted preparation (CLASS-006..008)

- [ ] Verify/update hosted Auth settings; preserve pepper/password/admin. Import supplied roster through the verified admin flow after preview.
- [ ] Deploy to existing Vercel class project, provide a stable public URL with application auth intact, and verify exact source SHA and unauthenticated accessibility.
- [ ] Reconcile/archive old synthetic rehearsal if needed; demonstrate a new isolated rehearsal, both games, reconnect/device transfer and projector. Real question review/publication and classroom Wi-Fi/time remain human inputs.
- [ ] Write Vietnamese class-day instructions and a privacy-safe readiness/evidence checklist. Commit/push, open stacked PR against `codex/question-bank-bulk-review`, do not merge. Report actual completion and remaining human academic/event inputs.

## 4. Open on demand (CLASS-009)

- [x] Owner clarification: no advance event time; admission starts from the actual admin Open click. Record explicit Core amendment and backwards-compatible API option.
- [x] Route TDD red 422 before implementation, then green; add server-only atomic opener reusing confirmed bank gates, bounded minutes, audit and replay protection. UI says "Đã chuẩn bị" and defaults to 60 minutes on Open.
- [ ] Run the new pgTAP contract and updated browser admin flow in CI; verify the hosted prepared competition remains unopened.

Load correction: CI's first 70-player run completed all 70 with matching ledger/board and 72 subscribed channels, but classified intentional deadline/device rejections as request errors. Rejections are now separately counted only after authoritative projection confirms settlement, or a deliberately transferred session receives exactly stale_session. Unknown failures remain fatal. Keep raw latency metrics; the local CI run is not a hosted latency certification.

## 5. Browser restart recovery (CLASS-010)

- [x] Observed hosted roster request rejected by CSRF after browser restart, despite a valid durable Auth session. Sign-in issues only a session CSRF cookie; there was no recovery path.
- [x] TDD red: missing endpoint and three failing client assertions; then 13 focused checks green for actor/origin binding, valid-cookie reuse, multipart preservation, coalesced renewal, one bounded pre-write rejection retry and no unknown-outcome retry.
- [x] Add authenticated same-origin token renewal and use the shared request client for roster forms. Update the isolated browser test to remove the form cookie before uploading/applying through the actual UI.
- [ ] Complete full gates, deploy, and demonstrate recovery on the existing admin session without another password prompt.
