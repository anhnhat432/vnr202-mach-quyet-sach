# Classroom navigation and session acceptance — 2026-11-01

T119; requirements CLASS-011..016 in `../specs/classroom-navigation-session.md`; plan `../plans/2026-11-01-classroom-navigation-session.md`. Work continued on `codex/classroom-readiness`; no merge, migration, academic publication, real gameplay test or official Open.

## Automated evidence

- Red: the old waiting hook never made a second lobby read; the provider-error logout returned 204; administrator lobby cards exposed unusable student-start links. Green after implementation: 41 unit files / 190 tests, typecheck, lint and production build.
- [Full code CI 41268379408](https://github.com/anhnhat432/vnr202-mach-quyet-sach/actions/runs/41268379408), source `d5880a5ce1d0149b373d4ddc88835e053186b342`: all three jobs pass. Database: six pgTAP files / 149 assertions; integration: ten files; browser: 50 pass / 12 configured skips, plus production offline checks. Secret and SDD checks pass.
- Six new local desktop/mobile production-browser cases pass for visible administrator entry, lobby waiting-to-open, manual game refresh and projector waiting-to-open. The subsequent intro return-link assertion also passes on both viewports. Mocked read responses never start an attempt.
- Real Auth/roster CI test now navigates from the public account bar through administrator tabs, imports one synthetic pending-name account, completes private name setup, checks abbreviated identity, confirms logout and verifies `/me` becomes 401. No actual student is used.
- Final isolated load: 70 Completed, one attempt per player/game, no duplicate submission, ledger/board match, 72 subscribed channels, zero channel/request errors. Duplicate replies match 32/32; transfers 9/9 reject all old devices. F5 observations: 32 probes, 23 same-content/decreasing-deadline observations; clocks continue and expired interactions may settle during refetch. Local-CI p95 start 3471ms, submit 3177ms, Top 10 propagation 994ms (p99 1142ms). These are functional test results, not hosted latency certification.

## Hosted acceptance

- Existing class alias https://vnr202-preview.vercel.app serves READY deployment `dpl_GHqdkXmTD3VvrjNtpG2tgNACsjHw`, exact source `d5880a5ce1d0149b373d4ddc88835e053186b342`, runtime `icn1`. Nine uploaded source hashes match local files: header/account bar, admin layout/navigation, visible refresh/game hook, lobby/projector and sign-out route.
- Clicked the new header **Quản trị** entry in the existing authenticated browser session. Verified competition page, **Danh sách lớp** and **Ngân hàng câu hỏi** navigation and active-tab markers. Account indicator and logout button render the classroom name/role. No new credential entry or real-session logout was needed; complete sign-out is demonstrated in isolated CI.
- Authorized read-only roster comparison: 45 total profiles, all 39 supplied IDs present/active, missing 0, six DEMO profiles locked, other active profiles 0. Only aggregate counts were saved outside Git; no roster IDs/names entered committed evidence.
- Selected official **VNR202 · Buổi chơi 02/11/2026** for handoff: still prepared, admission duration 60, zero attempts/board entries. An unrelated newer rehearsal Draft was left untouched.
- Public checks: homepage 200 with administrator entry/login links and no shared administrator identity; protected page redirects to administrator login; anonymous administrator/owner APIs return 401. Current public competition is null and both official boards have zero players/entries.
- Hosted projector displays **Đang chờ giảng viên mở cuộc thi.** in single-game mode. The official event was never opened for this check. Proof screenshots and source/aggregate JSON are in the private external artifact folder.

## Rule trace and safety

| Rule | Implementation / checks |
|---|---|
| CLASS-011 | Header/footer entries, admin layout/navigation; browser entry and real Auth navigation tests; hosted clicks. Existing server role guards retained. |
| CLASS-012 | `use-visible-refresh`, lobby and pre-start game refresh; hidden/offline/overlap/cleanup tests, late-waiting-result guard after Start, manual/focus coalescing and browser opening discovery. No automatic start/transfer. |
| CLASS-013 | Visible current-competition refresh and explicit projector waiting prop; both browser viewports and hosted waiting screen. |
| CLASS-014 | Account bar renders only verified displayName/role, no shared SSR identity/storage; path-bound state, aborted stale requests and focus revalidation. Name/full-name/ID redaction assertions. Fullscreen games retain their existing layout; return to lobby to switch accounts. |
| CLASS-015 | Existing CSRF request client; student confirmation/cancel, 204 navigation, visible failure, returned/thrown provider errors and pre-mutation CSRF checks. Provider success precedes successful sign-out audit; no timer/score/attempt changes. Contracts/OpenAPI updated. |
| CLASS-016 | Existing official state and roster verified read-only. No question review/publication or Open; no new dependencies/schema. |

Remaining onsite work: classroom Wi-Fi/4G/projector check and the organizer's actual Open click. The existing bank is sufficient for play; optional expansion to the low-exposure target still needs human academic review/publication.
