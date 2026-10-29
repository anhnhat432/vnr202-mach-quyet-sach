# Bãi Mìn Tri Thức – Mô phỏng cân bằng nền

Ngày: 2026-10-29  
Liên quan: `LA-SCOPE`, `MINE-*`, `MINE-END-004`, thông số P6 trong `docs/sdd/specs/live-arena-game-spec.md` §11, quyết định Q9.  
Công cụ: `tools/simulations/minefield-balance.mjs` (phân tích; không phải mã gameplay). Seed cố định `20261029`, chạy lại cho cùng kết quả:

```bash
node tools/simulations/minefield-balance.mjs
```

## Giả định

- Cơ cấu 20 ô đã chốt: 10 câu (3 Dễ / 4 Trung bình / 3 Khó), 3 bom, 1 x2, 2 khiên, 4 rương +40.
- Người chơi không có thông tin để chọn ô (không có gợi ý), nên thứ tự mở ô là ngẫu nhiên; ô đầu không phải bom.
- Người chơi luôn kịp xử lý 10 câu chính trước khi hết giờ. Chưa mô phỏng áp lực thời gian toàn trận; dữ liệu diễn tập sẽ bổ sung.
- Kết quả trả lời (đúng/sai) được rút trước rồi mới mô phỏng bàn cờ, để tách "kiến thức thể hiện" khỏi "may rủi bàn cờ".
- Mô hình năng lực là giả định minh họa; chưa được hiệu chỉnh bằng dữ liệu thật.

## Kết quả

### 1. Biên độ may rủi khi đúng hết 10 câu chính

| Trường hợp | Trung bình | SD | P5 | P50 | P95 | Min–Max |
|---|---:|---:|---:|---:|---:|---:|
| Gỡ bom đúng 100 % | 2 327 | 99 | 2 160 | 2 360 | 2 460 | 2 000–2 460 |
| Gỡ bom đoán (50 %) | 2 272 | 120 | 2 060 | 2 260 | 2 460 | 1 740–2 460 |

Cùng một kiến thức hoàn hảo, bàn cờ tạo chênh lệch tới 460 điểm (x2 rơi vào câu nào, mở được bao nhiêu rương trước câu chính thứ 10).

### 2. Phân bố điểm theo nhóm năng lực

Xác suất đúng (Dễ / Trung bình / Khó / gỡ bom): Xuất sắc .95/.85/.70/.90; Khá .85/.70/.50/.80; Trung bình .75/.55/.35/.70; Yếu .60/.40/.20/.60.

| Nhóm | Chỉ câu chính: TB (SD) | Có bàn cờ: TB (SD) |
|---|---:|---:|
| Xuất sắc | 1 595 (281) | 1 877 (325) |
| Khá | 1 265 (323) | 1 508 (370) |
| Trung bình | 980 (326) | 1 188 (372) |
| Yếu | 680 (299) | 853 (341) |

### 3. Kém hơn đúng một câu chính, xác suất vượt lên nhờ bàn cờ

Hai người cùng gỡ bom đúng hết; B sai đúng một câu chính mà A làm đúng.

| B sai một câu | B có điểm cao hơn A | Hòa điểm |
|---|---:|---:|
| Dễ (−100) | 18,3 % | 12,3 % |
| Trung bình (−200) | 5,1 % | 5,5 % |
| Khó (−300) | 0,7 % | 0,8 % |

### 4. Người thuộc nhóm yếu hơn đạt điểm cao hơn

| Cặp | Chỉ câu chính | Có bàn cờ | Phần do bàn cờ |
|---|---:|---:|---:|
| Khá > Xuất sắc | 18,7 % | 21,3 % | +2,6 điểm % |
| Trung bình > Khá | 23,4 % | 25,5 % | +2,1 điểm % |
| Yếu > Trung bình | 21,5 % | 23,7 % | +2,2 điểm % |

Phần lớn khả năng "người yếu hơn thắng" đến từ dao động kiến thức trong một lượt 10 câu, không phải từ bàn cờ. Bàn cờ cộng thêm khoảng 2–3 điểm phần trăm.

### 5. Lớp 60 người (2 000 lớp mô phỏng, năng lực phân bố chuẩn)

| Chỉ số | Kết quả | Tiêu chí đề xuất P6 |
|---|---:|---:|
| Tương quan hạng Spearman (điểm câu chính so với điểm cuối) | 0,973 | ≥ 0,95 |
| Trùng lặp Top 10 | 83,4 % | ≥ 80 % |
| Kém hơn một câu Trung bình mà vượt lên (mục 3) | 5,1 % | ≤ 10 % |
| Người dẫn đầu theo câu chính (kể cả đồng điểm) vẫn hạng 1 | 94,8 % | — |
| Lớp có nhiều người cùng điểm câu chính cao nhất | 91,3 % | — |

## Nhận định

1. Theo các tiêu chí đề xuất (chờ duyệt), mức ảnh hưởng của may rủi **trong ngưỡng chấp nhận**. Cơ cấu 20 ô được giữ nguyên như quyết định Q9.
2. **Điểm cần lưu ý:** trong 91 % lớp mô phỏng có nhiều người cùng đạt điểm câu chính cao nhất. Giữa những người này, **hạng 1 do bàn cờ quyết định** (rương, x2), vì tiêu chí phân định hòa (số câu đúng, câu Khó đúng, thời gian) chỉ áp dụng khi tổng điểm bằng nhau. Tỷ lệ này phụ thuộc mạnh vào độ khó thật của ngân hàng câu hỏi và phải đo lại bằng dữ liệu diễn tập.
3. Hạn chế của mô phỏng: chưa có áp lực đồng hồ toàn trận, chưa có dữ liệu năng lực thật, chưa xét chất lượng câu hỏi.

## Phương án cân bằng (chỉ để chủ dự án cân nhắc, **chưa áp dụng**)

| Mã | Phương án | Tác động | Đánh đổi |
|---|---|---|---|
| B0 | Giữ nguyên (hiện hành) | — | Hạng 1 giữa những người đúng hết phụ thuộc may rủi |
| B1 | Lượt chỉ kết thúc khi mở hết 20 ô hoặc hết giờ | Mọi người nhận đủ 4 rương; chỉ còn x2 là may rủi | Đổi luật kết thúc `MINE-END-001`; trận dài hơn |
| B2 | x2 áp dụng cho câu chính khó nhất còn lại thay vì câu tiếp theo | Giá trị x2 ổn định hơn | Đổi luật `MINE-ITEM-001`; khó giải thích hơn |

Theo quyết định Q9, không phương án nào được áp dụng nếu chủ dự án chưa duyệt.
