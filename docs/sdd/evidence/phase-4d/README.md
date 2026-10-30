# Giai đoạn D – Lõi thi đấu (nghiệm thu)

Ngày: 2026-10-30. Phạm vi: cuộc thi + trạng thái hai game + luật Bãi Mìn / Đường Đua + hai BXH ở **tầng cơ sở dữ liệu**. Chưa có API HTTP (Giai đoạn E), chưa có giao diện/trình chiếu/hiệu ứng (Giai đoạn F).

## Đã làm
| Hạng mục | Nơi |
|---|---|
| Schema cuộc thi, lượt, phân bổ, ô bàn cờ, bài nộp, sổ điểm, BXH; RLS bật, không đặc quyền client | `supabase/migrations/202610300003_competition_core.sql` |
| Máy trạng thái cuộc thi, sẵn sàng → ảnh chụp ngân hàng (snapshot) khi chuyển Draft → Scheduled | `transition_competition`, `take_competition_snapshot`, `competition_pool` |
| Bắt đầu/tiếp tục lượt (một lượt/MSSV/game/cuộc thi, một lượt hoạt động trên hai game) | `start_or_resume_attempt` |
| Phát hành nội dung câu (long-poll / 425), đồng hồ DB, đối soát hết giờ, bộ đếm hiển thị đúng một lần | `get_interaction_content`, `arena_clock`, `arena_reconcile` |
| Bãi Mìn: bàn cờ 10/3/1/2/4, đổi ô bom đầu, x2, khiên, gỡ bom, sàn 0, tối đa 2 460 | `open_minefield_cell`, `submit_answer`, `arena_resolve` |
| Đường Đua: 5/7/3, combo, tối đa 2 300, hết giờ | `submit_answer`, `arena_resolve` |
| Chuyển thiết bị, heartbeat, sảnh | `transfer_attempt_session`, `heartbeat_attempt`, `arena_lobby` |
| BXH (hạng đồng, Top 10, nhãn tạm thời/chính thức/diễn tập), vị trí cá nhân, finalize, xem lại | `get_leaderboard`, `get_player_standing`, `finalize_competition`, `get_attempt_review` |
| Mô hình tham chiếu TypeScript + test song song với SQL | `web/src/features/arena/domain/scoring.ts` |
| Q1 (giới hạn cứng 5 câu hai lựa chọn, lỗi `QB002`), Q3 (`sync-sources.mjs`: `--confirm`, không tự nâng pending → verified, ghi audit) | migration, spec `LA-ALLOC-011`, `scripts/content/sync-sources.mjs` |
| Chạy thử hai game trên localhost bằng bot (không UI) | `scripts/dev/arena-demo.mjs` |

## Kiểm thử (cục bộ, harness dự phòng)
- pgTAP: `competition_core.sql` 22 assertion (quyền, RLS, không có `now()`/`current_timestamp` trong hàm, ràng buộc duy nhất, đồng hồ thử nghiệm chỉ bật khi cho phép); tổng 4 file / 110 assertion.
- Tích hợp (Postgres thật, kết nối đồng thời bằng `pg` Pool): 114 test; mới trong D: `competition-core.test.ts` 25, `arena-games.test.ts` 26, `sources-sync.test.ts` 2.
- **Bộ đếm hiển thị** (`LA-ALLOC-012`): F5, gọi lại, 12 lời gọi đồng thời (đồng hồ cố định và đồng hồ thật), chuyển thiết bị, câu đã trả lời, câu chưa mở, câu không bao giờ phát hành → `displayed_count` tăng đúng 1 lần cho mỗi câu thực sự phát hành.
- Thời gian: không nội dung trước `available_at` (425 + `availableInMs`), tải muộn không kéo dài hạn, biên chính xác và +1 ms với độ trễ 100/300/600/1000 ms, hạn vượt `ends_at`, câu không bao giờ phát hành, chờ khóa, transaction cũ, `lock_timeout` (55P03, không ghi gì), ghi hết giờ chỉ sau hạn + độ trễ + `lock_wait_limit`.
- Song song: 20 lượt bắt đầu cùng lúc một MSSV = 1 lượt; hai game cùng lúc = 1 thắng; 10 lần gửi cùng khóa / khác khóa = chấm một lần; mở hai ô cùng lúc = một lần.
- Tải: 60 người chơi trả lời cùng lúc trên đồng hồ thật, sổ điểm = điểm cho cả 60; độ trễ nộp bài p50 35 ms, tối đa 896 ms (harness cục bộ, chưa phải đo P7 chính thức).
- Song song SQL ↔ TypeScript: 14 ván ngẫu nhiên mỗi game, so từng bước.
- Unit 100 test, `tsc`, ESLint, quét bí mật, kiểm tra tài liệu: đạt.

## Lỗi thật tìm thấy khi làm
- Hàm đọc BXH cá nhân đầu tiên dùng bảng tạm trong hàm STABLE (không cho phép) → viết lại bằng một truy vấn CTE.
- Kiểm tra trần 5 câu hai lựa chọn chạy trước kiểm tra thiếu ngân hàng làm lỗi `QB001` thành `QB002`; nay chỉ báo `QB002` khi ngân hàng đủ nhưng thiếu câu ba lựa chọn (test giai đoạn C cập nhật theo quyết định Q1).
- Biến PL/pgSQL `o` trùng bí danh cột trong câu lệnh chèn → đổi tên.

## Hạn chế / chưa làm (cố ý)
- Chưa có API HTTP/OpenAPI (T047), Realtime broadcast, UI (T050–T054), trang quản trị cuộc thi (T056), thao tác sự cố (`LA-ADMIN-003`, bảng `attempt_incidents`).
- Chưa đo P2 (độ trễ Wi-Fi) và P7 (chờ khóa thực tế); các hằng số vẫn `[THỬ NGHIỆM]`.
- Câu hỏi thật: vẫn 31 nháp, 0 Published; mọi test dùng câu giả lập. Cuộc thi `official` không thể lên lịch cho tới khi có câu Published (readiness chặn).
- `question_exposures.competition_id` chưa có khóa ngoại; dọn dẹp bộ đếm khi xóa cuộc thi là thủ công.
- Giữ chỗ lock hàng khi long-poll (≤ 1 s) là của chính lượt đó, không chặn người khác.
