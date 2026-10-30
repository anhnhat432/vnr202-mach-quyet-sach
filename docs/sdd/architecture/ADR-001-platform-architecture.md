# ADR-001: Kiến trúc nền tảng VNR202 - Mạch Quyết Sách

Trạng thái: Accepted (một phần được sửa bởi ADR-004 ngày 2026-10-29: game, thời gian và mật khẩu Live Arena V1.0)  
Ngày: 2026-08-19  
Phạm vi: Runtime, ranh giới client/server, dữ liệu, realtime và triển khai

## Bối cảnh

Sản phẩm phải phục vụ nội dung công khai, 60 người chơi đồng thời, khoảng 200 người xem bảng xếp hạng, hai game có luật một lượt, resume, chuyển thiết bị và cập nhật thứ hạng sau mỗi bước được chấm. Người dùng thực hiện dự án một mình, vì vậy kiến trúc phải giảm số dịch vụ vận hành nhưng không được chuyển quyền chấm điểm hoặc tính giờ cho trình duyệt.

## Quyết định

### Runtime và phiên bản nền

- Node.js `22.14.0` hoặc mới hơn trong nhánh 22 LTS.
- Next.js `16.4.3` (nâng từ 16.3.1 do GHSA, xem ADR-005), React `19.2.8`, TypeScript `7.0.2`.
- Next.js App Router, React Server Components cho dữ liệu đọc ban đầu và Route Handlers cho API `/api/v1`.
- Supabase JavaScript `2.112.3` và `@supabase/ssr` `0.12.4` cho session cookie phía server.
- Zod `4.6.7` (nâng từ 4.4.3 do GHSA, xem ADR-005) cho validation ở biên API và validation JSON content.
- Vitest `4.1.11` cho unit/integration tests; Playwright `1.62.1` cho end-to-end.
- Vercel chạy ứng dụng Next.js; Supabase cung cấp PostgreSQL, Auth và Realtime.

Các phiên bản trên là snapshot tại thời điểm lập kế hoạch. Lockfile là nguồn chân lý sau khi scaffold; nâng major version cần ADR mới nếu ảnh hưởng hợp đồng.

### Ranh giới client và server

- Trình duyệt chỉ được gọi API có phiên bản, quản lý session thông qua cookie và subscribe Realtime.
- Trình duyệt không được ghi trực tiếp vào bảng attempt, answer, score, leaderboard, question publication hoặc audit.
- Supabase anon key có thể xuất hiện ở client; service-role key chỉ tồn tại trong server runtime.
- Tất cả thao tác game có ảnh hưởng điểm dùng PostgreSQL function/RPC giao dịch để khóa attempt, kiểm tra session version, đánh giá đáp án, ghi kết quả, cập nhật tổng điểm và tăng leaderboard version trong một transaction.
- Realtime chỉ báo rằng dữ liệu có phiên bản mới. API/DB vẫn là nguồn chân lý khi client reconnect hoặc bỏ lỡ event.

### Tổ chức ứng dụng

- `src/app`: routes, layouts, server components và Route Handlers.
- `src/features`: chia theo capability thay vì chia toàn bộ theo controller/service/repository.
- Mỗi feature có `domain`, `server`, `ui` và `contracts` khi cần; code client không import module server.
- `src/lib/supabase`: browser, server-cookie và service-role clients tách riêng.
- `src/lib/api`: response envelope, errors, auth guard, CSRF, idempotency và rate-limit adapters.
- `supabase/migrations`: schema, RLS, functions, triggers, indexes và seed metadata.
- `content`: seed 15 hồ sơ, source manifest và bộ câu hỏi mẫu đã duyệt; nội dung production có version trong PostgreSQL.

### Dữ liệu công khai

- Dossier Published được đọc qua server component hoặc API và cache theo tag.
- Khi admin publish phiên bản mới, server gọi `revalidateTag` cho dossier, cause map và evidence matrix liên quan.
- Nội dung lưu dạng cấu trúc JSON đã được Zod kiểm tra; không cho phép raw HTML từ admin.
- Tiến độ khách không đăng nhập lưu local trong trình duyệt. Khi sinh viên đăng nhập, hoàn thành hồ sơ được đồng bộ qua API nhưng không ảnh hưởng game score.

### Xác thực

- Giao diện đăng nhập nhận `studentId` và password.
- Supabase Auth vẫn dùng email/password nội bộ; server ánh xạ student ID sang một synthetic email không hiển thị cho người dùng.
- Student role và admin role nằm trong `app_metadata`, chỉ service role được sửa.
- `profiles.must_change_password` là cờ do server quản lý; mọi protected route ngoài đổi mật khẩu và đăng xuất phải chặn tài khoản còn cờ này. **[Sửa bởi ADR-004: V1 dùng mật khẩu mặc định chung, không bắt buộc đổi mật khẩu; cờ luôn `false` với sinh viên.]**

### Realtime

- Leaderboard public dùng Supabase Broadcast topic theo competition public ID và game.
- Event public chỉ chứa game, version và thời điểm commit; không chứa student ID, đáp án hoặc chi tiết attempt.
- Client nhận event sẽ debounce rồi fetch authoritative leaderboard. Payload không được dùng để tự sửa score/rank.
- Player response sau submit trả về score/rank mới trực tiếp để giao diện người chơi không phụ thuộc broadcast.
- Presence chỉ dùng cho số người đang xem/chơi và admin monitor; không dùng làm nguồn chân lý cho attempt state.

### Không thêm dịch vụ ở phiên bản đầu

- Không có backend Express/Nest riêng, Redis, message queue hoặc CMS tổng quát.
- Rate limit nghiệp vụ dùng Supabase Auth limits và PostgreSQL `consume_rate_limit` cho các route nhạy cảm.
- Tác vụ settle/finalize chạy idempotently từ Vercel Cron gọi endpoint server-only; mọi request đọc/ghi attempt cũng tự reconcile trạng thái đến hạn để không phụ thuộc tuyệt đối vào cron.

## Hệ quả

### Tích cực

- Một codebase TypeScript và hai nền tảng managed phù hợp với một người vận hành.
- Luật điểm, timer và one-attempt có transaction và constraint database bảo vệ.
- Broadcast có thể mất mà không làm sai dữ liệu lâu dài.
- Public experience có thể cache tốt trong khi game giữ tính động.

### Đánh đổi

- Supabase Auth không hỗ trợ student ID trực tiếp, nên cần synthetic email và route đăng nhập riêng.
- Broadcast public có thể bị client lạ gửi event giả. Event không mang dữ liệu có thẩm quyền; client validate version, debounce và refetch. Nếu sản phẩm mở rộng ngoài một lớp, chuyển leaderboard sang private channel với short-lived viewer authorization.
- Auth admin API và application tables không cùng một transaction. Roster import phải dùng staging, validation trước, audit và compensation khi tạo Auth user thất bại.

## Tài liệu chính thức đã đối chiếu

- Next.js Route Handlers: `https://nextjs.org/docs/app/getting-started/route-handlers`
- Supabase SSR for Next.js: `https://supabase.com/docs/guides/auth/server-side/nextjs`
- Supabase Broadcast: `https://supabase.com/docs/guides/realtime/broadcast`
- Supabase Realtime Authorization: `https://supabase.com/docs/guides/realtime/authorization`
- Supabase Row Level Security: `https://supabase.com/docs/guides/database/postgres/row-level-security`

## Tiêu chí thay thế kiến trúc

Tạo ADR mới trước khi thêm backend riêng, Redis, provider auth khác, nhiều lớp hoạt động đồng thời, offline-authoritative gameplay hoặc thay Broadcast bằng giao thức khác.
