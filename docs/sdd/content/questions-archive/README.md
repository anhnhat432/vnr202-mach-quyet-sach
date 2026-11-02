# Câu nháp đã tách khỏi ngân hàng

31 câu nháp `ai-*` (soạn từ các hồ sơ giai đoạn 1930–1986) được tách khỏi `docs/sdd/content/questions/` ngày 2026-10-31 vì nằm ngoài Chủ đề 6 của nhóm (Đại hội VII–XIII, 1991–2021). Công cụ `scripts/content/questions.mjs` chỉ đọc thư mục `questions/`, nên các câu này không còn được validate, import hay đưa vào gói duyệt mặc định.

Nội dung giữ nguyên để dùng lại nếu cần: `node scripts/content/questions.mjs validate docs/sdd/content/questions-archive/*.json`.

Nếu các câu này đã từng được import vào một database Supabase, việc tách file **không** xóa chúng khỏi database; người quản trị cần retire chúng trong màn hình quản trị ngân hàng câu hỏi.
