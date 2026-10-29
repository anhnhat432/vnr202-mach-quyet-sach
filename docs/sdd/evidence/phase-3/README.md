# Giai đoạn B – Báo cáo nghiệm thu (T014, T030–T033)

Ngày: 2026-10-29  
Phạm vi: hạ tầng kiểm thử DB, đăng nhập MSSV, nhập danh sách lớp `.xlsx`/`.csv`, quản trị tài khoản. **Không** có Game 1, Game 2, ngân hàng câu hỏi thi chính thức hay bảng xếp hạng realtime.  
Quy tắc không đổi: một lượt/MSSV/game/cuộc thi, hai BXH Top 10 độc lập, luật gameplay đã chốt (chưa có mã nào đụng tới).

## 1. Môi trường kiểm thử đã dùng (và khác Supabase thật ở đâu)

`npx supabase start` **không chạy được** trong sandbox: Docker Hub trả `429` và ECR/GHCR bị proxy chặn (`403`/`Data limit exceeded`) nên không kéo được image `supabase/postgres`, `kong`. Vì vậy dùng harness dự phòng `scripts/db/local-stack.sh`:

| Thành phần | Harness dự phòng | Supabase thật |
|---|---|---|
| PostgreSQL | 16 (gói apt) | 17 (image Supabase) |
| Auth | GoTrue `v2.195.0` (image Supabase) | cùng dòng GoTrue, cấu hình do Supabase quản lý |
| REST | PostgREST `v16.1` | PostgREST của Supabase |
| Cổng | Gateway Node ánh xạ `/auth/v1`, `/rest/v1` | Kong |
| `auth.jwt()/uid()/role()` | **Tự định nghĩa** trong `supabase/local/post-auth.sql` | Do Supabase cung cấp |
| Vai trò `anon/authenticated/service_role` | Tự tạo trong `supabase/local/bootstrap.sql` | Do Supabase cung cấp |
| Realtime, Storage, Studio | **Không có** | Có |
| pgTAP | Gói apt, cài thủ công | Có trong image |

**Hệ quả:** kết quả bên dưới chứng minh logic migration/RLS/Auth chạy đúng trên Postgres và GoTrue thật, nhưng **chưa thay thế** `supabase db reset` + `supabase test db` và kiểm thử trên project Supabase thật (yêu cầu của bạn và ADR-004). Hai việc này vẫn mở (mục 5).

## 2. Kết quả chạy thực tế

| Kiểm tra | Kết quả |
|---|---|
| `npm run lint` | Sạch (0 lỗi, 0 cảnh báo) |
| `npx tsc --noEmit` | Sạch |
| `npm run test` (unit) | **61/61 pass** (29 cũ + 32 mới: MSSV, dẫn xuất mật khẩu, tên hiển thị, CSV, XLSX, bản xem trước, CSRF) |
| `npm run test:integration` (Postgres + GoTrue + PostgREST thật) | **24/24 pass** |
| `scripts/db/test-db.sh` (pgTAP) | `identity_rls.sql` 26 assertion pass; `public_content_rls.sql` 6 assertion pass |
| `npm run build` | Pass; 11 route mới/đổi |
| E2E mới `auth-roster.spec.ts` (HTTP + trình duyệt thật) | **Pass** (desktop Chromium) |
| E2E có sẵn (5 spec desktop) | 3 pass, **2 fail có từ trước** — xem mục 4 |
| `scripts/security/scan-secrets.mjs` (145 file được theo dõi) | 0 phát hiện |
| `scripts/security/scan-client-bundle.mjs` (25 file client) | 0 phát hiện |

Kiểm tra đối chứng (bộ test không "xanh rỗng"):
- Cố ý thêm policy rò rỉ `profiles` và `student_auth_identities` → 3 test tích hợp **fail**, 2 assertion pgTAP **fail**; gỡ policy → pass lại.
- Nâng giới hạn khóa đăng nhập từ 5 lên 5000 → 2 test **fail**; khôi phục → pass.
- Chạy bộ quét bundle với một giá trị chắc chắn có trong bundle → 22 phát hiện (bộ quét không mù).

## 3. Ánh xạ yêu cầu → bằng chứng

| Yêu cầu | Bằng chứng |
|---|---|
| LA-ACC-001/002, LA-AC-018 (xem trước, không ghi trước khi xác nhận) | `identity.test.ts` "previews without creating any account"; `auth-roster.spec.ts` |
| LA-ACC-011/012, LA-AC-028 (MSSV là chuỗi, số 0 đầu, ô số cảnh báo) | `student-id.test.ts`, `roster-files.test.ts`, `roster-preview.test.ts`; integration: MSSV `00123` giữ nguyên, đăng nhập `123` thất bại; migration `profiles.student_id text`; e2e đăng nhập `" 00777 "` |
| LA-ACC-003/004, LA-AC-019 (mật khẩu mặc định, không bước đổi mật khẩu) | integration "signs in with MSSV and the default password"; `profiles.must_change_password` bị `CHECK` luôn `false` với sinh viên |
| LA-ACC-005 (dẫn xuất phía server) | `provider-password.test.ts`; integration: đăng nhập thẳng GoTrue bằng mật khẩu `1` thô **bị từ chối**, bằng mật khẩu dẫn xuất thì được |
| LA-ACC-008 (giới hạn đăng nhập) | integration: 5 lần sai → từ chối cả mật khẩu đúng; MSSV khác cùng IP không bị ảnh hưởng. IP: 300/10 phút (chưa đo với NAT lớp học – P10) |
| LA-ACC-009 (nhật ký, băm) | integration: sự kiện thành công/thất bại ghi, không chứa MSSV hay IP gốc |
| LA-ACC-010 (không sửa MSSV đã có) | integration "flags existing MSSV…" |
| LA-ACC-015 (email nội bộ ngẫu nhiên) | integration: UUID, không chứa MSSV; bảng `student_auth_identities` không có quyền cho `anon/authenticated` |
| LA-ACC-018 (kiểm tra an toàn tối thiểu), LA-ACC-013/014 `[MỞ]` | `student-id.test.ts`; mẫu MSSV và giới hạn hàng chỉ là cấu hình tùy chọn (`ROSTER_STUDENT_ID_PATTERN`, `ROSTER_MAX_ROWS`), **không** hard-code |
| LA-PRV-003, LA-AC-038 (tên hiển thị) | `display-name.test.ts`; integration: "An N.V.", trùng → hậu tố 2, admin sửa có audit; e2e `/api/v1/me` |
| LA-PRV-001/004 (không lộ danh sách) | RLS: sinh viên chỉ thấy hồ sơ của mình; `/api/v1/admin/students` và `/api/v1/admin/*` trả **404** cho sinh viên (e2e) |
| AC-AUTH-002 (bù trừ khi lỗi giữa chừng) | integration: lỗi ở tài khoản thứ 3 → không profile nào được tạo, import `compensated`, không user Auth mồ côi |
| T033 (reset, thu hồi phiên, khóa) | integration: sau thu hồi, access token cũ bị GoTrue từ chối ngay; reset về mặc định; khóa → `account_disabled` |
| Bảo mật §3–§5 | CSRF + Origin (e2e: 403), lỗi chung (401 giống hệt nhau cho MSSV đúng/không tồn tại), `user_metadata.role=admin` không cấp quyền (integration + pgTAP) |
| ACCESS-002/003 | RLS ma trận anon / sinh viên A / sinh viên B / admin (pgTAP + REST với JWT thật) |
| Không lộ bí mật | Quét repo và bundle ở mục 2; `.env.example` chỉ có placeholder; harness chỉ ghi bí mật sinh ngẫu nhiên vào `.local/` (git-ignored) |

## 4. Vấn đề phát hiện, không thuộc phạm vi sửa

1. **Hai spec E2E có sẵn đang fail, có từ trước Giai đoạn B** (`git status` xác nhận tôi không đụng các file liên quan):
   - `home.spec.ts` kỳ vọng h1 "Mạch Quyết Sách", nhưng trang chủ được viết lại ở commit `706867e` và h1 hiện là "Ngàn cân treo sợi tóc".
   - `public-evidence.spec.ts` timeout khi bấm nút trong bản đồ nhân quả.
   - CI hiện **không chạy E2E** nên không ai phát hiện. Cần một task riêng để cập nhật spec.
2. **`npm audit` báo `next` 16.0.0–16.4.0 mức critical** (GHSA-h694-7cp9-m8p3: rò cache giữa các giá trị root param trong hàm `'use cache'` lồng nhau) và `sharp` mức high. Dự án ghim `next 16.3.1` theo ADR-001 nên tôi **không tự nâng**. Dự án không dùng `'use cache'` (chưa kiểm tra bằng công cụ), nhưng cần quyết định nâng phiên bản trước khi triển khai production.
3. Các cảnh báo dev-dependency (`brace-expansion` high, `vitest` moderate) như báo cáo trước; chưa xử lý.

## 5. Chưa làm / chưa được xác minh

- **`supabase start`, `supabase db reset`, `supabase test db` chưa chạy** (không kéo được image). T014 giữ trạng thái đang làm. Cần chạy trên máy có Docker pull được hoặc trong CI.
- **LA-ACC-016 chưa đạt:** chưa có project Supabase thật để xác minh hành vi mật khẩu ngắn. Script `scripts/db/verify-hosted-auth.mjs` đã sẵn sàng; chạy bằng URL/khóa của project thật rồi dán kết quả vào đây. Ghi nhận từ harness local (GoTrue, `minimum_password_length = 6`): API admin tạo user với mật khẩu 1 ký tự **thành công** và đăng nhập công khai bằng mật khẩu đó **thành công**; đổi mật khẩu tự phục vụ sang 1 ký tự **bị từ chối**. Ứng dụng luôn dùng mật khẩu dẫn xuất 43 ký tự nên không phụ thuộc kết quả này, nhưng kết quả hosted vẫn phải được ghi lại.
- **Realtime** không thuộc Giai đoạn B và không được kiểm thử.
- **Giới hạn đăng nhập theo IP (300/10 phút)** chưa đo với cả lớp sau một NAT (P10).
- **Thời gian phản hồi đăng nhập giữa MSSV tồn tại và không tồn tại** được làm cùng khối lượng việc (cùng dẫn xuất + một lần gọi Auth) nhưng **chưa đo bằng thống kê**; không nên coi là bằng chứng chống dò MSSV theo thời gian.
- **N6 (mẫu MSSV, giới hạn số hàng) vẫn mở:** chưa có file danh sách thật. Hệ thống chỉ kiểm tra an toàn tối thiểu cho tới khi có file.
- **Khả năng đọc `.xlsx` thực tế:** reader chỉ được kiểm bằng file sinh trong test; **chưa thử với file Excel/Google Sheets/WPS thật**. Nên thử bằng một bản sao có dữ liệu giả trước khi dùng.
- **Student Passport (T034)** chưa làm (cần cuộc thi và lượt chơi).
- Chưa kiểm thử trên mobile Chromium cho các màn đăng nhập/quản trị; chưa kiểm axe cho hai trang mới.

## 6. Quyết định N9 – đọc `.xlsx`

Không dùng thư viện đọc Excel đầy đủ. Chọn `fflate@0.8.3` (MIT, không phụ thuộc, ghim chính xác) cho giải nén, cộng bộ đọc XML tối giản (`web/src/features/roster/domain/xlsx.ts`) chỉ đọc sheet đầu tiên, shared strings và giá trị đã cache của ô công thức.

Lý do: `exceljs@4.4.0` không được cập nhật từ 2024-12 và kéo theo `archiver`, `unzipper@0.10`, `tmp`; gói `xlsx` trên npm dừng ở `0.18.5`; `read-excel-file@9.3.x` đổi phiên bản gần như hằng ngày (9.3.11 → 9.3.14 trong 3 tuần) và thêm `worker-f`, `unzipper-esm`. Tôi chỉ so sánh siêu dữ liệu gói, **không** rà CVE từng gói.

Đánh đổi: phải tự bảo trì bộ đọc; chỉ hỗ trợ `.xlsx` đơn giản (không `.xls`, không công thức tính lại, ngày tháng là số). Giới hạn bảo vệ zip bomb: ≤ 300 mục, ≤ 16 MiB mỗi mục, ≤ 48 MiB tổng, chỉ giải nén các phần cần dùng.

## 7. Cách chạy lại

```bash
bash scripts/db/local-stack.sh up        # hoặc: npx supabase@2.115.0 start
bash scripts/db/test-db.sh                # pgTAP
npm --prefix web run test:integration     # Postgres + GoTrue thật
npm --prefix web run test && npm --prefix web run lint
node scripts/security/scan-secrets.mjs
```
