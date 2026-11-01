# Classroom readiness evidence — 2026-11-01

Task T118; spec `../specs/classroom-readiness.md`; plan `../plans/2026-10-31-classroom-readiness.md`. The owner supplied 39 student IDs and requested first-login names and opening on demand. No real roster, passwords, private names or privileged credentials are stored here.

## Hosted state

- Class URL: https://vnr202-preview.vercel.app. Code source: `f976bb1f6eb1971e7f68efae5fbf3da0cf4a65ad`; class deployment READY, runtime region `icn1` near the existing Seoul database. Deployment metadata and seven uploaded source SHA1 values match the checkout, including both migrations, CSRF route/client, roster UI/CSS and its browser test. Uploaded untracked files were only generated Next declarations and Supabase CLI version metadata; no environment or private roster file was uploaded.
- Hosted migrations `202610310010` and `202610310011` were applied from exact checked-in source, recorded in the migration ledger and audited. Existing applied migrations were preserved.
- Hosted Auth sign-in/sign-up and token-refresh quotas were saved/reloaded as 300 per five minutes. Application IP/account protection remains unchanged. Login pacing remains necessary for the provider's separate burst bucket.
- Owner entered and confirmed the shared password locally; the helper updated only its existing server environment value. A freshly imported synthetic account authenticated successfully and completed name setup. The pepper and administrator credential were preserved. The helper did not save the entered value to a file or this evidence.
- Actual roster preview: 39 valid, zero warnings/errors. Apply: 39 created. SQL: 39 active student profiles, 39 pending first names, 39 matching confirmed Auth identities, missing IDs 0, extra IDs 0, real-student attempts 0. No actual student was used to create a test score.
- Official **VNR202 · Buổi chơi 02/11/2026**: Scheduled / “Đã chuẩn bị”; 93 bank snapshots, fixture snapshots 0, attempts 0, board entries 0. Open was not clicked. Default admission duration is 60 minutes from the eventual admin click.
- Hard content readiness passed for 39. The low-exposure target remains unmet: 20 additional questions in the reported difficulty/pool buckets would be needed. The operational acknowledgement/reason was saved for 39. This was an allocation decision; this task did not review or publish academic questions.
- Old rehearsal is archived with four historical attempts preserved; its class is inactive and all six synthetic profiles are locked. A proposed new hosted rehearsal was rejected by a transaction guard because rehearsal snapshots may also include published bank content. All setup changes rolled back before Open or any attempt. Both-game smoke/reconnect/transfer/load therefore run in the isolated test stack, without exposing the class bank for a test.
- Anonymous checks: public/login/admin-login/projector pages 200 with no SSO redirect; admin students API 401. Both official board APIs return 200, zero players/entries and no roster fields/IDs. Current public competition is null until Open.

## Rule-to-validation trace

| Rules | Implementation and evidence |
|---|---|
| CLASS-001/002 | Roster domain/service/UI; explicit IDs-only checkbox; unit tests; desktop/mobile `student-name.spec.ts`; hosted preview/apply and exact roster SQL counts. |
| CLASS-003/004 | First-name page, authenticated CSRF-protected owner route and migration 0010; domain/route tests, pgTAP and browser name setup/replay/privacy checks. Hosted synthetic setup: missing CSRF 403, ID-as-name 422, save 200, replay 409, abbreviated public name. |
| CLASS-005 | Auth provider-error classification; unit coverage for 429, invalid credentials, retryable/network/5xx and administrator branch; hosted quotas saved independently. |
| CLASS-006 | Existing project/admin, stable class alias, source-hash proof, preserved history and explicit synthetic isolation. No academic review/publication or real competition Open. |
| CLASS-007 | `scripts/load/arena-load.mjs --players 70 --viewers 35 --paced-login --assert --cdn`; local-stack guard; 20 sign-ins per group, 30-second gaps, then concurrent play. Functional assertions retain deadline/session rejection checks. |
| CLASS-008 | Vietnamese `docs/classroom-runbook.md`; verified projector URL values are `minefield`/`race`, with keyboard shortcuts 1/2/0. Closing admissions also blocks the second game if not yet started. A new competition gives fresh boards/attempts while preserving old history. |
| CLASS-009 | Service-only atomic opener in migration 0011, route tests and 13 pgTAP checks; existing bank gates/replay protection; hosted Scheduled/zero attempts proof. |
| CLASS-010 | Same-origin authenticated CSRF renewal route/client and multipart roster integration; 13 focused unit checks, actual browser import after cookie removal and hosted retained-session recovery. Offline simulator updated to model renewal. |

## Automated validation

- Local: 36 unit files / 177 tests, typecheck, lint and production build pass; secret scan and SDD consistency check pass.
- Mobile regression: actual component/CSS with a synthetic preview reproduced a 576px document on a 412px screen and a blocked apply click. After the fix, width is 412px and the click succeeds. The real browser test also asserts document width and uses a normal click.
- [Full CI 41264590131](https://github.com/anhnhat432/vnr202-mach-quyet-sach/actions/runs/41264590131) at code source f976bb1: all three jobs pass. Database: six pgTAP files / 149 assertions; integration: ten files pass; browser: 44 pass / 12 configured skips; additional production offline reload: four desktop checks pass. The name-import flow passes on desktop and mobile with normal clicks and the viewport assertion.
- Final load artifact: 70 concurrent synthetic players split between the games, 70 Completed, 72/72 board subscriptions, zero channel/request errors, one attempt per student/game, zero duplicate submissions, and matching score ledger/boards. F5 retained the same question/deadline 29/29 times, duplicate replies matched 25/25, offline gaps 18, transfers 9/9 with all old devices rejected. Two intentional deadline/session rejections were counted separately after state validation.
- Final local-CI latency: p95 start 2804ms, submit 2079ms, content after release 1254ms, Top 10 propagation 992ms (p99 1105ms). These are measured values, not a claim that all performance targets pass.
- Hosted projector checks: `game=minefield` opens Bãi Mìn; buttons switch to Race and Both with one/two rendered boards respectively. Generated student-login QR was independently decoded to the verified public sign-in URL.

## Practical limits

The 70-player check is functional capacity evidence on a local CI stack, with a CDN stand-in and paced authentication. It is not a hosted latency certification or a classroom Wi-Fi measurement. Retain raw metrics rather than claiming all performance targets pass. Test the actual classroom Wi-Fi/4G/projector before opening the official event. Academic additions and any publication remain human work.
