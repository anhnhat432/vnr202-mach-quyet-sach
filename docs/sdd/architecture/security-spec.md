# Security and Privacy Specification

Trạng thái: Approved for planning; sửa đổi v1.1 cho Live Arena V1.0 (2026-10-29, bản sửa 1) chờ duyệt văn bản  
Phạm vi: Auth, authorization, PII, API, CSV, content, realtime, secrets và deployment

## 1. Tài sản cần bảo vệ

- Student ID, full roster, Auth user IDs và trạng thái tài khoản.
- Mật khẩu mặc định (cấu hình), `AUTH_PASSWORD_PEPPER`, session cookies, refresh tokens, Supabase service-role key và signing secrets.
- Correct answers, giải thích, ngân hàng câu hỏi, bàn cờ Game 1, allocation và submitted answers — không được lộ trước khi cuộc thi Finalized (`LA-FB-003`).
- Attempt state, score calculations, timer, thời hạn câu và audit records.
- Admin actions và publication authority.

Full name được phép công khai trên leaderboard theo Core `PRV-001`; student ID không bao giờ được công khai. Đề xuất `LA-PRV-003/004` (tên hiển thị lớp học, khách chỉ thấy Top 10) đang chờ duyệt; nếu được duyệt, họ tên đầy đủ chỉ quản trị viên và chính sinh viên thấy. Không endpoint công khai nào liệt kê danh sách lớp (`LA-PRV-002`).

## 2. Threat model tối thiểu

- Student cố tạo lượt thứ hai, gửi answer hai lần, sửa score/timer hoặc replay request cũ.
- Hai thiết bị cùng gửi answer khi transfer session.
- Người ngoài đoán student ID, brute-force login hoặc tải roster.
- **Rủi ro chấp nhận (V1):** người biết MSSV đăng nhập bằng mật khẩu chung và dùng lượt của người khác (`LA-ACC-006`). Biện pháp giảm nhẹ: nhật ký đăng nhập/chuyển thiết bị `[ĐỀ XUẤT LA-ACC-009]` và thao tác sự cố có audit; không có biện pháp ngăn chặn.
- Người chơi đã xong chia sẻ đáp án cho người chơi sau: phản hồi trong trận không có đáp án đúng (`LA-FB-001`). **Rủi ro còn lại:** đúng/sai làm lộ đáp án câu hai lựa chọn và thu hẹp câu ba lựa chọn; mỗi câu được khoảng 20/60 người thấy với ngân hàng 87 câu. Chỉ giảm thiểu bằng phân bổ riêng, đảo đáp án, hạn chế số người thấy mỗi câu và không tái sử dụng âm thầm câu đã lộ (`LA-FB-007`, `LA-CONTENT-009..012`).
- Đọc trước nội dung câu (ví dụ qua devtools) trong khoảng hiệu ứng để có thêm thời gian: nội dung chỉ phát hành từ `available_at` (`LA-TIME-013`).
- Ngắt mạng có chủ đích để kéo dài thời gian tra cứu: đồng hồ không tạm dừng (`LA-TIME-001`).
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
- Supabase Auth rate limit cộng với application rate limit theo IP hash và student ID hash; ngưỡng IP phải chịu được cả lớp sau một NAT (§11).
- **Ngoại lệ có ghi nhận (`LA-ACC-003..006`, thay Core `ACC-003`):** sinh viên dùng mật khẩu mặc định chung `1`, không bắt buộc đổi ở lần đầu. Chính sách mật khẩu 10–72 ký tự của v1.0 không áp dụng cho tài khoản sinh viên V1. Ngoại lệ chỉ hợp lệ cho thi đua lớp học giá trị thấp; cuộc thi có giá trị cao phải sửa đổi đặc tả trước.
- Nếu Supabase Auth không nhận mật khẩu ngắn, server dùng mật khẩu nội bộ `base64url(HMAC-SHA256(AUTH_PASSWORD_PEPPER, MSSV + ":" + matKhauNhap))` (`LA-ACC-005`). Supabase Auth vẫn băm mật khẩu nội bộ. Pepper và mật khẩu mặc định chỉ tồn tại trong biến môi trường server; không vào client bundle, repository, seed, test fixture, log hay response. Đổi pepper làm mọi tài khoản phải được đặt lại mật khẩu.
- Admin đặt lại mật khẩu về giá trị mặc định, revoke active gameplay session và các refresh sessions nếu provider hỗ trợ; nếu không, sessionVersion của attempt vẫn chặn gameplay cũ.

## 4. Authorization

- Role lấy từ `auth.jwt().app_metadata.role`, không tin `user_metadata` hoặc body.
- Route Handler luôn xác thực user và permission trước khi dùng service-role client.
- Student chỉ đọc profile/result/attempt của mình.
- Admin đọc roster, question private content, competition monitor và audit.
- Sinh viên chỉ đọc đáp án và giải thích của lượt của chính mình, và chỉ sau khi cuộc thi Finalized (`LA-FB-004`).
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
- Student ID là chuỗi: trim, in hoa chữ Latin, giữ số 0 đầu, không ép kiểu số (`LA-ACC-011`). Mẫu định dạng là cấu hình do admin đặt **sau khi xem tệp danh sách thật** (`[ĐỀ XUẤT LA-ACC-013]`); khi chưa cấu hình chỉ kiểm không rỗng, ≤ 32 ký tự, không có ký tự điều khiển hoặc ký tự công thức đầu chuỗi. Ví dụ `^[A-Z]{2,4}\d{5,8}$` không phải luật.

## 7. Roster file safety (CSV và XLSX)

- Tối đa 1 MiB; số hàng tối đa là cấu hình (`[THỬ NGHIỆM LA-ACC-014]`, đề xuất 200); CSV UTF-8; XLSX chỉ sheet đầu tiên, đọc văn bản hiển thị, cảnh báo ô MSSV kiểu số (`LA-ACC-012`).
- Hai cột bắt buộc (MSSV, họ tên) với bí danh tiếng Việt/Anh; không có cột mật khẩu.
- Reject NUL, duplicate headers và formula-leading characters (`=`, `+`, `-`, `@`) trong identity fields; với XLSX chỉ đọc giá trị ô, không đánh giá công thức, không theo external link, giới hạn kích thước giải nén để chống zip bomb.
- Parse chạy phía server; thư viện XLSX phải qua `npm audit` và đánh giá bảo trì trước khi thêm (ADR-004).
- Parse toàn bộ và validate duplicate (trong tệp và với roster hiện có), thiếu dữ liệu, sai định dạng trước khi tạo Auth user/profile; hiển thị bản xem trước.
- Mật khẩu mặc định không log, không lưu plaintext và không xuất trong response.
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
- Server time duy nhất cho deadline, thời hạn câu, độ trễ cho phép và tie-breaker (không có grace pause, `LA-TIME-001`).
- Correct answer, giải thích và rubric không vào bất kỳ client payload nào khi cuộc thi chưa Finalized, kể cả sau khi câu đã được chấm (`LA-FB-003`).
- Đề và lựa chọn của một câu không vào bất kỳ payload nào trước `available_at`; endpoint lấy nội dung từ chối hoặc giữ yêu cầu sớm; lấy muộn không kéo dài thời hạn (`LA-TIME-013..017`).
- Câu đã lộ đáp án không vào snapshot của cuộc thi `official` nếu không có xác nhận rõ ràng của admin, có audit (`LA-CONTENT-009`).
- Nội dung ô chưa mở và câu chưa hiển thị không vào client payload (`MINE-BOARD-005`, `LA-ALLOC-005`).
- File nguồn ngân hàng câu hỏi không được import vào `web/src`; build kiểm tra client bundle không chứa đáp án (`LA-AC-020`).
- Score/rank update trong transaction; client-provided score, elapsed, correctness, deadline hoặc trạng thái vật phẩm bị bỏ qua.
- Thời hạn câu ghi một lần; answer đến sau `min(deadline_at, ends_at) + latency_allowance` được ghi hết giờ, không có điểm.
- Câu hỏi `origin = fixture` không được dùng trong cuộc thi `official` và không được seed vào production (`LA-CONTENT-005`).

## 10. Realtime security

- Public event không có PII ngoài opaque competition/game IDs và không có score.
- Client không áp dụng Broadcast payload làm authoritative state.
- Private attempt/admin channel có Realtime Authorization policy.
- Presence metadata tối thiểu, không chứa student ID hoặc full profile.
- Fake/duplicate/out-of-order event phải không tạo divergence hoặc extra score.

## 11. Rate limits

Initial limits, configurable by environment:

- Sign-in: 5 lần sai/10 phút theo student ID hash; theo IP hash `[ĐỀ XUẤT]` 300 yêu cầu/10 phút để cả lớp sau một NAT Wi-Fi không bị chặn (`LA-ACC-008`).
- Start/transfer attempt: 10/phút/user, idempotent.
- Answer submission và mở ô: 60/phút/attempt và tối đa một in-flight request/client.
- Heartbeat: 20/phút/attempt, server coalesce.
- Public leaderboard GET: 120/phút/IP, CDN/cache-aware.
- Admin roster apply/password reset/publication: 20/phút/admin, audit bắt buộc.

Rate limit error trả `429` và `Retry-After`; không tiết lộ key bucket.

## 12. Secrets và logging

Environment variables:

- Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `CSRF_SIGNING_SECRET`, `INTERNAL_AUTH_EMAIL_DOMAIN`, `AUTH_PASSWORD_PEPPER`, `ROSTER_DEFAULT_PASSWORD`.
- Local `.env.local` ignored; `.env.example` chỉ có placeholder.
- Logger redact key có `password`, `token`, `cookie`, `authorization`, `answer`, `serviceRole`.
- Production error response generic; server log có request ID nhưng không có secret/PII payload đầy đủ.

## 13. Audit

Audit bắt buộc cho roster apply, password reset, role/status changes, question review/publish, dossier publish, competition transition, thao tác xử lý sự cố (`LA-ADMIN-*`), manual result-affecting action và archive.

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
- CSV/XLSX malformed/duplicate không tạo profile/Auth user.
- Pepper và mật khẩu mặc định không xuất hiện trong client bundle, source map, log hoặc repository.
- Không response, sự kiện hay bundle nào chứa đáp án đúng trước khi cuộc thi Finalized; endpoint xem lại từ chối trước Finalized.
- Câu trả lời sau thời hạn + độ trễ cho phép không được cộng điểm; F5/chuyển thiết bị không làm mới thời hạn.
- Kiểm thử PostgreSQL cục bộ không thay thế kiểm thử Auth/RLS/Realtime trên Supabase thật; cả hai bắt buộc.
- Public leaderboard response và event không chứa student ID/auth ID; không endpoint công khai nào trả danh sách lớp hoặc người chưa bắt đầu lượt (`LA-AC-032`).
- Không payload nào chứa đề/lựa chọn trước `available_at` (`LA-AC-022`); lấy nội dung muộn không kéo dài `deadline_at` (`LA-AC-023`).
- Service role không xuất hiện trong client bundle, source map hoặc logs.
- Content payload không thực thi script/HTML và malicious URL bị reject.
- CSRF request từ origin lạ bị `403`.
