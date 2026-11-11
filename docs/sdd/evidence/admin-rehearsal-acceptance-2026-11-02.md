# Admin Control Center / Rehearsal Studio acceptance — 2026-11-02

Scope: continue the Antigravity handoff on `feat/admin-control-center`, PR [#10](https://github.com/anhnhat432/vnr202-mach-quyet-sach/pull/10). Baseline `b3737015a67e3ec825f8ea385b82bcf67edcaf66`. No merge, Production deployment, hosted migration, official Open, academic review/publication or real-student gameplay is authorized by this acceptance run.

Plan: [2026-11-02-admin-rehearsal-acceptance.md](../plans/2026-11-02-admin-rehearsal-acceptance.md). Core references: `core-platform-spec.md` §16, `live-arena-game-spec.md`, ADR-004, Constitution. This correction changes test orchestration only; it introduces no new Core contract.

## Actual handoff and CI failure

The local Antigravity transcript ends after committing and pushing `b373701` and copying seven live screenshots. Its local serial browser run reports 51 passed / 13 skipped. Those results were not treated as evidence that remote CI was green.

[CI 41396232968](https://github.com/anhnhat432/vnr202-mach-quyet-sach/actions/runs/41396232968), at that exact SHA:

- `web`: passed, including lint, typecheck, unit tests, production build and production-mode offline reload.
- `security-scan`: passed.
- `database`: reset, 175 pgTAP assertions, 134 integration tests and production-mode 70-player load passed; the browser step failed with 49 passed / 13 skipped / 1 failed / 1 not run.
- The failing browser test is `arena-ui.spec.ts`, "leaderboards resync from the API without reload, survive going offline, and show display names only". It expected a score greater than 200 and continued receiving 200.

### Root cause from the retained trace

Artifact `browser-failure-diagnostics`, ID `13119803656`, contains the original failing trace. Its synthetic player's network responses show:

1. At 05:56:40.181 UTC, question 7 content has **220 ms** left. The fixture prompt says to choose C.
2. Question 7 expires; at 05:56:41.968 UTC, question 8 content is delivered, with **6719 ms** left and a fixture prompt requiring A.
3. At 05:56:42.551 UTC, the test submits to question 8. The authoritative response is HTTP 200, `outcome: incorrect`, `awardedPoints: 0`, `scoreAfter: 200`.

The test reused student 0's timed attempt after several earlier reconnect/transfer and minefield scenarios. Prompt lookup and option click crossed the question transition. The board correctly retained the unchanged committed score; increasing the leaderboard poll timeout would not repair the incorrect answer.

### Bounded correction

The leaderboard scenario now warms its anonymous viewer and starts the previously unused synthetic student's fresh race attempt. It explicitly verifies the answer response is successful and correct, verifies its score is positive, and requires the viewer's board to converge to that **exact authoritative score** without reload. Offline/online recovery, display-name privacy and projector assertions remain.

Game deadlines, score rules, server state, synchronization implementation, test skip rules and the existing 12-second board assertion budget are unchanged. The scenario also passes in isolation, removing its dependency on earlier tests having created student 0's board row.

Visual inspection also found the desktop screenshot capturing the sticky public header mid-page. The app has global `scroll-behavior: smooth`; the test's `window.scrollTo(0,0)` therefore returned before reaching the top. Screenshot setup now explicitly uses `behavior: instant`. This is a capture-only change, not a product CSS change.

## Fresh local evidence

Local-only runner checks both Supabase endpoints are on `127.0.0.1`, inherits no hosted credentials, and generates disposable server secrets in process memory. Supabase CLI is pinned to CI's 2.115.0. Docker Engine 29.9.2 runs the actual PostgreSQL/Auth/REST/Realtime stack.

- `supabase db reset --local`: passed from the handoff migration set.
- `supabase test db`: **175/175** assertions passed; 7 files.
- Full Rehearsal Studio closed-loop scenario on the handoff: **1 passed**, 78.81 seconds command time. This independently exercises both games, both boards, reset/history preservation and mobile/desktop screenshots.
- Corrected leaderboard scenario in isolation: **1 passed**, 21.25 seconds command time.
- Complete local browser suite after the leaderboard correction: **51 passed / 13 configured skips**, 333.6 seconds command time; no failures. The subsequent capture-only correction is checked by rerunning the complete rehearsal scenario and by final CI.
- Complete rehearsal scenario after the capture correction: **1 passed**, 62.96 seconds command time; desktop/mobile screenshots visually inspected. Instant scrolling fixes the misplaced sticky header without changing UI styling.
- Local full ESLint, TypeScript, repository secret scan (**424 tracked files, 0 findings**), SDD consistency (**0 errors**) and whitespace checks pass.
- The full-suite and final gate results for this correction are recorded in the PR's validation handoff and exact-head CI checks; do not substitute an earlier green run.

Logs and downloaded failure artifacts remain outside Git in the temporary `vnr202-antigravity-continuation-20261102` directory. Raw traces can contain disposable local session material; they are not committed.

The seven final screenshots are copied to ignored `.local/acceptance-2026-11-02/` for local review: `admin-rehearsal-desktop.png`, `admin-rehearsal-mobile.png`, `admin-overview-desktop.png`, `admin-overview-mobile.png`, `admin-roster-desktop.png`, `admin-bank-desktop.png`, `admin-official-modal-desktop.png`. Current CI also uploads these under `rehearsal-studio-e2e-screenshots` for the exact pushed head.

## Owner acceptance traceability

| Owner requirement | Implementation | Verification |
|---|---|---|
| Existing `course_chapter` enum and exact engine allocation signature | `202611010001_rehearsal_isolation.sql`, `eligible_questions(game_type,text,uuid)` | Schema/overload assertions in `supabase/tests/rehearsal_isolation.sql`; real migration reset |
| Fixture-only rehearsal pools and snapshots; bank-only official pools | `eligible_questions`, `take_competition_snapshot`, snapshot isolation trigger | pgTAP isolation checks; `arena-admin.test.ts`; closed-loop E2E inspects snapshot origins |
| Trial accounts fail closed and never join the real roster or official game | `rehearsal-service.ts`, immutable `is_rehearsal` flag and attempt trigger | `admin-control-center.test.tsx`; pgTAP; integration; browser roster/THU assertions |
| Disclose only displayed official questions, once | `mark_competition_answers_disclosed` | pgTAP checks rehearsal/no display/displayed official cases; existing integration coverage |
| Legal Scheduled/Open/closed/repeated reset, retaining old results/audits | `reset_rehearsal_competition` | pgTAP; real integration; browser reset checks previous attempts/audit and fresh empty boards |
| RBAC, CSRF, invalid input/state, network retry | Admin routes and existing service authorization | Closed-loop E2E checks 401/404/403/422, invalid close, abort/retry recovery |
| Browser consistency, recovery and public privacy | Existing authoritative game/board APIs and UI | Corrected Arena UI scenario; remaining full-suite and exact-head CI gates |
| Hosted Preview has its own verified sandbox DB | Deployment/environment configuration | **Blocked**, details below; localhost/CI evidence is not hosted acceptance |

## Load evidence and practical limits

The failed-browser CI still ran the independent production-mode load step. Artifact `classroom-load-70`, ID `13120295694`, records **70 completed attempts**, 35 per game, 72/72 subscribed channels, no request/channel errors, ledger/score and board/attempt agreement, no duplicate submissions, and 30/30 identical duplicate replies. Top-10 propagation p95 was **959 ms**, with a CDN stand-in and paced authentication (20 accounts per batch, 30-second pauses).

This is CI synthetic evidence, not a measurement on the classroom network or a certification of hosted Supabase/Vercel quotas. T057/T062/T066 and the separate academic/onsite checks are not closed by this result.

## Hosted Preview blocker, verified read-only

The previously handed-off [Preview](https://vnr202-mach-quyet-sach-hzudn9v8g-anhnhat432s-projects.vercel.app/quan-tri/cuoc-thi) is Ready at deployment `dpl_3dEJ4vn5uGy9FrHvBttjiQgvFuDi`, sourced from **9788646ae0843a52def55d60beafffca58f06c4e**, not the current PR head.

Vercel's project/environment APIs were read without mutating settings, deployments or databases. They show:

| Vercel project | Environment | Supabase project |
|---|---|---|
| `vnr202-mach-quyet-sach` | Preview and Production | `srmdkhcafeeprvizqhvf` |
| `vnr202-preview` (class website) | Preview and Production | `gqooookpcuoqkyvjwtpp` |

Thus a Preview URL is not proof of a separate disposable database. The current code explicitly blocks rehearsal mutations from Preview against both protected project refs. No hosted mutation was used to test that boundary.

The authenticated Supabase dashboard lists only these two projects. Its New Project page blocks creation with the explicit account limit **2 active Free projects**. No project was created, paused, deleted or upgraded. A genuinely isolated hosted acceptance requires a separate sandbox supplied by the owner, or an owner-authorized plan/account decision. CLI management login is currently absent too; never ask for access tokens in chat.

Do not deploy or migrate this feature onto either existing hosted database to work around that blocker. The seven direct screenshots are local/CI synthetic acceptance evidence, not screenshots of a newly isolated hosted Preview.

## Four validation layers

1. Automated: see fresh local evidence and the correction's exact-head PR checks; retain the original failed run.
2. Spec: owner requirements map to migration/service/tests above; no Core rule change.
3. Constitution/safety: synthetic localhost/CI only, server-authoritative scoring, audit/history retained, no academic publication or hosted mutation in this continuation.
4. Acceptance: closed-loop local browser flow demonstrated; hosted isolated Preview remains **open** because no separate sandbox is available. No merge/release approval is claimed.
