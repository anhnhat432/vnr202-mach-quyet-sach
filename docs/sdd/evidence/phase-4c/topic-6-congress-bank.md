# Ngân hàng câu hỏi Chủ đề 6 – Các kỳ Đại hội Đảng 1991–2021

Ngày: 2026-10-31. Task: `T114` (một phần). Nguồn: *Giáo trình Lịch sử Đảng Cộng sản Việt Nam* (Bộ GD&ĐT, NXB Chính trị quốc gia Sự thật, 2021), Chương 3, mục II, tr. 272–397; nguồn `10000000-0000-0000-0000-000000000001` trong sổ nguồn (`verified`).

## Yêu cầu của nhóm
Chủ đề 6 (đề bài của nhóm): có bao nhiêu kỳ đại hội Đảng từ 1991 đến 2021; mỗi kỳ trình bày thời gian, địa điểm, khẩu hiệu/tinh thần chung và các nhiệm vụ cơ bản. Giáo trình xác nhận **7 kỳ**: VII (1991), VIII (1996), IX (2001), X (2006), XI (2011), XII (2016), XIII (2021).

## Đã làm
- 56 câu nháp mới, key `t6-race-001..029`, `t6-mine-001..021`, `t6-defuse-001..006`, mọi câu `chapter_3`, `aiAssisted: true`, ghi trang giáo trình cụ thể trong `locator` (vd. `Chương 3, mục II, tr. 272`).
- Phân bố đúng hồ sơ 87 câu: `race` 15/21/9, `minefield_main` 9/12/9, `minefield_defuse` 12 (dễ/vừa/khó).
- Nội dung phủ: thời gian, địa điểm, số đại biểu, nhân sự lãnh đạo (Tổng Bí thư, Bộ Chính trị, Ban Chấp hành), văn kiện chính (Cương lĩnh 1991, Cương lĩnh 2011, các Chiến lược), chủ đề và nhiệm vụ trọng tâm, bài học, các nghị quyết Trung ương và mốc đối ngoại (bình thường hóa với Trung Quốc 1991, ASEAN và quan hệ với Hoa Kỳ 1995, WTO 2006).
- Câu hỏi ngắn trong giới hạn thử nghiệm (đề ≤ 80, đáp án ≤ 40 ký tự); không có cảnh báo từ validator.

## Kiểm tra đã chạy
- `node scripts/content/questions.mjs validate`: 87 câu, 0 lỗi, 0 cảnh báo, độ phủ 87/87 (168 → 87/168).
- Vị trí đáp án đúng của 56 câu mới: A 20, B 19, C 17 (cân bằng). Câu hai lựa chọn của `race`: dễ 3/15, vừa 1/21, khó 0/9, trong giới hạn 1/3 mỗi ô.
- Unit `question-bank.test.ts` và `bank-confirmation.test.ts`: 16 test đạt.
- Gói duyệt học thuật được tạo lại: `docs/sdd/content/reviews/question-bank-drafts-review-pack.md` (87 câu).

## Hạn chế
- **Tất cả là Draft, chưa có người duyệt học thuật, 0 Published** (`LA-CONTENT-004`, `T115`). AI soạn nháp, không được duyệt hoặc xuất bản.
- Bản giáo trình là **ảnh scan**, không có lớp chữ. Số liệu và số trang được đọc bằng mắt từ ảnh; các con số dễ nhầm giữa các kỳ (số đại biểu, số ủy viên, số nghị quyết) cần đối chiếu lại trên sách gốc. Trường hợp đặc biệt: Đại hội VII và X cùng 1.176 đại biểu, nên không có câu hỏi nào dựa riêng vào con số này.
- Các đáp án gây nhiễu (người, năm, số nghị quyết) do AI chọn và chỉ được đối chiếu với giáo trình khi nằm trong phạm vi các trang đã đọc; chưa kiểm tra độc lập.
- Chưa đọc các trang 374–379 (Đại hội XII, sau đại hội) và 398–407 (bài học kinh nghiệm, hạn chế của đổi mới); chưa có câu hỏi nào dựa vào các trang đó.
- Chưa chạy được import vào Supabase (cần service-role key và actor admin, không có trong môi trường này) và chưa chạy bộ test tích hợp cần database.
- 56 câu mới đều thuộc `chapter_3`; ngân hàng gộp với 31 câu cũ (chương 1–2), nên một lượt chơi có thể trộn câu Chủ đề 6 với câu về giai đoạn 1930–1975 vì bộ cấp phát chỉ dùng chương làm tiêu chí phụ khi chọn câu. Nếu cuộc thi chỉ dùng Chủ đề 6, cần quyết định riêng (lọc theo tiền tố `t6-` hoặc retire các câu cũ); chưa làm việc này. Với 56 câu, mỗi ô blueprint chỉ vừa đủ cho một lượt (race dễ 9/5, vừa 14/7, khó 6/3; main dễ 6/3, vừa 8/4, khó 7/3; gỡ bom 6/3), nên độ lộ đáp án giữa các người chơi cao hơn so với bank 87 câu.
