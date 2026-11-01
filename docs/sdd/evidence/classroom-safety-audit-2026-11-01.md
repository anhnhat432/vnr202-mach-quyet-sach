# Classroom safety audit — 2026-11-01

Read-only hosted audit for the 02/11 session; PR9 / `codex/classroom-readiness`. No official Open, academic review/publication, real student gameplay, merge or deployment was performed. This report supersedes any inference that a previous green load certifies the latest commit.

## Latest failure versus historical green

| | d5880a5 / 41268379408 | fb5b1c3 / 41282363741 |
|---|---|---|
| Application source | Same | Same; documentation-only commit |
| Browser | 50 pass / 12 configured skips | 50 pass / 12 configured skips |
| Load terminal attempts | 70 Completed | 37 Completed / 33 Active |
| HTTP authentication errors | 0 | 322: content 155, submit 34, open 92, heartbeat 41 |
| Duplicate reply check | 32/32 | 31/32; one generic mismatch and undefined-data crash |
| Ledger / board / duplicate writes | Match / match / 0 | Match / match / 0 |
| Realtime channels | 72/72, errors 0 | 72/72, errors 0 |

Both original JSON artifacts were downloaded. The failed job log confirms the browser suite passed before the subsequent load command failed its assertions. The original workflow uploaded JSON/screenshots but omitted `classroom-load-server.log`; that historical server log is unavailable. Do not infer the upstream Auth cause, or a scoring/idempotency defect, from the aggregate counters. The harness dereferences `a.data.projection` even if a duplicate reply failed, which explains how an HTTP error can become a secondary TypeError. Diagnosis commit 0e6c377 retains server output and adds bounded, credential-free provider/status/cookie diagnostics; root-cause reproduction and a corrected load run remain required.

### Reproduction, fixes and diagnostic result

- Deterministic harness reproduction: the old duplicate path with a 401 response throws `TypeError: Cannot read properties of undefined (reading 'projection')`. The new assessor separates HTTP/Auth rejection, malformed success and a true result mismatch; it uses a successful projection only when present. All HTTP failures still fail readiness. Six Node tests pass, including 401/503 duplicate replies and actual differing score results.
- Deterministic product reproduction: five of eight focused Auth guard cases fail before the fix. Returned 429/503/retryable network errors were converted to 401; a thrown retryable error was not normalized; a failed control-session read was also converted to 401. Protected verification now returns sanitized 503 for these service failures, admits no actor and calls no service-role RPC. Missing/revoked sessions and invalid roles still return 401. All eight cases pass after the fix. No retry or cached-identity fallback is introduced; CLASS-005 and API contracts are explicitly clarified.
- [Diagnostic CI 41288363435](https://github.com/anhnhat432/vnr202-mach-quyet-sach/actions/runs/41288363435), source 0e6c377, is green: 70 Completed, zero request/channel errors, 72/72 channels, duplicate replies 25/25, transfers 9/9. Its retained server log proves `next start` was actually READY on port 3000, with no Auth rejection warning. Thus this run does **not** reproduce or explain the original 322 errors; it is not a root-cause closure.
- No original server log can be recovered from its JSON-only artifact. The upstream trigger behind that historical failure remains unproven. Keep T120 open even if a new load is green; future failures now retain timestamped status/code/name and bounded request/cookie diagnostics. No failure counter or acceptance threshold was relaxed. A CI step timeout also bounds a stalled diagnostic run.

## Academic governance

Fresh SELECTs in the authenticated Supabase SQL Editor for the class database show:

- 93 bank versions Published; all 93 AI-assisted, with reviewer/publisher/timestamps present. All 93 review actors match the owner's active administrator account; all 93 publishers match their reviewer. Review precedes publication in every row.
- Every version has a matching `question.review` audit for Draft → Reviewed and `question.publish` audit for Reviewed → Published: 93/93 in each case. Review window: 2026-10-31 09:40:22–12:37:30 UTC; publication: 14:00:25–14:02:05 UTC. The common review note is exactly `ok`.
- All 93 bank versions have source links and all linked sources are marked `verified`. Textbook source 0001 has 93 links; news/portal sources 0023/0024/0025 each have two links. The 87 old fixture versions are excluded from these bank-source counts.
- The database transition function matches the checked-in actor-based function: it requires an active admin profile. The API supplies its authenticated actor. The database function itself does not authenticate physical human interaction or require a human-session claim. Audit request IDs are null by design for this RPC. Thus the stronger earlier statement that the database proves every action was a manual human click is unsupported.
- Publication history and technical source checks are established; independent academic checking is not established by `ok` or a `verified` flag. The source evidence explicitly says the six news-based questions were promoted on owner direction after AI read excerpts and were not checked against the printed Văn kiện. The generated review pack still contains the original pending-verification wording. No source-verification actor/time audit exists in the source schema. T115 remains open for human academic confirmation and source-specific evidence; no approval, republication or source edit was attempted.

## Official competition and environment

- Official **VNR202 · Buổi chơi 02/11/2026** remains Scheduled, not accepting new starts; 39 active students, all 39 names pending; six test accounts locked. No credentials or roster identifiers enter this evidence.
- Frozen pool: minefield 44 snapshots / 180000ms; race 49 / 150000ms. Both have zero fixture snapshots, attempts and board entries. Hard readiness: true, no blockers. Saved acknowledgement: 39 expected attempts, confirmed, stated reason; low-exposure target not met (20 extra questions needed at this attendance).
- Existing stored timestamps precede the class; installed `open_competition_now` assigns fresh opening/deadline timestamps at the actual admin click. It was inspected, never invoked. Default organizer admission choice remains 60 minutes.
- Stable class alias still serves READY d5880a5 / `dpl_GHqdkXmTD3VvrjNtpG2tgNACsjHw`, runtime icn1. No code from this audit is deployed.
- Vercel class project `vnr202-preview` and main project `vnr202-mach-quyet-sach` are distinct and point to different Supabase projects. Both Vercel targets inside the class project share the class database; both targets inside the main project share its separate database. Therefore the class environment is isolated from the main website, but a Preview build inside the class project is not a disposable database sandbox. Keep load/destructive/rehearsal automation on localhost CI.
- The main project's inspected production/preview targets lack the server-role/pepper keys required by the Arena. Its existence/public URL is not a completed Production acceptance gate. No environment value was changed; private values were not committed.

## Acceptance still required

Resolve and verify the load authentication failure; obtain meaningful human academic/source confirmation; perform Wi-Fi + 4G + projector checks from the organizer checklist. Do not mark Stage G, T057/T062/T066/T067 or full Production complete based on local CI/CDN-stand-in metrics. The organizer decides when to Open after these conditions are met.
