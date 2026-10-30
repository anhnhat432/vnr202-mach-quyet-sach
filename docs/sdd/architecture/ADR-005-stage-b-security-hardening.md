# ADR-005: Cập nhật bảo mật và ranh giới tin cậy sau Giai đoạn B

Trạng thái: Accepted (2026-10-30)  
Liên quan: ADR-001 (phiên bản nền), ADR-002, ADR-004, `docs/sdd/evidence/phase-3/README.md`

## Bối cảnh

Rà soát Giai đoạn B và chạy CI trên stack Supabase chính thức cho thấy bốn vấn đề: phiên bản Next.js 16.3.1 nằm trong dải bị ảnh hưởng của nhiều GHSA; giới hạn đăng nhập theo IP tin vào header do client đặt; bù trừ khi nhập lớp không kiểm tra kết quả xóa; và migration dựa vào quyền mặc định mà Supabase đã bỏ.

## Quyết định

### 1. Nâng phiên bản nền (sửa ADR-001 §Runtime)

| Gói | Từ | Lên | Lý do |
|---|---|---|---|
| `next` | 16.3.1 | **16.4.3** | `npm audit`: dải 16.0.0–16.4.0 bị ảnh hưởng bởi 13 GHSA, gồm RCE trong Image Optimization API (AVIF, SVG), RCE trong `next/og`, SSRF trong Image Optimization, rò cache `use cache` (GHSA-h694-7cp9-m8p3, GHSA-673q-mjm6-r5xr, GHSA-3w37-wq28-93x7), đầu độc cache SSG/ISR tự lưu trữ, DoS Server Actions, lộ thông tin dev server MCP. 16.4.1 là bản vá đầu tiên; chọn 16.4.3 (bản `latest` tại thời điểm này) để nhận các bản vá sau đó. |
| `eslint-config-next` | 16.3.1 | 16.4.3 | Cùng dòng với `next`. |
| `zod` | 4.4.3 | **4.6.7** | GHSA-mrhx-c7xc-m3w5: có thể cạn bộ nhớ khi xác thực tập hợp lớn có ràng buộc. `zod` là phụ thuộc runtime xác thực mọi đầu vào API. |
| `source-map-js` | 1.2.1 | 1.2.2 (chỉ lockfile) | DoS qua source map; phụ thuộc gián tiếp của công cụ build. |

Đánh giá mức ảnh hưởng với dự án (bằng `grep` mã nguồn, **không** thử khai thác từng GHSA): không dùng `next/image`, `ImageResponse`/`next/og`, `'use cache'`/Cache Components, `draftMode`, Server Actions (`'use server'`) hay `unstable_cache`, và `next.config.ts` không bật tính năng ảnh. Triển khai trên Vercel nên các lỗi cache tự lưu trữ cũng ít liên quan. Dù vậy vẫn nâng cấp vì (a) route handler và build dùng chung lõi, (b) tính năng có thể được thêm sau. Kết quả: `npm audit --omit=dev` = 0 lỗ hổng; build, 86 unit test, 31 test tích hợp, 14 E2E pass trên 16.4.3.

**Còn lại, không xử lý:** `vitest`/`@vitest/mocker` (moderate) và `vite` (high), chỉ là công cụ dev/test, không vào bundle. Nâng `vitest` lên 4.1.12 làm npm 10.9.4 báo lỗi nội bộ (`Cannot read properties of null (reading 'edgesOut')`) trên lockfile hiện tại; giữ bản đã ghim cho tới khi npm khắc phục hoặc lockfile được dựng lại có kiểm soát. `npm audit fix` cũng gặp lỗi tương tự nên không dùng.

### 2. IP của client chỉ lấy từ proxy đáng tin

`X-Forwarded-For` là danh sách mà mỗi proxy **thêm vào cuối**; mọi thứ bên trái các mục do proxy của ta thêm đều do client kiểm soát. Quyết định:
- `clientIp(request, hops)` đếm `hops` mục từ bên phải; không dùng mục đầu tiên và không dùng `x-real-ip`; giá trị không phải IP hợp lệ bị bỏ; ít mục hơn `hops` thì không đoán.
- `TRUSTED_PROXY_HOPS` (0–5). Mặc định 1 khi chạy trên Vercel (`VERCEL` được đặt), 0 ở nơi khác. Đặt 2 nếu có CDN đứng trước Vercel.
- Khi không có IP đáng tin (`null`), **bỏ giới hạn theo IP** thay vì dùng giá trị giả mạo được. Giới hạn theo MSSV vẫn áp dụng. Đánh đổi: ở môi trường không có proxy đáng tin, giới hạn theo IP không hoạt động; không có "xô chung" vì xô chung cho phép một kẻ tấn công khóa cả lớp.

### 3. Bù trừ khi nhập lớp phải xác minh

Xem `roster-compensation.ts`: mỗi lần xóa Auth user được kiểm tra và thử lại 3 lần; tài khoản có thể đã được tạo nhưng phản hồi bị mất được tìm lại bằng email nội bộ do ta sinh ra; việc xóa được xác minh lại với Auth và bảng `profiles`; phần còn sót bị khóa và ghi lại; bản nhập kết thúc ở trạng thái `failed` với mã lỗi riêng `roster_cleanup_incomplete` và có đường dọn lại `POST /admin/roster-imports/{id}/cleanup`. Nhật ký audit dùng hành động khác nhau cho "đã dọn sạch" và "dọn chưa xong".

### 4. Quyền bảng phải được cấp tường minh

Supabase không còn tự cấp quyền cho bảng mới ở `public` (config.toml `auto_expose_new_tables`; chú thích trong file ghi trường này sẽ bị gỡ ngày 2026-10-30). Migration `202610300001_identity_grants.sql` cấp `SELECT` cho `authenticated` (RLS lọc hàng), toàn quyền DML cho `service_role`, không gì cho `anon`. Harness cục bộ nay mô phỏng đúng mặc định này; pgTAP kiểm quyền bằng `has_table_privilege`. Đây là migration mới, không sửa migration đã tạo.

## Hệ quả

- ADR-001 ghi `Next.js 16.3.1`, `Zod 4.4.3`: hai dòng đó được thay bằng bảng ở mục 1.
- Cần đặt `TRUSTED_PROXY_HOPS` đúng khi triển khai ngoài Vercel; không đặt thì mất giới hạn IP (an toàn nhưng yếu hơn).
- Nên chạy lại `npm audit` trước mỗi lần triển khai; thêm kiểm tra này vào CI là việc còn mở.
