# Giai đoạn B – Báo cáo nghiệm thu (T014, T030–T033)

Ngày: 2026-10-29, cập nhật 2026-10-30 (xử lý rà soát: ADR-005)  
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

**Cập nhật 2026-10-30:** CI của Draft PR #6 đã chạy `supabase start` + `supabase test db` + test tích hợp trên **stack Supabase CLI chính thức** (mục 2). Lần chạy đầu *thất bại* vì harness dự phòng cấp quyền bảng rộng hơn Supabase hiện tại; harness nay bỏ default privileges để giống thật và migration `202610300001_identity_grants.sql` cấp quyền tường minh.

**Hệ quả của harness dự phòng:** kết quả cục bộ chứng minh logic migration/RLS/Auth chạy đúng trên Postgres và GoTrue thật, nhưng **chưa thay thế** `supabase db reset` + `supabase test db` và kiểm thử trên project Supabase thật (yêu cầu của bạn và ADR-004). Hai việc này vẫn mở (mục 5).

## 2. Kết quả chạy thực tế

Cục bộ (harness dự phòng, 2026-10-30):

| Kiểm tra | Kết quả |
|---|---|
| `npm run lint`, `tsc --noEmit`, `npm run build` | Sạch / Sạch / Pass (Next 16.4.3) |
| `npm run test` (unit) | **86/86** (18 file) |
| `npm run test:integration` (Postgres + GoTrue + PostgREST thật) | **31/31** |
| pgTAP | `identity_rls.sql` 30 assertion, `public_content_rls.sql` 6, pass |
| E2E Playwright (`desktop-chromium` + `mobile-chromium`) | **14/14**, gồm 2 bài cũ đã sửa (T100) và `auth-roster.spec.ts` |
| `npm audit --omit=dev` | **0 lỗ hổng** (trước: `next` critical, `sharp` high, `zod` high, `source-map-js` high) |
| `npm audit` (cả công cụ dev) | 3 còn lại: `vitest` moderate, `@vitest/mocker` moderate, `vite` high — xem mục 4 |
| Quét bí mật repo (225 file) / bundle client (25 file) | 0 / 0 |

Trên **stack Supabase CLI chính thức** (GitHub Actions, Draft PR #6, commit `674e93f`, CLI 2.115.0):

| Job | Kết quả |
|---|---|
| `web` (lint, typecheck, unit, build) | pass |
| `security-scan` | pass |
| `database`: `supabase start` | pass (~1m25s) |
| `database`: `supabase test db` | pass (2 file pgTAP) — lần chạy trước (`fd7a163`) **fail** 15/26 assertion với `permission denied for table profiles` |
| `database`: test tích hợp | pass, **31/31** (log đã kiểm tra) |
| `database`: E2E trong CI (commit `5310442`) | pass, **14/14** (desktop + mobile), không test nào bị bỏ qua (đã đọc log); T101 xong |

Kiểm tra đối chứng (bộ test không "xanh rỗng"):
- Thêm policy rò rỉ → 3 test tích hợp và 2 assertion pgTAP fail. Bỏ giới hạn khóa đăng nhập → 2 test fail. Bộ quét bundle bắt giá trị cố ý để lọt (22 phát hiện).
- Bù trừ: quay lại hành vi cũ (bỏ qua kết quả xóa) → 2 test fail. IP: quay lại lấy mục đầu `X-Forwarded-For` → 3 test unit và 1 test tích hợp fail.
- Reader XLSX: gỡ từng bản sửa (sheet ẩn, `_x000D_`, tiền tố namespace, nhận diện Compound File) → mỗi lần đúng 1 test fail.

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

## 4. Vấn đề đã xử lý và còn lại (rà soát 2026-10-30)

Đã xử lý (chi tiết ADR-005):
1. **Next.js** 16.3.1 → 16.4.3, **zod** 4.4.3 → 4.6.7, `source-map-js` 1.2.2; production audit = 0. Build, unit, tích hợp và E2E pass trên 16.4.3.
2. **IP đăng nhập**: không còn tin mục đầu `X-Forwarded-For` hay `x-real-ip`; đếm `TRUSTED_PROXY_HOPS` từ bên phải; không có IP đáng tin thì bỏ giới hạn IP.
3. **Bù trừ nhập lớp**: kiểm tra từng lần xóa, thử lại, tìm tài khoản mất phản hồi, xác minh, khóa phần sót, trạng thái `failed` + mã `roster_cleanup_incomplete` + route dọn lại.
4. **Reader XLSX**: sửa lỗi thật phát hiện nhờ file từ bộ ghi độc lập — sheet ẩn bị đọc nhầm, `_x000D_` không giải mã, không hỗ trợ tiền tố namespace; thêm nhận diện `.xls` cũ/file có mật khẩu.
5. **E2E cũ** (T100): xác nhận nguyên nhân trên `origin/main` — trang chủ và bản đồ nhân quả đã được viết lại, spec mô tả giao diện cũ; spec được viết lại, không bỏ qua test nào.
6. **Quyền bảng**: migration cấp quyền tường minh (xem mục 1).
7. **Mật khẩu mặc định trong test**: test dùng 1 ký tự ngẫu nhiên mỗi lần chạy thay vì giá trị thật của sản phẩm.

Còn lại:
- Cảnh báo hydration của React trong log dev server khi chạy E2E trang chủ (`cold-meter__fill` render `width: 0px` ở server nhưng `35%` ở client). Có từ trước, không thuộc phạm vi Giai đoạn B và không làm test fail; nên xem lại ở phần giao diện trang chủ.
- `vitest` 4.1.11 (moderate), `@vitest/mocker` (moderate), `vite` (high): chỉ là công cụ dev. Bump `vitest` làm npm 10.9.4 lỗi `edgesOut` trên lockfile này (`npm audit fix` cũng vậy). T104.
- Cạnh nhỏ về khả năng truy cập thấy khi đọc `cause-map.tsx`: nhãn quan hệ giữa các lớp (`cause-step__rel`) có `aria-hidden="true"`, nên người dùng đọc màn hình không nghe thấy quan hệ mà UX-AC-005 yêu cầu hiển thị. Chưa sửa (giao diện thuộc phạm vi thiết kế của bạn); đề nghị xem xét.
- Bom giải nén: `fflate` cắt đầu ra theo kích thước khai báo nên không có bom bộ nhớ (đo: tệp khai 100 byte, thật 512 MiB → RSS tăng ~7 MiB), nhưng thời gian CPU vẫn theo kích thước thật (~1,5 s cho 512 MiB; với tệp ≤ 1 MiB và tỷ lệ nén DEFLATE tối đa ~1000:1 thì cận trên cỡ vài giây một yêu cầu). Route chỉ dành cho admin. Chưa có giới hạn tần suất riêng cho route nhập lớp.

## 5. Chưa làm / chưa được xác minh

- **Supabase thật (hosted):** LA-ACC-016 / T102 **chưa làm** vì không có thông tin project. Script `scripts/db/verify-hosted-auth.mjs` sẵn sàng. Ghi nhận từ GoTrue cục bộ (`minimum_password_length = 6`): API admin tạo user với mật khẩu 1 ký tự thành công, đăng nhập công khai bằng nó thành công, đổi mật khẩu tự phục vụ sang 1 ký tự bị từ chối. Ứng dụng luôn dùng mật khẩu dẫn xuất nên không phụ thuộc kết quả này.
- **Stack Supabase chính thức:** đã có bằng chứng cho `start`, `test db`, test tích hợp và E2E (mục 2). **Chưa có** cho lệnh `supabase db reset` chạy riêng (`supabase start` đã áp dụng toàn bộ migration + seed).
- **File thật từ Excel / Google Sheets / WPS:** **chưa thử** — không có bản nào trong môi trường này. Chỉ thử với file từ XlsxWriter, openpyxl và LibreOffice (xem `web/tests/fixtures/roster/README.md`). Công cụ tự kiểm tra offline: `ROSTER_FILE=/đường/dẫn/lop.xlsx npm --prefix web run roster:check` (che MSSV, không ghi, không tải lên). T103.
- **N6:** chưa xem danh sách lớp thật; mẫu MSSV và giới hạn số hàng vẫn là cấu hình tùy chọn.
- **Realtime**, Student Passport (T034), đo thống kê thời gian phản hồi đăng nhập, đo giới hạn IP với NAT lớp học (P10): không thuộc hoặc chưa làm trong Giai đoạn B.

## 6. Quyết định N9 – đọc `.xlsx`

Giữ `fflate@0.8.3` + bộ đọc XML tối giản (`web/src/features/roster/domain/xlsx.ts`), tạm dùng trong giai đoạn thử nghiệm theo chấp thuận của chủ dự án. Chỉ đọc sheet **hiển thị** đầu tiên, shared strings, inline strings, rich text và giá trị cache của ô công thức.

Kiểm thử tương thích (17 test, 15 file mẫu dữ liệu giả sinh bởi `tools/roster-fixtures/generate.py`): số 0 đầu và tiếng Việt (kể cả NFD), ô số bị cảnh báo, ô công thức, hàng tiêu đề lệch xuống dưới ô gộp, sheet ẩn, rich text, ký tự thoát XML/Excel, namespace có tiền tố, đích quan hệ tuyệt đối, chú thích phiên âm, thiếu thuộc tính `r`, file cắt cụt/rác/không phải workbook, `.xls` cũ, file có mật khẩu, mục khai kích thước giả, quá 300 mục.

Giới hạn chưa chứng minh: **không có file lưu từ Excel, Google Sheets hay WPS**. XlsxWriter mô phỏng sát Excel nhưng không thay thế được. Nếu file thật của bạn không đọc được hoặc đọc sai, phương án thay thế đề xuất là `read-excel-file` (MIT, đang được bảo trì, ghim phiên bản chính xác, chạy trên server) hoặc `exceljs`; quyết định sau khi có kết quả `roster:check` trên file thật và `npm audit` của gói đó. Chưa rà CVE từng gói thay thế.

Đánh đổi vẫn là tự bảo trì bộ đọc; không hỗ trợ `.xls`, công thức không được tính lại. Giới hạn bảo vệ: ≤ 300 mục, ≤ 16 MiB khai báo mỗi mục, ≤ 48 MiB tổng, chỉ giải nén phần cần dùng.

## 7. Cách chạy lại

```bash
bash scripts/db/local-stack.sh up        # hoặc: npx supabase@2.115.0 start
bash scripts/db/test-db.sh                # pgTAP
npm --prefix web run test:integration     # Postgres + GoTrue thật
npm --prefix web run test && npm --prefix web run lint
node scripts/security/scan-secrets.mjs
```
