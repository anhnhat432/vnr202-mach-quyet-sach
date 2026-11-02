# Giai đoạn F – Giao diện hai game, bảng xếp hạng, trình chiếu, quản trị

Ngày: 2026-10-30. Dữ liệu: câu giả lập [GIẢ LẬP] trong cuộc thi diễn tập; không câu thật nào được Published.

## Đã làm
| Phần | Trang / nơi |
|---|---|
| F1 Sảnh + Bãi Mìn Tri Thức | `/live-arena`, `/live-arena/bai-min` — `web/src/features/arena/ui/minefield-game.tsx` |
| F2 Đường Đua Lịch Sử | `/live-arena/duong-dua` — `race-game.tsx` |
| Lõi client dùng chung | `web/src/features/arena/client/use-arena-game.ts` (chỉ hiển thị projection của server; lấy nội dung khi server có câu; khóa idempotency dùng lại khi thử lại; đồng bộ lại khi F5/focus/mất mạng) |
| F3 BXH realtime | `/live-arena/bang-xep-hang`, `use-leaderboard.ts`, migration `202610310002_arena_broadcast.sql` (Broadcast chỉ là tín hiệu, envelope không có tên/điểm) |
| F4 Trình chiếu 1920×1080 | `/trinh-chieu` (phím 1/2/0, thông báo vượt hạng và dẫn đầu mới) |
| F5 Quản trị | `/quan-tri/dang-nhap`, `/quan-tri/cuoc-thi` (tạo/điều khiển/đối soát/theo dõi), `/quan-tri/ngan-hang-cau-hoi`, `/live-arena/xem-lai`; migration `202610310003_arena_admin_views.sql` |
| Chuyển thiết bị có xác nhận | Đăng nhập lại hay vào lại game **không** chuyển quyền; hộp "Lượt thi đang mở ở thiết bị khác" → `/transfer`; thiết bị cũ bị từ chối và nhận cùng hộp xác nhận |
| Diễn tập cục bộ | `scripts/dev/arena-rehearsal-setup.mjs` (câu giả lập, sinh viên DEMO, cuộc thi diễn tập đang mở; chỉ DB local) |

## Kiểm thử
- E2E trình duyệt trên stack thật (`arena-ui.spec.ts` 6, `arena-api.spec.ts` 1, `arena-admin.spec.ts` 1): chơi bằng bàn phím; F5 giữ nguyên câu, điểm, đồng hồ; mất mạng → banner → đồng bộ lại; chuyển thiết bị chỉ sau khi xác nhận, thiết bị cũ bị khóa; Bãi Mìn F5 giữa câu không lùi hạn; BXH người xem tự cập nhật không cần tải lại, qua mất mạng; trình chiếu hai bảng / phóng to; quản trị tạo → mở → theo dõi (có MSSV) → không cho kết thúc khi còn lượt → sinh viên chơi hết 15 câu → kết thúc → sinh viên xem lại 15 câu kèm đáp án; quét mọi phản hồi gameplay không có `correctOptionId`/`explanation`.
- pgTAP 4 file / 114 assertion (thêm 3 cho Broadcast: topic, event, payload chỉ có envelope). Tích hợp 126 test (thêm `arena-admin.test.ts`). Unit 115. `tsc`, ESLint, build, quét bí mật: đạt.

## Lỗi thật tìm thấy khi làm
- Phản hồi "Chính xác +150" đè lên câu kế tiếp ~100 ms (trái `LA-FB-002`) → phản hồi Đường Đua chuyển lên đầu sân và biến mất khi câu mới hiện.
- `GET /arena/competitions/current` đọc bảng trực tiếp; đổi sang RPC `security definer` như các route khác.

## Hạn chế / còn mở
- Realtime Broadcast không chạy được trong harness cục bộ và CI (không có dịch vụ Realtime); đường đồng bộ định kỳ đã được kiểm thử. CSP `connect-src` hiện chỉ cho `https/wss` của Supabase (đúng cho production).
- Chưa có: thao tác sự cố admin và trình xem audit (T056), giao diện xác nhận tái sử dụng câu đã lộ, đo Wi-Fi/tải thật (T062/T066/T067), audit trợ năng đầy đủ (T061).
- `next dev` trong sandbox tự tải lại trang định kỳ (môi trường), ảnh chụp dùng bản build production.
