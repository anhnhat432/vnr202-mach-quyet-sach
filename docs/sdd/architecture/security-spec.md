# Security and Privacy Specification

Trạng thái: Approved for planning  
Phạm vi: Auth, authorization, PII, API, CSV, content, realtime, secrets và deployment

## 1. Tài sản cần bảo vệ

- Student ID, full roster, Auth user IDs và trạng thái tài khoản.
- Password tạm, session cookies, refresh tokens, Supabase service-role key và signing secrets.
- Correct answers, rubrics, question pool, allocation và submitted answers.
- Attempt state, score calculations, timer, disconnect grace và audit records.
- Admin actions và publication authority.

Full name được phép công khai trên leaderboard theo quyết định sản phẩm; student ID không được công khai.

## 2. Threat model tối thiểu

- Student cố tạo lượt thứ hai, gửi answer hai lần, sửa score/timer hoặc replay request cũ.
- Hai thiết bị cùng gửi answer khi transfer session.
- Người ngoài đoán student ID, brute-force login hoặc tải roster.
- Client gửi Broadcast giả, event cũ hoặc payload làm UI sai.
- CSV có duplicate, formula injection, encoding lạ hoặc dữ liệu quá lớn.
- Admin vô tình publish câu hỏi thiếu nguồn hoặc lộ correct answer.
- XSS qua content, URL nguồn hoặc tên file; CSRF qua cookie session.
- Secret bị đưa vào client bundle, log, Git hoặc error response.

## 3. Authentication và session

- Supabase Auth quản lý password hash và refresh token.
- Session lưu trong secure, httpOnly, SameSite=Lax cookies qua `@supabase/ssr`; production bắt buộc HTTPS.
- Không lưu access/refresh token trong localStorage.
- Login UI nhận student ID; synthetic email chỉ được tạo trong server code.
- Error login luôn là `invalid_credentials`, không xác nhận student ID tồn tại.
- Supabase Auth rate limit cộng với application rate limit theo IP hash và student ID hash.
- Password tạm bắt buộc đổi trước mọi protected capability ngoài change-password/sign-out.
- Password reset admin revoke active gameplay session và các refresh sessions nếu provider hỗ trợ; nếu không, sessionVersion của attempt vẫn chặn gameplay cũ.

## 4. Authorization

- Role lấy từ `auth.jwt().app_metadata.role`, không tin `user_metadata` hoặc body.
- Route Handler luôn xác thực user và permission trước khi dùng service-role client.
- Student chỉ đọc profile/result/attempt của mình.
- Admin đọc roster, question private content, competition monitor và audit.
- Public chỉ đọc Published dossier và leaderboard projection đã redacted.
- Khi resource thuộc người khác, ưu tiên `404 not_found` thay vì tiết lộ existence.

## 5. RLS matrix

| Resource | Public/anon | Student | Admin | Service role |
| --- | --- | --- | --- | --- |
| Published dossier/source projection | Select | Select | Select | Full |
| Profiles | None | Own redacted | Select/update allowed fields | Full |
| Dossier progress | None | Own select/upsert | Select | Full |
| Questions/private versions | None | None | Through server routes | Full |
| Competitions public projection | Select | Select | Through server routes | Full |
| Attempts/allocations/submissions | None | Own redacted projection only | Through server routes | Full |
| Leaderboard public projection | Select | Select | Select | Full |
| Audit/rate limits | None | None | Through server routes | Full |

Client mutations trực tiếp vào Core tables không có policy.

## 6. Input validation

- Mọi JSON body parse bằng Zod và reject unknown keys ở protected mutations.
- UUID, enum, string length, collection count và JSON nesting có hard limits.
- Source URL chỉ cho `https:` trừ local development.
- Dossier content không nhận raw HTML; Markdown renderer không bật raw HTML.
- Full name normalize Unicode, trim whitespace, 2-100 ký tự; không render bằng `dangerouslySetInnerHTML`.
- Student ID uppercase, whitelist pattern do admin cấu hình; release seed dùng pattern `^[A-Z]{2,4}\d{5,8}$`.

## 7. CSV safety

- Tối đa 1 MiB, 100 rows, UTF-8, exact three headers.
- Reject NUL, duplicate headers, extra columns, blank rows giữa file và formula-leading characters trong identity fields.
- Parse toàn bộ và validate duplicate trước khi tạo Auth user/profile.
- Temporary password không log, không lưu plaintext và không xuất lại sau response apply.
- Roster export nếu được thêm sau này phải escape formula cells.

## 8. CSRF và browser security

- State-changing cookie-auth requests kiểm tra Origin/Host allowlist và double-submit CSRF token.
- Cookies: Secure production, HttpOnly cho auth, SameSite=Lax, scoped path phù hợp.
- Security headers: CSP không `unsafe-eval` ở production, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, strict referrer policy và permissions policy tối thiểu.
- Chỉ cho image/font/connect origins được liệt kê; không wildcard cho script.
- Projector mode vẫn chạy cùng origin, không dùng iframe third-party.

## 9. Gameplay integrity

- Unique database constraints bảo vệ one-attempt và one-answer-per-stage.
- Idempotency key required và lưu cùng submission.
- Session version tăng khi transfer/reset; stale session bị từ chối trước evaluate.
- Server time duy nhất cho deadline, elapsed, grace và tie-breaker.
- Correct answer/rubric không vào client payload trước khi interaction được commit và feedback được phép.
- Score/rank update trong transaction; client-provided score, elapsed hoặc correctness bị bỏ qua.
- Answer arriving after timeout returns terminal projection without points.

## 10. Realtime security

- Public event không có PII ngoài opaque competition/game IDs và không có score.
- Client không áp dụng Broadcast payload làm authoritative state.
- Private attempt/admin channel có Realtime Authorization policy.
- Presence metadata tối thiểu, không chứa student ID hoặc full profile.
- Fake/duplicate/out-of-order event phải không tạo divergence hoặc extra score.

## 11. Rate limits

Initial limits, configurable by environment:

- Sign-in: 5 attempts/10 phút theo IP hash và 5/10 phút theo student ID hash.
- Change password: 5/giờ/user.
- Start/transfer attempt: 10/phút/user, idempotent.
- Answer submission: 30/phút/attempt và tối đa một in-flight request/client.
- Heartbeat: 20/phút/attempt, server coalesce.
- Public leaderboard GET: 120/phút/IP, CDN/cache-aware.
- Admin roster apply/password reset/publication: 20/phút/admin, audit bắt buộc.

Rate limit error trả `429` và `Retry-After`; không tiết lộ key bucket.

## 12. Secrets và logging

Environment variables:

- Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `CSRF_SIGNING_SECRET`, `INTERNAL_AUTH_EMAIL_DOMAIN`.
- Local `.env.local` ignored; `.env.example` chỉ có placeholder.
- Logger redact key có `password`, `token`, `cookie`, `authorization`, `answer`, `serviceRole`.
- Production error response generic; server log có request ID nhưng không có secret/PII payload đầy đủ.

## 13. Audit

Audit bắt buộc cho roster apply, password reset, role/status changes, question review/publish, dossier publish, competition transition, manual result-affecting action và archive.

Audit row ghi actor, action, target, request ID, redacted before/after và server timestamp. Audit không được sửa từ client.

## 14. Dependency và deployment checks

- Lockfile committed và CI dùng `npm ci`.
- `npm audit --audit-level=high` hoặc documented exception trước deploy.
- Secret scan, typecheck, lint, unit, integration, RLS và E2E gates.
- Vercel Preview không dùng production Supabase project.
- Production deploy chỉ từ protected branch sau migration dry-run và backup/rollback note.

## 15. Security acceptance tests

- Student A không đọc Student B profile/attempt/result qua API hoặc direct Supabase client.
- Client không tạo attempt thứ hai bằng concurrent requests.
- Duplicate/stale answer không tăng điểm.
- Old device sau transfer không submit được kể cả bỏ lỡ Realtime event.
- Login không enumerate student ID và rate limit hoạt động.
- CSV malformed/duplicate không tạo profile/Auth user.
- Public leaderboard response và event không chứa student ID/auth ID.
- Service role không xuất hiện trong client bundle, source map hoặc logs.
- Content payload không thực thi script/HTML và malicious URL bị reject.
- CSRF request từ origin lạ bị `403`.
