# Phase 4G evidence — automated rehearsal, load, realtime, accessibility

Rehearsal competitions and synthetic `[GIẢ LẬP]` questions only. No Draft question is treated as
official; official competitions stay blocked by readiness until enough Published, academically
reviewed questions exist. **P2/P7 are not claimed**: everything below ran on one 4-core sandbox, not on
the classroom Wi-Fi, a real Supabase project or Vercel.

## G1 Realtime Broadcast reaches the browser

- Local harness now runs the Supabase Realtime service (`scripts/db/local-stack.sh`, gateway proxies
  `/realtime/v1` websockets); CI starts Realtime too and makes `tests/e2e/arena-realtime.spec.ts`
  mandatory (`E2E_REALTIME=1`).
- The spec captures the real WebSocket frame in a viewer browser: `leaderboard.changed` arrives with
  the envelope only (no name, score, id); the board re-reads the API ~240 ms later (debounce), both
  boards and the projector show "Trực tiếp".

## G2/G3 Load: 60 players + 200 viewers + projector (`scripts/load/arena-load.mjs`)

Production build (`next start`), real HTTP API, 30 Bãi Mìn + 30 Đường Đua players, think time
0.9–3.5 s, viewers emulating `use-leaderboard.ts`. `--cdn` stands in for the Vercel CDN (honours the
route's `s-maxage`, collapses concurrent misses). Realtime quotas set like the hosted plans.

| ms (p50 / p95 / p99) | Pro-like quotas + CDN | Free-like quotas + CDN |
| --- | --- | --- |
| cell open | 132 / 370 / 546 | 144 / 388 / 493 |
| answer submit | 139 / 372 / 479 | 143 / 378 / 535 |
| question content after release | 3 / 31 / 76 | 3 / 29 / 93 |
| F5 content re-fetch | 92 / 333 / 532 | 106 / 268 / 278 |
| device transfer | 150 / 169 | 134 / 422 |
| Top 10 propagation (score seen by player → visible on each viewer) | **429 / 946 / 1104** | 803 / **5075** / 9903 |
| channels subscribed / errors | 402 of 402 / 0 | 399 of 402 / 33 |
| origin board reads | 4 per second | 4 per second |

Invariants after every run: one attempt per player and game, never two active attempts, score equals
the ledger, board equals attempts, no duplicate submission, all 60 attempts ended.

Chaos inside the load run (8 players): F5 mid-question 34/34 same question with a non-increasing
deadline; duplicate submit with one key 32/32 identical results; offline past the deadline → server
timeout and the game continues; device transfer 8/8, old device rejected 8/8.

Findings fixed in G:

1. Hints fanned out per scoring event (≈4,000 messages/s at 60 players × 200 viewers) — paced to one
   per second per game in the database; clients add a settle read (`realtime-contracts.md` §3).
2. `INSERT .. ON CONFLICT` scoring path bypassed the pacing (BEFORE INSERT fired first) — pgTAP covers it.
3. The trailing-reset debounce could starve the board under a constant stream — replaced by a non-reset
   schedule (≤ 2 reads/s) plus `?v=` CDN grouping; a forged high version is dropped, not polled.
4. Projector 1920×1080 cut rows 9–10 with full Top 10 boards — rows now share the available height.
5. 360×640 phones: title wrapped to four lines, score box clipped, answers below the fold during a 5 s
   question — compact top bar; question (race) and board (minefield) come first.

Without the CDN stand-in the same sandbox saturates (origin ≈ 200 board reads/s on one Node process;
submit p95 2.6 s). With Free-like quotas players are unaffected but hints are dropped above
100 messages/s, so Top 10 falls back to the 15 s sync (p95 ≈ 5 s).

## G4–G7 Browser checks (`tests/e2e/arena-quality.spec.ts`, `arena-ui.spec.ts`, `arena-admin.spec.ts`)

- A whole Bãi Mìn attempt with the keyboard only (arrows, Enter, A/B/C) under `prefers-reduced-motion`
  (no transition/animation in the game frame); Đường Đua played end to end in the admin rehearsal.
- axe WCAG 2.0/2.1 A+AA: no serious/critical violation on the minefield intro, board, question and
  finished screens, the race question on a phone, the leaderboards and the projector.
- No horizontal scroll at 360×640, 412×915, 1366×768, 1920×1080; answers ≥ 44 px and on screen at
  360×640; minefield cells ≥ 44 px; ten rows per board fit the projector with names ≥ 24 px.
- F5, offline banner + resync, explicit device transfer, leaderboard resync: existing `arena-ui.spec.ts`.

## Needs the real environment

- Classroom Wi-Fi/NAT with real phones (P2/P7): latency, reconnects, one public IP for the whole class
  (sign-in limit 300/10 min and board limit 3000/min per IP).
- Supabase plan: 201 realtime connections exceed the Free plan (200); measured Free-like quotas give
  Top 10 p95 ≈ 5 s. Pro (500 connections, 500 msg/s) or fewer live viewers is needed for the 1 s target;
  check the real project's quotas and message billing.
- Vercel CDN caching of `?v=` board reads, function cold starts and region latency to Supabase.
- Projector readability from the back of the room, real phone browsers (iOS Safari, low-end Android).
