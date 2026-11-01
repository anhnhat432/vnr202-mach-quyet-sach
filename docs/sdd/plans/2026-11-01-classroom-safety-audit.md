# Classroom safety audit and load investigation

Goal: prepare the 02/11 session from current evidence, not an earlier green run. Continue PR9 on `codex/classroom-readiness`; root executes inline. No merge, Production deployment, official Open or academic review/publication.

1. [x] Compare failed run 41282363741/fb5b1c3 with green 41268379408/d5880a5. Preserve raw external artifacts. Application source is identical; 322 authentication errors, one duplicate-result failure/crash and 33 active attempts occur despite matching ledgers/boards and no duplicate submission.
2. [ ] Capture missing evidence: retain server output and bounded, credential-free Auth/cookie diagnostics in isolated CI. Do not retry away unknown failures or weaken the readiness assertion. Reproduce the causal failure before a fix; add regression tests, then verify the original load flow.
3. [ ] Read-only hosted audit: question review/publication actors and notes, source verification, frozen bank; official event/window/attempts/boards; roster aggregates; Preview/Production project/database separation. Record missing evidence explicitly; no academic action or hosted gameplay.
4. [ ] Reconcile T034/T115/T116/T118/T119 and Stage G with verified automated versus hosted/classroom acceptance. Extend organizer checklist for Wi-Fi, 4G and projector. Plan remaining 15 dossiers and academic/public-site gaps without claiming publication.
5. [ ] Run focused regressions and automated/security/SDD gates, commit/push to PR9, inspect new CI artifacts and report actual outcome and remaining Open conditions. No deploy or merge.

Investigation files: `scripts/load/arena-load.mjs`, `scripts/load/load-results*.mjs`, `.github/workflows/ci.yml`, `web/src/lib/api/guard.ts`, related Auth tests. Any business/API change requires an explicit contract update and failing test first. Server diagnostics contain only bounded provider status/code, never messages, tokens, passwords or identities. Load diagnostics are local-only and bounded.
