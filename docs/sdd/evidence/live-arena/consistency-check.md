# Kiểm tra tính nhất quán tài liệu Live Arena V1.0

Ngày: 2026-10-29 (bản sửa 1 của Giai đoạn A)  
Công cụ: `tools/sdd/check-live-arena-docs.mjs` — thoát mã 1 nếu có lỗi.

```bash
node tools/sdd/check-live-arena-docs.mjs
```

## Các kiểm tra

1. Mã luật và tiêu chí chấp nhận trong spec là duy nhất; nhãn thuộc tập cho phép.
2. Mọi tham chiếu `LA-*`, `MINE-*`, `RACE-*` (kể cả dạng khoảng `..` và `/`) trong `docs/sdd/**/*.md` và `AGENTS.md` đều tồn tại trong spec.
3. Mọi luật và tiêu chí chấp nhận đều được phủ trong `traceability-matrix.md`.
4. Task được nhắc trong spec, traceability và PLAN tồn tại trong `TASKS.md`.
5. Mỗi điểm còn mở N1–N9 gắn với ít nhất một task; TASKS không còn chặn bởi O1–O14 đã quyết định.
6. Mọi rule v1.0 được nhắc trong Core §16 tồn tại trong Core spec.
7. Hợp đồng kiến trúc, Product spec và Figma brief không còn thuật ngữ cũ (`decision_room`, game `timeline`, grace pause, `mustChangePassword`, `feedback/continue`, `full_name_snapshot`), trừ dòng ghi chú lịch sử.
8. Response mở ô và trả lời trong API contract không chứa nội dung câu; endpoint lấy nội dung nêu điều kiện `available_at`.
9. Không còn mẫu MSSV cố định gắn `[CHỐT]` và không còn giới hạn 100 hàng.
10. Tài liệu không tuyên bố chống tra cứu/chia sẻ đáp án tuyệt đối (mọi câu như vậy phải ở dạng phủ định).

Kiểm tra âm tính: cố ý chèn một mã luật không tồn tại, một task không tồn tại và nội dung câu vào response mở ô; checker báo đủ 3 lỗi, sau khi khôi phục trở lại 0 lỗi. Giới hạn: kiểm tra 7 chỉ quét hợp đồng kiến trúc, Product spec và Figma brief.

## Bảng nhãn theo nhóm luật

| Nhóm | CHỐT | CHỐT V0.1 | THỬ NGHIỆM | ĐỀ XUẤT | MỞ |
|---|---:|---:|---:|---:|---:|
| `LA-SCOPE` | 5 |  |  |  |  |
| `LA-ACC` | 12 |  | 2 | 2 |  |
| `LA-TRY` | 7 |  |  |  |  |
| `LA-TIME` | 14 |  | 3 | 1 |  |
| `LA-ALLOC` | 7 |  |  | 2 |  |
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
| `LA-CONTENT` | 9 |  | 1 | 2 |  |
| `LA-UX` | 6 |  |  |  |  |
| `LA-PRV` | 3 |  |  | 2 |  |
| `LA-NFR` | 2 |  |  |  |  |
| **Tổng (148 luật)** | **123** | **9** | **7** | **9** | **0** |

## Luật chưa ở trạng thái CHỐT

- **THỬ NGHIỆM** (7): `LA-ACC-008`, `LA-ACC-014`, `LA-TIME-002`, `LA-TIME-006`, `LA-TIME-018`, `LA-FB-002`, `LA-CONTENT-008`
- **ĐỀ XUẤT** (9): `LA-ACC-013`, `LA-ACC-015`, `LA-TIME-017`, `LA-ALLOC-007`, `LA-ALLOC-008`, `LA-CONTENT-011`, `LA-CONTENT-012`, `LA-PRV-003`, `LA-PRV-004`
- **MỞ** (0): —

## Kết quả kiểm tra

- Luật: 148; tiêu chí chấp nhận: 32; điểm còn mở: N1, N2, N3, N4, N5, N6, N7, N8, N9.
- Tài liệu quét: 28 (28 file Markdown dưới docs/sdd và AGENTS.md).
- Lỗi: 0
