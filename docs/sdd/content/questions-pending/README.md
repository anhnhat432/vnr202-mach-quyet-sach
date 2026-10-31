# Câu nháp chờ xác minh nguồn

6 câu về chủ đề/khẩu hiệu/tinh thần Đại hội IX, XI, XIII (Chủ đề 6). Các nội dung này **không có** trong các trang giáo trình đã đọc, nên mỗi câu dựa vào một nguồn báo chí/cổng thông tin trong `docs/sdd/content/sources-pending.json` (trạng thái `pending`). Công cụ ngân hàng câu hỏi không đọc thư mục này; nếu chuyển các câu sang `questions/` khi nguồn còn `pending`, validator sẽ báo lỗi `UNKNOWN_SOURCE` hoặc `SOURCE_NOT_VERIFIED`.

| Key | Nội dung | Nguồn chờ xác minh |
|---|---|---|
| `t6-race-046` | Phương châm Đại hội XIII | `…0025` Báo Pháp luật Việt Nam, 25/01/2021 |
| `t6-race-047` | Chủ đề Báo cáo chính trị Đại hội IX | `…0023` TTXVN/Vietnam+ trên cổng Bộ Công Thương |
| `t6-race-048` | Mốc 2020 trong chủ đề Đại hội XI | `…0024` VnEconomy, 12/01/2011 |
| `t6-race-049` | Tinh thần "Trí tuệ, Dân chủ, Đoàn kết, Đổi mới" (Đại hội IX) | `…0023` |
| `t6-mine-031` | Chủ đề Đại hội XI so với XII, XIII | `…0024` |
| `t6-defuse-013` | Phương châm XIII so với tinh thần XII | `…0025` |

Đại hội VIII: không tìm được khẩu hiệu/chủ đề chính thức trong nguồn đã tra, nên không có câu.

## Cách đưa vào ngân hàng (do người duyệt làm)
1. Mở URL của từng nguồn, đối chiếu đoạn `quote`. Nên đối chiếu thêm *Văn kiện Đại hội* tương ứng (NXB Chính trị quốc gia) nếu có.
2. Nếu đúng: chuyển mục sang `docs/sdd/content/sources.json`, đặt `verificationStatus: "verified"`, bỏ `quote` và `checkedBy`.
3. Chuyển các câu tương ứng vào `docs/sdd/content/questions/race.json`, `minefield-main.json`, `minefield-defuse.json`.
4. Chạy `node scripts/content/questions.mjs validate` và tạo lại gói duyệt.

Ngân hàng chính sẽ thành 93 câu (vượt mục tiêu 87, vẫn hợp lệ).
