# Ngân sách thời gian toàn trận (phân tích tất định)

Ngày: 2026-10-29 (bản sửa 2: kết luận viết lại dạng có điều kiện)  
Liên quan: `LA-TIME-*`, §5.4.1, thông số P1, P2, P4 trong `docs/sdd/specs/live-arena-game-spec.md` §11.  
Công cụ: `tools/simulations/time-budget.mjs` (phân tích, không phải gameplay code).

```bash
node tools/simulations/time-budget.mjs
```

## Mục đích và giới hạn

Phân tích này trả lời câu hỏi: với thời hạn câu đã chốt, đồng hồ toàn trận 3:00 / 2:30 có thể bị chạm không khi cộng thêm thao tác chọn ô, hiệu ứng, phản hồi và độ trễ mạng. Phân tích **không** giả định tốc độ đọc hay năng lực; nó chỉ đặt cận trên theo các tham số:

- `d`: thời gian người chơi quyết định và bấm mở một ô (chỉ Game 1).
- `rtt`: thời gian khứ hồi mạng.
- Offset lật ô 0,6 s và phản hồi 0,9 s theo giá trị `[THỬ NGHIỆM]`.
- Long-poll (`LA-TIME-017`): nhận nội dung mất `rtt/2`; nếu gọi lại sau khi tới giờ: mất `rtt`.
- Game 1 xét tình huống xấu nhất: câu chính thứ 10 nằm ở ô cuối nên phải mở đủ 20 ô và gặp đủ 3 bom.

Kết quả này **không** thay thế mô phỏng có mô hình tốc độ đọc và thử nghiệm với người chơi thật (T067).

## Kết quả

Tổng thời hạn câu: Game 1 = 95 s (80 s câu chính + 15 s gỡ bom); Game 2 = 101 s.

### Dùng hết 100 % thời hạn mọi câu (cận trên)

Game 1, giới hạn 180 s (long-poll | gọi lại sau):

| d \ rtt | 0,1 s | 0,3 s | 0,6 s | 1,0 s |
|---|---|---|---|---|
| 1 s | 142 \| 143 | 149 \| 151 | 159 \| 162 | 172 \| 178 |
| 2 s | 162 \| 163 | 169 \| 171 | 179 \| **182** | **192 \| 198** |
| 3 s | **182 \| 183** | **189 \| 191** | **199 \| 202** | **212 \| 218** |
| 4 s | **202 \| 203** | **209 \| 211** | **219 \| 222** | **232 \| 238** |

Game 2, giới hạn 150 s: 116–137 s với `rtt` từ 0,1 tới 1,0 s, phản hồi 0,9 s, không có thời gian chết khác.

### Dùng 60 % thời hạn

Game 1: 104–200 s; chỉ chạm 180 s khi `d ≥ 3 s` và `rtt ≥ 0,6–1,0 s`. Game 2: 76–97 s.

### Ngưỡng chạm 3:00 của Game 1 (dùng hết thời hạn, long-poll)

| rtt | Thời gian chọn mỗi ô vượt quá |
|---:|---:|
| 0,1 s | 2,90 s |
| 0,3 s | 2,57 s |
| 0,6 s | 2,08 s |
| 1,0 s | 1,42 s |

## Nhận định (có điều kiện)

Các nhận định dưới đây **chỉ đúng trong giả định của mô hình**: RTT 0,1–1,0 s ổn định, offset lật ô 0,6 s, phản hồi 0,9 s, thời gian xử lý server không đáng kể, long-poll hoạt động (không rơi vào dự phòng `425` nhiều lần), không mất mạng, không F5, không chuyển thiết bị, không thời gian render chậm ở client. Thời lượng 3:00 / 2:30 vẫn là `[THỬ NGHIỆM]` (`LA-TIME-002`).

1. **Game 2:** trong các giả định trên, kể cả khi dùng hết thời hạn mọi câu, tổng thời gian ước tính 116–137 s, thấp hơn 150 s. Đồng hồ 2:30 vẫn **có thể** bị chạm khi giả định bị phá vỡ: mất mạng hoặc F5 kéo dài, RTT cao hơn hoặc dao động mạnh, nhiều lần rơi vào dự phòng `425`, thời gian xử lý server cao dưới tải, hoặc thời gian render chậm. Không được kết luận 2:30 không bao giờ là ràng buộc; cần đo ở diễn tập (P1, P2, P7).
2. **Game 1:** trong cùng giả định, đồng hồ 3:00 có thể bị chạm khi người chơi mất trên khoảng 1,4–2,9 s mỗi ô (tùy RTT) trong tình huống xấu nhất. Khi đó những ô chưa mở (có thể chứa rương) và câu chưa xử lý bị mất, nên **tốc độ thao tác** có thể trở thành một yếu tố của điểm Game 1, ngoài kiến thức và may rủi.
3. Long-poll tiết kiệm 1–6 s mỗi trận so với gọi lại sau khi tới giờ; ảnh hưởng nhỏ so với `d`.
4. Cần thêm: mô hình tốc độ đọc theo người chơi, phân bố vị trí câu chính thứ 10 thay vì chỉ xét xấu nhất, và dữ liệu thật từ diễn tập (T067).
