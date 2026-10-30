# Kiểm tra tính nhất quán tài liệu Live Arena V1.0

Ngày: 2026-10-29 (bản sửa 2 của Giai đoạn A)  
Công cụ: `tools/sdd/check-live-arena-docs.mjs` — thoát mã 1 nếu có lỗi.

```bash
node tools/sdd/check-live-arena-docs.mjs
```

> **Giới hạn:** checker chỉ kiểm tra **cấu trúc và thuật ngữ** (mã luật, tham chiếu, truy vết, task, nhãn, các mẫu câu bị cấm). Kết quả 0 lỗi **không** chứng minh mọi luật đúng về ngữ nghĩa, nhất quán logic với nhau hay khả thi khi triển khai; điều đó cần người rà soát và kiểm thử ở các giai đoạn sau.

## Các kiểm tra

1. Mã luật và tiêu chí chấp nhận trong spec là duy nhất; nhãn thuộc tập cho phép.
2. Mọi tham chiếu `LA-*`, `MINE-*`, `RACE-*` (kể cả dạng khoảng `..` và `/`) trong `docs/sdd/**/*.md` và `AGENTS.md` đều tồn tại trong spec.
3. Mọi luật và tiêu chí chấp nhận đều được phủ trong `traceability-matrix.md`.
4. Task được nhắc trong spec, traceability và PLAN tồn tại trong `TASKS.md`.
5. Mỗi điểm còn mở trong spec §12.2.1 gắn với ít nhất một task; TASKS không còn chặn bởi O1–O14. 5b: luật được nêu trong bảng quyết định không còn mang nhãn ĐỀ XUẤT (trừ điểm còn mở).
6. Mọi rule v1.0 được nhắc trong Core §16 tồn tại trong Core spec.
7. Hợp đồng kiến trúc, Product spec và Figma brief không còn thuật ngữ cũ (`decision_room`, game `timeline`, grace pause, `mustChangePassword`, `feedback/continue`, `full_name_snapshot`), trừ dòng ghi chú lịch sử.
8. Response mở ô và trả lời trong API contract không chứa nội dung câu; endpoint lấy nội dung nêu điều kiện `available_at`.
9. Không còn mẫu MSSV cố định gắn `[CHỐT]` và không còn giới hạn 100 hàng.
10. Tài liệu không tuyên bố chống tra cứu/chia sẻ đáp án tuyệt đối (mọi câu như vậy phải ở dạng phủ định).
11. Không tài liệu hiện hành nào còn yêu cầu công khai họ tên đầy đủ (N1).
12. Không có kết luận dạng tuyệt đối về việc đồng hồ toàn trận có bị chạm hay không.
13. Spec và hợp đồng kiến trúc không dùng `now()` làm mốc quyết định (`LA-TIME-019`).

Lịch sử phát hiện: bản sửa 1 bắt được thiếu truy vết `LA-AC-005`; bản sửa 2 bắt được 5 chỗ trong data-model và API còn dùng `now()` làm mốc quyết định, cùng thiếu truy vết `LA-CONTENT-013/014` — đều đã sửa. Kiểm tra âm tính (bản sửa 1): chèn mã luật không tồn tại, task không tồn tại và nội dung câu vào response mở ô → checker báo đủ 3 lỗi.

## Bảng nhãn theo nhóm luật

| Nhóm | CHỐT | CHỐT V0.1 | THỬ NGHIỆM | ĐỀ XUẤT | MỞ |
|---|---:|---:|---:|---:|---:|
| `LA-SCOPE` | 5 |  |  |  |  |
| `LA-ACC` | 14 |  | 2 |  | 2 |
| `LA-TRY` | 7 |  |  |  |  |
| `LA-TIME` | 19 |  | 4 |  |  |
| `LA-ALLOC` | 12 |  |  |  |  |
| `MINE-BOARD` | 8 |  |  |  |  |
| `MINE-Q` | 2 |  |  |  |  |
| `MINE-BOMB` | 5 |  |  |  |  |
| `MINE-ITEM` | 4 |  |  |  |  |
| `MINE-END` | 4 |  |  |  |  |
| `RACE` | 2 | 9 |  |  |  |
| `LA-FB` | 6 |  | 1 |  |  |
| `LA-LB` | 12 |  |  |  |  |
| `LA-ANTI` | 7 |  |  |  |  |
| `LA-IDEM` | 4 |  |  |  |  |
| `LA-ADMIN` | 4 |  |  |  |  |
| `LA-CONTENT` | 12 |  | 1 | 1 |  |
| `LA-UX` | 6 |  |  |  |  |
| `LA-PRV` | 5 |  |  |  |  |
| `LA-NFR` | 2 |  |  |  |  |
| **Tổng (160 luật)** | **140** | **9** | **8** | **1** | **2** |

## Luật chưa ở trạng thái CHỐT

- **THỬ NGHIỆM** (8): `LA-ACC-008`, `LA-ACC-017`, `LA-TIME-002`, `LA-TIME-006`, `LA-TIME-018`, `LA-TIME-023`, `LA-FB-002`, `LA-CONTENT-008`
- **ĐỀ XUẤT** (1): `LA-CONTENT-014`
- **MỞ** (2): `LA-ACC-013`, `LA-ACC-014`

## Kết quả kiểm tra

- Luật: 160; tiêu chí chấp nhận: 38; điểm còn mở: N6, N9, LA-CONTENT-014.
- Tài liệu quét: 28 (28 file Markdown dưới docs/sdd và AGENTS.md).
- Lỗi: 0
