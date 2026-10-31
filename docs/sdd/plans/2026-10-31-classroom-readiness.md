# Classroom readiness implementation plan

Goal: deliver a usable class deployment for 2026-11-02, with the supplied 39 students entering their names at first login and capacity preparation up to 70.

Architecture: retain existing Auth/roster/arena contracts; add opt-in pending-name onboarding and a database-enforced attempt gate. Preserve academic governance. Root agent executes inline under the owner's continuous authorization; no additional phase approvals or merge.

## 1. Core onboarding (CLASS-001..004)

- [ ] Add failing roster tests: MSSV-only mode accepted only when opted in, marks pending names, preserves duplicates/numeric warnings and existing named imports.
- [ ] Add name contract/domain tests for whitespace, abbreviations, control characters, length and ID rejection; add migration tests for pending-name attempts, owner validation, one-time save, duplicate suffixes and audit.
- [ ] Add migration `202610310010_student_display_name_setup.sql`; extend roster row persistence/import mode and profiles; add CSRF-protected owner endpoint and setup page. Guard new attempts in the database. Update login response/client redirect and lobby recovery.
- [ ] Add isolated desktop/mobile browser test: import IDs-only, sign in, direct attempt blocked, name save, replay rejected, public name redacted; preserve existing routes and named imports.

## 2. Auth resilience and checks (CLASS-005)

- [ ] Adopt the four pre-existing auth/script edits without overwriting unrelated work; extend failing tests for network-only, 5xx-only, admin failures and meaningful login messages.
- [ ] Return sanitized service-unavailable errors and show correct 429/5xx messages; retain all account/IP limits.
- [ ] Run full local gates; secret scan includes staged new files. CI runs database, integration and browser suites; add a paced-login, concurrent-play 70-player synthetic load gate using the local stack and existing load harness.

## 3. Hosted preparation (CLASS-006..008)

- [ ] Verify/update hosted Auth settings; preserve pepper/password/admin. Import supplied roster through the verified admin flow after preview.
- [ ] Deploy to existing Vercel class project, provide a stable public URL with application auth intact, and verify exact source SHA and unauthenticated accessibility.
- [ ] Reconcile/archive old synthetic rehearsal if needed; demonstrate a new isolated rehearsal, both games, reconnect/device transfer and projector. Real question review/publication and classroom Wi-Fi/time remain human inputs.
- [ ] Write Vietnamese class-day instructions and a privacy-safe readiness/evidence checklist. Commit/push, open stacked PR against `codex/question-bank-bulk-review`, do not merge. Report actual completion and remaining human academic/event inputs.
