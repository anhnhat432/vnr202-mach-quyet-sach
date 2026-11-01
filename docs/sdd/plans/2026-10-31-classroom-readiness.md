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
- [x] Run full local gates: 36 unit files / 177 tests, typecheck, lint, production build and staged-file secret scan. Added a paced-login, concurrent-play 70-player gate using the isolated local Supabase stack. Full final CI tracked below.

## 3. Hosted preparation (CLASS-006..008)

- [x] Save/reload hosted Auth 300/300 limits; preserve pepper/admin. Owner entered the shared password through the secure local helper; fresh synthetic account authenticated and completed name setup. Previewed/imported 39 actual IDs; SQL confirmed 39 active pending-name profiles, 39 matching Auth identities, no missing/extra IDs and no actual-student attempts.
- [x] Deploy to existing class project at the stable public URL with application auth intact. Code deployment f976bb1 is READY in icn1; exact commit and seven uploaded source hashes match. Anonymous pages return 200; protected admin API returns 401.
- [x] Archive the old synthetic rehearsal, preserve four attempts and lock six test accounts/inactivate their class. Demonstrate games, reconnect/device transfer and realtime/projector against the isolated CI stack; hosted name setup and public projector are checked separately. A new hosted rehearsal was aborted atomically when its snapshot included real bank content, before Open or any attempt; rollback verification is recorded. This avoids disclosing the official bank merely for automated smoke testing. Academic publication and classroom Wi-Fi remain human inputs.
- [x] Write Vietnamese class-day instructions and privacy-safe `evidence/classroom-readiness-2026-11-01.md`. Commit/push on the existing branch and deliver stacked PR9 against `codex/question-bank-bulk-review`; do not merge. Remaining onsite input is classroom Wi-Fi/projector verification and the actual Open click.

## 4. Open on demand (CLASS-009)

- [x] Owner clarification: no advance event time; admission starts from the actual admin Open click. Record explicit Core amendment and backwards-compatible API option.
- [x] Route TDD red 422 before implementation, then green; add server-only atomic opener reusing confirmed bank gates, bounded minutes, audit and replay protection. UI says "Đã chuẩn bị" and defaults to 60 minutes on Open.
- [x] Run the new pgTAP contract and browser admin flow in CI. Hosted official competition is Scheduled with 93 bank snapshots, zero fixture snapshots, zero attempts and zero board entries; assessment is saved for 39 and the Open window defaults to 60 minutes.

Load correction: CI's first 70-player run completed all 70 with matching ledger/board and 72 subscribed channels, but classified intentional deadline/device rejections as request errors. Rejections are now separately counted only after authoritative projection confirms settlement, or a deliberately transferred session receives exactly stale_session. Unknown failures remain fatal. Keep raw latency metrics; the local CI run is not a hosted latency certification.

## 5. Browser restart recovery (CLASS-010)

- [x] Observed hosted roster request rejected by CSRF after browser restart, despite a valid durable Auth session. Sign-in issues only a session CSRF cookie; there was no recovery path.
- [x] TDD red: missing endpoint and three failing client assertions; then 13 focused checks green for actor/origin binding, valid-cookie reuse, multipart preservation, coalesced renewal, one bounded pre-write rejection retry and no unknown-outcome retry.
- [x] Add authenticated same-origin token renewal and use the shared request client for roster forms. Update the isolated browser test to remove the form cookie before uploading/applying through the actual UI.
- [x] Complete local gates, deploy, and demonstrate recovery/import on the existing admin session without another password prompt. Update the offline Passport simulator for the authenticated renewal contract; its eight desktop/mobile local production checks pass.

## 6. Mobile import regression and final evidence

- [x] Investigate the final mobile import failure: a wide preview table expanded a 412px layout to 576px and blocked the apply click after scrolling. Reproduce using the actual component and CSS with a synthetic preview; contain the table in an accessible scroll region and bound form controls. The same diagnostic is now 412px and clickable. Extend the real import E2E with a viewport-width assertion and preview screenshots; no forced clicks or weaker authorization.
- [x] Final CI 41264590131 passes all three jobs: 149 pgTAP assertions, ten integration files, 44 browser passes / 12 configured skips, 177 unit tests, production checks and 70-player functional load. Deliver evidence/runbook and ready stacked PR9; do not merge. Latency and classroom-network limitations remain explicit.
