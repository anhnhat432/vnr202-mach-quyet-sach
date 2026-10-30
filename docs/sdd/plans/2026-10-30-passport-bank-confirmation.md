# Student Passport and question-bank confirmation plan

**Goal:** Complete T025/T034 using real per-student progress and official results; enforce the owner-approved LA-CONTENT-014 acknowledgement at scheduling.

**Architecture:** Use a new migration and student-only server routes for progress; validate dossier IDs and real scenario state, preserve the latest completion independently of progress edits, and keep all private reads bound to the verified actor. Reuse the authoritative leaderboard projection for rank. Enforce bank readiness and acknowledgement atomically in PostgreSQL and record the exact assessed bank in the audit log. Use existing UI patterns for the Shell.

**Constraints:** No existing migration edits; no real roster data or secrets; only Published dossiers can be completed; no rehearsal or voided attempts in official history; no changes to game scoring; no hosted writes in tests.

1. Trace current dossier, identity and competition contracts; specify owner-bound progress and bank confirmation.
2. Write isolation, validation and history tests, then implement migrations, routes and UI for Passport. Verify local unit/build and isolated CI integration/E2E.
3. Write tests for mandatory bank blockers and explicit acknowledgement with audit; implement the atomic scheduling gate, API and admin UI; update LA-CONTENT-014 only after verification.
4. Capture Passport screenshot in an isolated demo environment; record remaining acceptance limits and CI evidence.
