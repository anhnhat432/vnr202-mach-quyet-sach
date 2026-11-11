# Giai đoạn C – Ngân hàng câu hỏi (nghiệm thu)

Ngày: 2026-10-30. Phạm vi: schema, quy trình Draft → Reviewed → Published, công cụ, dữ liệu giả lập, phân bổ cân bằng, đợt nháp đầu. **Không** có gameplay, lượt chơi, bảng xếp hạng hay giao diện quản trị (T055).

## Đã làm
| Hạng mục | Nơi |
|---|---|
| Schema + quy tắc duyệt trong DB + hàm | `supabase/migrations/202610300002_question_bank.sql` |
| Phân bổ cân bằng, đếm phân bổ/hiển thị, câu đã lộ, báo cáo sẵn sàng | cùng migration |
| API quản trị (tạo Draft, chuyển trạng thái, danh sách, sẵn sàng) | `web/src/app/api/v1/admin/question*`, `web/src/features/questions/` |
| Xác thực file, dữ liệu giả lập 87/168, gói duyệt | `scripts/lib/question-bank.mjs`, `scripts/content/questions.mjs` |
| Nạp dữ liệu giả lập (chỉ DB local), đồng bộ sổ nguồn | `scripts/content/load-question-fixtures.mjs`, `scripts/content/sync-sources.mjs` |
| 31 câu nháp do AI soạn, gói duyệt cho người | `docs/sdd/content/questions/*.json`, `docs/sdd/content/reviews/question-bank-drafts-review-pack.md` |

## Kiểm thử (cục bộ, harness dự phòng; CI chính thức xem PR #6)
- pgTAP `question_bank.sql`: 52 assertion; `identity_rls.sql` 30; `public_content_rls.sql` 6.
- Tích hợp (Postgres + GoTrue thật): phân bổ 11 test (gồm **60 lượt đồng thời** cho cả hai game: chênh lệch trong một ô ≤ 1, tổng đếm đúng), quản trị 19 test, cộng các bộ cũ.
- Unit: `question-bank.test.ts` 13 test. E2E HTTP: `question-bank.spec.ts` (CSRF, 422 khi lén `status`/`origin`, vòng đời duyệt → xuất bản, sinh viên nhận 404).
- Đối chứng: bỏ khóa phân bổ → 3 test fail (kể cả quá thời gian chờ); bản nháp bị cập nhật trực tiếp sang `reviewed` không có người duyệt → `human_reviewer_required`.
- Quét bundle client: không có `correctOptionId`, `content_private`, `[GIẢ LẬP]`.

## Lỗi thật tìm thấy khi làm
- `z.uuid()` của Zod 4 từ chối id nguồn dạng tuần tự trong sổ nguồn (`10000000-0000-0000-0000-00000000000x`); đổi sang `z.guid()` và thêm test.
- Bảng `sources` trong DB chỉ có nguồn của 3 hồ sơ đã Published; nhập câu hỏi bị lỗi khóa ngoại. Thêm `sync-sources.mjs`.
- Test cũ `identity_rls` giả định bảng audit rỗng; sửa thành lọc theo dữ liệu của chính test.

## Hạn chế
- Ngân hàng thật: **31/87 nháp, 0 Published**, chưa có người duyệt học thuật. Chương 3 chỉ có một hồ sơ có nội dung nên thiếu phủ.
- Câu nháp được soạn *từ nội dung hồ sơ*, mà hồ sơ cũng do AI hỗ trợ và chưa được duyệt; vị trí trích dẫn là phạm vi tài liệu (giáo trình chương, dải slide) chứ chưa phải trang cụ thể. Người duyệt phải đối chiếu trực tiếp.
- Đáp án gây nhiễu do AI chọn từ kiến thức chung; chưa kiểm tra độc lập.
- Quy tắc chênh lệch ≤ 1 (`LA-ALLOC-011`) và trần 5 câu hai lựa chọn (`LA-ALLOC-010`) không thể cùng đúng tuyệt đối khi nguồn cung câu ba lựa chọn thiếu; xem ghi chú trong spec §5.5.
- Bộ test phân bổ cần DB không có câu Published ngoài chính nó (sẽ xóa câu giả lập đang nạp và từ chối chạy nếu có câu Published thật).
