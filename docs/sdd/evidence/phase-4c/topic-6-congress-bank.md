# Ngân hàng câu hỏi Chủ đề 6 – Các kỳ Đại hội Đảng 1991–2021

Ngày: 2026-10-31 (bản 2, sau rà soát của nhóm). Task: `T114`. Nguồn: *Giáo trình Lịch sử Đảng Cộng sản Việt Nam* (Bộ GD&ĐT, NXB Chính trị quốc gia Sự thật, 2021), Chương 3, mục II, tr. 272–397; nguồn `10000000-0000-0000-0000-000000000001` trong sổ nguồn (`verified`).

## Yêu cầu của nhóm
Chủ đề 6: có bao nhiêu kỳ Đại hội Đảng từ 1991 đến 2021; mỗi kỳ trình bày thời gian, địa điểm, khẩu hiệu/tinh thần chung và các nhiệm vụ cơ bản. Giáo trình xác nhận **7 kỳ**: VII (1991), VIII (1996), IX (2001), X (2006), XI (2011), XII (2016), XIII (2021), đều họp tại Hà Nội.

## Trạng thái ngân hàng
- **87 câu, tất cả thuộc Chủ đề 6** (key `t6-*`, `chapter_3`, `aiAssisted: true`), 0 Published. Mỗi câu ghi trang giáo trình trong `locator`.
- Phân bố đúng hồ sơ 87: `race` 15/21/9, `minefield_main` 9/12/9, `minefield_defuse` 12 (dễ/vừa/khó).
- 31 câu `ai-*` ngoài chủ đề đã chuyển sang `docs/sdd/content/questions-archive/` (không xóa).

## Thay đổi sau rà soát
| Câu | Vấn đề | Xử lý |
|---|---|---|
| `t6-defuse-004` | Hỏi năm "gia nhập WTO", dễ tranh cãi 2006/2007 | Hỏi năm WTO **chấp thuận** việc gia nhập (2006); giải thích nêu thành viên có hiệu lực 11/1/2007 |
| `t6-race-011` | Gắn mốc 11/2006 với tư cách thành viên | Chỉ hỏi "thành viên thứ mấy" (150) |
| `t6-race-022` | Nhãn "Gia nhập WTO (11/2006)" | Đổi thành "WTO chấp thuận gia nhập (11/2006)"; đáp án không đổi |
| `t6-mine-019` | Quy 27 biểu hiện về riêng nhóm "tự diễn biến, tự chuyển hóa" | Hỏi mục đích Nghị quyết 04-NQ/TW, không hỏi con số 27; ghi chú ba nhóm biểu hiện cho người duyệt |
| `t6-race-027` | Số ủy viên Bộ Chính trị khóa XII không gắn thời điểm | Hỏi Bộ Chính trị "được bầu tại Đại hội XII" |
| `t6-defuse-005` | Trùng nội dung với `t6-mine-003` (Nông Đức Mạnh) | Thay bằng câu "30 năm thực hiện Cương lĩnh 1991" (Đại hội XIII) |

Mốc WTO đã đối chiếu với trang chính thức của WTO (*Accessions: Viet Nam*): Đại hội đồng chấp thuận ngày 7/11/2006, thành viên từ 11/1/2007. Trang này **chưa** được thêm vào sổ nguồn, vì xác minh nguồn là việc của người duyệt; mốc này được ghi trong `usageNote` của ba câu WTO.

## 31 câu mới theo khung đề bài
| Nhóm nội dung | Số câu | Ví dụ key |
|---|---|---|
| Thời gian họp (VIII, X, XI, XII, XIII, ghép cặp IX–XII) | 7 | `t6-race-031..033`, `t6-race-036`, `t6-mine-022`, `t6-mine-025`, `t6-defuse-007` |
| Chủ đề/tinh thần (VII, IX, X, XII, XIII) | 7 | `t6-race-034`, `t6-race-037`, `t6-race-038`, `t6-race-043`, `t6-mine-026`, `t6-mine-029`, `t6-defuse-008` |
| Nhiệm vụ cơ bản/trọng tâm (VII, VIII, IX, X, XI, XII, XIII) | 7 | `t6-race-035`, `t6-race-039..041`, `t6-mine-023`, `t6-mine-027`, `t6-mine-028` |
| Văn kiện, mục tiêu, quyết định | 7 | `t6-race-042`, `t6-race-044`, `t6-race-045`, `t6-mine-030`, `t6-defuse-010..012` |
| Tổng số kỳ, chu kỳ, so sánh | 3 | `t6-race-030`, `t6-mine-024`, `t6-defuse-009` |

Câu mức khó mới chủ yếu kiểm tra **phân biệt giữa các kỳ** (chủ đề nào thuộc Đại hội nào, đặc trưng được bổ sung ở kỳ nào, mục tiêu giữa thế kỷ XXI của Cương lĩnh 2011 so với Đại hội XIII), không dựa vào con số khó nhớ.

## Kiểm tra đã chạy
- `node scripts/content/questions.mjs validate`: 87 câu, 0 lỗi, 0 cảnh báo (đề ≤ 80, đáp án ≤ 40 ký tự).
- Câu hai lựa chọn của `race`: dễ 1/15, vừa 1/21, khó 0/9. Vị trí đáp án đúng: A 32, B 31, C 24.
- File lưu trữ vẫn hợp lệ: `validate docs/sdd/content/questions-archive/*.json` không lỗi.
- Unit `question-bank.test.ts`, `bank-confirmation.test.ts`: 16 test đạt.
- Gói duyệt tạo lại: `docs/sdd/content/reviews/question-bank-drafts-review-pack.md` (87 câu).

## Hạn chế còn lại
- **Tất cả là Draft, chưa có người duyệt học thuật** (`LA-CONTENT-004`, `T115`).
- Giáo trình là **ảnh scan**; số liệu và số trang đọc bằng mắt, người duyệt cần đối chiếu sách gốc.
- **Khẩu hiệu/chủ đề của Đại hội VIII, IX, XI** và phương châm "Đoàn kết - Dân chủ - Kỷ cương - Sáng tạo - Phát triển" của Đại hội XIII **không có** trong các trang giáo trình đã đọc. Ngân hàng chính chỉ dùng chủ đề/tinh thần có trong giáo trình (VII tr. 277, X tr. 310, XII tr. 367, XIII tr. 387) và đặc điểm của IX (mở đầu thế kỷ XXI, tr. 296).
- **Cập nhật cùng ngày:** theo chỉ đạo của chủ dự án, 3 nguồn dưới đây được chuyển vào `sources.json` với trạng thái `verified` và 6 câu được đưa vào ngân hàng chính (93 câu). Căn cứ xác minh là đoạn trích AI đọc trực tiếp từ các trang ngày 2026-10-31; chưa đối chiếu với bộ *Văn kiện Đại hội* (NXB Chính trị quốc gia). Sau khi chuyển: validator 93 câu, 0 lỗi, 0 cảnh báo; `generate:content` chỉ thêm 3 nguồn vào catalog; 131 unit test và typecheck đạt.
- **Ghi chép ban đầu (khi còn chờ xác minh):** 6 câu về chủ đề/tinh thần IX, XI và phương châm XIII nằm trong `docs/sdd/content/questions-pending/`, dựa vào 3 nguồn ở `docs/sdd/content/sources-pending.json` (TTXVN/Vietnam+ trên cổng Bộ Công Thương; VnEconomy 12/01/2011; Báo Pháp luật Việt Nam 25/01/2021), trạng thái `pending`. Các nguồn này được để ngoài `sources.json` vì `build-content-catalog.mjs` đưa toàn bộ sổ nguồn vào nội dung web, trong khi schema hồ sơ chỉ chấp nhận nguồn `verified`. Kiểm tra định dạng 6 câu (khi tạm coi nguồn là verified): 0 lỗi, 0 cảnh báo. Đại hội VIII không có câu khẩu hiệu vì không tìm được khẩu hiệu/chủ đề chính thức; bài của Bộ Công Thương chỉ mô tả Đại hội VIII là "Đại hội tiếp tục đổi mới vì sự nghiệp xây dựng và bảo vệ Tổ quốc, vì hạnh phúc của nhân dân".
- Chưa đọc tr. 374–379 và 398–407.
- Chưa import vào Supabase và chưa chạy test tích hợp cần database. Nếu database đã có các câu `ai-*`, phải retire thủ công.
- Đáp án gây nhiễu do AI chọn, chưa được kiểm tra độc lập.
