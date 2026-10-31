# T117: grouped human review evidence

Scope: `QB-BULK-001..007`, approved owner choice on 2026-10-31. Base `6018e79` on `codex/vnr202-continuation`; delivery branch `codex/question-bank-bulk-review`.

## Local verification

- TDD red: 11 component cases failed before implementation (missing selection/confirmation and individual prompt cancellation).
- Green: final full unit suite passed 143/143, including malformed-success coverage; focused admin/race cases passed 13/13 before the additional case.
- ESLint, TypeScript and production Next.js build passed. No dependencies, migrations or server contracts changed.
- Draft tooling: 93 questions validated, zero errors/warnings; no academic transitions performed on those records.
- Repository secret scan: 367 tracked files including staged new files, zero findings; staged diff whitespace check passed.
- Additional global client-bundle identifier scan reports four matches: `correctOptionId` in two admin/post-final review chunks, `content_private` in the bank admin chunk, and `[GIẢ LẬP]` in an existing UI chunk. These identifiers/fixture labels predate this change (`6018e79`); this broad scan is not claimed passing. No server-secret identifier/value finding was reported. Existing authenticated API and gameplay response tests remain the relevant answer-privacy checks; the scanner was not weakened.

## Rule-to-proof mapping

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| QB-BULK-001 | Exact current-version selection; visible scope; fixture/retired exclusion; filter reset | Component selection/filter/stale-version tests |
| QB-BULK-002..003 | Separate Draft review / Reviewed publication confirmations; blank shared note and human attestation | Component confirmation, cancel, mixed-status tests; isolated browser flow |
| QB-BULK-004 | Existing session/CSRF transition endpoint and database checks unchanged | Component CSRF assertions; existing question-bank HTTP/integration tests; isolated browser reviewer/note/audit assertions |
| QB-BULK-005 | Sequential independent requests; per-question report; stop uncertain/auth outcomes; no retry | Partial failure, network/503, malformed response and expired-session component tests |
| QB-BULK-006 | Locked competing controls; ref submission guard; authoritative bank/readiness reload; discard stale rows | Serialization/double-submit and failed-reload component tests |
| QB-BULK-007 | Labelled checkboxes; existing individual actions; responsive admin CSS | Individual cancellation test; desktop/mobile isolated browser flow and overflow assertion |

## Remote verification and delivery

Pending final PR CI and hosted-preview smoke. The added browser test refuses hosted Supabase URLs and uses only temporary synthetic questions in the isolated CI stack. It verifies cancellation, shared notes, reviewer identity, separate publication and per-version review/publication audit. CI retains desktop/mobile screenshots for three days.

No merge, production-project deployment, schema update, real-bank review or real-bank publication is part of this delivery. Broader classroom load, reconnect and device-transfer behavior is unchanged and is not newly claimed by this UI feature.
