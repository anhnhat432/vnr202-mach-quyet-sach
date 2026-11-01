# Classroom navigation, waiting and session controls

Owner approved implementation on 2026-11-01 after the readiness review. Task T119. Hybrid / Standard: existing Auth and Arena contracts remain Core; navigation and their client presentation are bounded Shell work. Continue on the current branch, without another phase approval or merge.

## Decisions

Use existing `/me`, `/auth/sign-out`, lobby and current-competition endpoints. Client identity keeps public pages cacheable and renders no private identity in shared server HTML. A new session endpoint would unnecessarily expand the API; making the whole public layout depend on server cookies would remove its static-cache benefit.

## Requirements

- CLASS-011: Header and footer expose a clear administrator entry. Protected pages continue to enforce server authorization. Administrator pages have responsive links to competition, roster and question bank, with the current page identified. Login itself remains uncluttered.
- CLASS-012: A visible authenticated lobby and pre-start game screen re-read authoritative state at most once per ten-second polling tick, and on focus/online/visibility recovery. Provide manual refresh. Hidden/offline pages do not poll; requests do not overlap within a refresh source. Waiting refresh never creates/transfers an attempt or overwrites a playing attempt with an older waiting response. Reset a pending start idempotency key when the competition changes before starting.
- CLASS-013: The projector distinguishes waiting for an unopened competition from loading a request; it picks up opening within ten seconds of visible polling, or on focus. Single-game and two-board modes remain unchanged.
- CLASS-014: A private session bar shows the authenticated classroom display name and role, never full name, MSSV or email. Read only the verified `/me` response, discard stale route/unmounted responses, and resync on focus. Anonymous/unconfigured visitors still have sign-in links. UI links do not grant permissions. Fullscreen games/projector keep their existing HUD; game intro/error screens provide a return to the lobby for account switching. An administrator in the lobby gets an admin entry, without unusable student-start/private-result links.
- CLASS-015: Logout uses the existing same-origin CSRF client and local-session endpoint. Students confirm that logout does not pause an active clock; cancel sends no mutation. Success clears the rendered private page through full navigation to the appropriate login. Failures remain visible without a false success or an automatic unknown-outcome retry. Server provider failures return sanitized 503, do not report 204, and do not write a successful sign-out event. Successful sign-out remains audited. No score, attempt, deadline, credentials or role is modified by these UI changes.
- CLASS-016: Preserve the prepared real event, its 93 snapshots, 39 accounts and zero test attempts. No real question review/publication or automatic Open. Wi-Fi testing remains onsite; no new academic questions are included in this task.

## Verification

TDD covers visible polling, offline/hidden guards, overlap, cleanup, session identity redaction, CSRF logout, cancellation, provider failure, and a late waiting response after Start. Desktop/mobile browser acceptance covers entry/administrator navigation, student setup then logout, and waiting-to-open UI using synthetic/mocked read responses without starting a real attempt. Run units, lint, typecheck, build, security/SDD checks and full CI; verify exact class deployment source and leave the official event unopened.
