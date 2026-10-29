# Live Arena Game Specification V1.0

Trạng thái: Chờ duyệt văn bản (Giai đoạn A, 2026-10-29). Các quyết định Q1–Q14 đã được chủ dự án phê duyệt; văn bản này ghi lại các quyết định đó thành luật có mã.  
Rủi ro: High  
Độ sâu: Full (Core)  
Thay thế: một phần `core-platform-spec.md` v1.0 — xem `core-platform-spec.md` §16 (Amendment v1.1) và ADR-004.  
Nguồn quyết định: "VNR202 – Live Arena Game Design Specification V1.0" và phản hồi Q1–Q14 của chủ dự án ngày 2026-10-29.

## 1. Bối cảnh và mục tiêu

Live Arena là đấu trường kiến thức lịch sử cho sinh viên một lớp, gồm hai game ngắn, mỗi game có một lượt chơi và một bảng xếp hạng riêng. Sinh viên tự chọn thời điểm chơi trong khung giờ cuộc thi; không cần mọi người bắt đầu cùng lúc.

Nguyên tắc thiết kế:

1. Người chơi hiểu cách chơi trong khoảng 10 giây.
2. Câu hỏi ngắn, thao tác chủ yếu là một lần nhấn chọn.
3. Có cảm giác hồi hộp, tăng điểm, vượt hạng và tranh Top 1.
4. Hạn chế tra cứu AI bằng thời hạn ngắn và kiểm soát hoàn toàn từ máy chủ.
5. Điểm phản ánh kiến thức là chính; may rủi không được quyết định hoàn toàn kết quả.
6. Chỉ dùng nội dung lịch sử đã được người duyệt và có nguồn.

## 2. Nhãn trạng thái của luật

| Nhãn | Ý nghĩa |
|---|---|
| `[CHỐT]` | Chủ dự án đã quyết định. Không được thay đổi nếu không có phê duyệt mới. |
| `[CHỐT V0.1]` | Thiết kế ban đầu của Game 2 đã được duyệt làm cấu hình khởi điểm; chỉ tinh chỉnh sau kiểm thử và có phê duyệt. |
| `[THỬ NGHIỆM]` | Giá trị cấu hình thử nghiệm, chưa được coi là kết quả kiểm thử. Có tiêu chí đo ở §11. |
| `[ĐỀ XUẤT]` | Đề xuất kỹ thuật để lấp khoảng trống của đặc tả; chờ chủ dự án duyệt trước khi triển khai phần liên quan. |
| `[MỞ]` | Chưa có quyết định; liệt kê ở §12. |

Luật `[ĐỀ XUẤT]` và `[MỞ]` không được triển khai như hành vi Core cho tới khi được duyệt (CONSTITUTION, "Agent rules").

## 3. Phạm vi và thứ tự ưu tiên

- Tài liệu này là nguồn chân lý cho hai game Live Arena, thời gian, phản hồi, bảng xếp hạng và tài khoản thi đua.
- Khi mâu thuẫn với `core-platform-spec.md` v1.0, luật ở đây thắng đối với các rule được liệt kê trong Core §16. Các rule Core không bị liệt kê vẫn giữ nguyên hiệu lực (ví dụ `TRY-*`, `SESSION-*`, `CONTENT-*`, `PRV-*`, `EVT-001..003/005`, `NFR-RT-*`).
- CONSTITUTION không thay đổi. Kiến trúc tuân thủ ADR-001 và ADR-004.

## 4. Thuật ngữ

- **Lượt thi (attempt):** một lần chơi của một MSSV cho một game trong một cuộc thi.
- **Câu chính:** câu hỏi được tính điểm (10 câu ở Game 1, 15 câu ở Game 2).
- **Câu gỡ bom:** câu A/B xuất hiện khi mở ô bom ở Game 1; không cộng điểm, không tính vào 10 câu chính.
- **Sự kiện điểm:** mọi thay đổi điểm đã được server commit: trả lời câu chính, mở rương, phạt bom, thưởng combo.
- **Đồng hồ toàn trận:** thời lượng của lượt thi, bắt đầu khi server commit lượt và không bao giờ tạm dừng.
- **Thời hạn câu:** thời điểm hết hạn của một câu đã hiển thị, do server ghi một lần.
- **Độ trễ cho phép:** khoảng dung sai server cộng thêm sau thời hạn câu để bù độ trễ mạng.
- **Bảng tạm thời / bảng chính thức:** thứ hạng trong khi cuộc thi chưa chốt / sau khi cuộc thi ở trạng thái Finalized.

## 5. Luật nghiệp vụ

### 5.1 Phạm vi sản phẩm

- `LA-SCOPE-001` `[CHỐT]` Game 1 của cuộc thi là **Bãi Mìn Tri Thức** (`minefield`); Game 2 là **Đường Đua Lịch Sử** (`race`). Thay thế Dòng Chảy Lịch Sử và Phòng Quyết Sách trong vai trò game thi đấu.
- `LA-SCOPE-002` `[CHỐT]` Dòng Chảy Lịch Sử hiện có được giữ làm **chế độ luyện tập tự do** công khai, không đăng nhập, không tính điểm, không có bảng xếp hạng, không được gắn nhãn "Game 01".
- `LA-SCOPE-003` `[CHỐT]` Giữ nguyên các trải nghiệm học lịch sử công khai: 15 hồ sơ và Scenario Engine (bao gồm chặng Phòng Quyết Sách trong hồ sơ), Mạch Nguyên Nhân, Ma trận Bằng chứng, Ngàn Cân Treo Sợi Tóc, Khoảnh khắc và Giờ G.
- `LA-SCOPE-004` `[CHỐT]` Giờ G và các chế độ luyện tập là trải nghiệm không tính điểm, tách biệt hoàn toàn với cuộc thi (dữ liệu, kênh realtime, nhãn giao diện).
- `LA-SCOPE-005` `[CHỐT]` Không có bảng xếp hạng tổng hợp điểm hai game.

### 5.2 Tài khoản và đăng nhập

- `LA-ACC-001` `[CHỐT]` Quản trị viên nhập danh sách lớp từ tệp `.xlsx` hoặc `.csv`. MSSV là định danh tài khoản.
- `LA-ACC-002` `[CHỐT]` Trước khi nhập chính thức, hệ thống hiển thị bản xem trước gồm số hàng hợp lệ và lỗi theo từng hàng: MSSV trùng trong tệp, MSSV đã tồn tại, thiếu MSSV, thiếu họ tên, MSSV sai định dạng. Không ghi tài khoản nào trước bước xác nhận.
- `LA-ACC-003` `[CHỐT]` Tất cả tài khoản sinh viên dùng chung mật khẩu mặc định do chủ dự án quyết định là `1`. Giá trị được cấu hình phía server (biến môi trường server-only); không hard-code trong mã nguồn, seed, test fixture hoặc client.
- `LA-ACC-004` `[CHỐT]` V1 **không** bắt buộc đổi mật khẩu ở lần đăng nhập đầu. Đây là ngoại lệ có ghi nhận đối với Core `ACC-003` và Security Spec §3.
- `LA-ACC-005` `[CHỐT]` Nếu Supabase Auth không chấp nhận mật khẩu một ký tự, server chuyển mật khẩu người dùng nhập thành mật khẩu nội bộ: `providerPassword = base64url(HMAC-SHA256(AUTH_PASSWORD_PEPPER, normalizedStudentId + ":" + enteredPassword))`. `AUTH_PASSWORD_PEPPER` là bí mật server-only; không xuất hiện ở client, repository, log hoặc response. Supabase Auth vẫn băm và lưu mật khẩu nội bộ; ứng dụng không lưu mật khẩu dạng rõ.
- `LA-ACC-006` `[CHỐT]` Mật khẩu chung **không bảo đảm danh tính**: người biết MSSV có thể đăng nhập thay và sử dụng lượt của người khác. Mức bảo mật này chỉ được chấp nhận cho thi đua lớp học giá trị thấp; không dùng cho cuộc thi có giá trị cao (điểm học phần, giải thưởng). Giao diện quản trị phải hiển thị lời cảnh báo này khi tạo cuộc thi.
- `LA-ACC-007` `[CHỐT]` Đăng nhập nhận MSSV (chuẩn hóa: bỏ khoảng trắng, chữ in hoa) và mật khẩu. Thông báo lỗi luôn chung chung, không xác nhận MSSV có tồn tại.
- `LA-ACC-008` `[ĐỀ XUẤT]` Giới hạn đăng nhập: 5 lần sai/10 phút theo MSSV-hash; giới hạn theo IP-hash phải đủ cao cho cả lớp dùng chung một địa chỉ NAT Wi-Fi (đề xuất 300 yêu cầu/10 phút/IP).
- `LA-ACC-009` `[ĐỀ XUẤT]` Server ghi sự kiện đăng nhập và chuyển thiết bị (thời gian, MSSV, nhãn thiết bị đã băm) để quản trị viên xử lý tranh chấp mạo danh. Sinh viên không thấy dữ liệu của người khác.
- `LA-ACC-010` `[ĐỀ XUẤT]` Khi nhập lại, MSSV đã tồn tại được báo "đã tồn tại" và không bị sửa; sửa họ tên làm qua thao tác quản trị riêng có audit.
- `LA-ACC-011` `[CHỐT]` Định dạng MSSV mặc định `^[A-Z]{2,4}\d{5,8}$` (cấu hình được). Tệp tối đa 1 MiB và 100 hàng dữ liệu.

### 5.3 Cuộc thi và lượt thi

- `LA-TRY-001` `[CHỐT]` Mỗi MSSV có đúng một lượt cho mỗi game trong mỗi cuộc thi (giữ Core `TRY-001`).
- `LA-TRY-002` `[CHỐT]` Hai game có lượt độc lập; sinh viên tự chọn game và thời điểm bắt đầu trong khung giờ cuộc thi.
- `LA-TRY-003` `[CHỐT]` Mỗi MSSV có tối đa **một lượt đang hoạt động** trên cả hai game. Yêu cầu bắt đầu game còn lại khi lượt kia chưa kết thúc bị từ chối với `409 another_attempt_active` kèm liên kết tiếp tục lượt đang chơi.
- `LA-TRY-004` `[CHỐT]` Đóng tab, F5, đăng nhập lại hoặc đổi thiết bị không tạo lượt mới; hệ thống tiếp tục đúng lượt hiện có nếu còn thời gian.
- `LA-TRY-005` `[CHỐT]` Cuộc thi mới tạo quyền chơi mới cho cả hai game; kết quả cuộc thi cũ được giữ nguyên (giữ `TRY-002..004`).
- `LA-TRY-006` `[CHỐT]` Chuyển thiết bị tuân theo `SESSION-001..005`: phiên mới nhận quyền điều khiển, phiên cũ bị vô hiệu ngay, server từ chối thao tác từ phiên cũ.
- `LA-TRY-007` `[CHỐT]` Hết hạn bắt đầu (`EVT-002`) từ chối tạo lượt mới; lượt đã bắt đầu trước hạn được chơi đủ thời lượng toàn trận.

### 5.4 Thời gian

- `LA-TIME-001` `[CHỐT]` Đồng hồ toàn trận bắt đầu khi server commit lượt thi và **không tạm dừng** vì mất mạng, đóng tab hoặc chuyển thiết bị. Thay thế Core `ATT-003`, `ATT-004`, `AC-DISC-001`, `AC-DISC-002`.
- `LA-TIME-002` `[THỬ NGHIỆM]` Thời lượng toàn trận: Game 1 = 180 000 ms (3:00); Game 2 = 150 000 ms (2:30). Quản trị viên chỉ được đổi trước khi cuộc thi mở (`CFG-001/002`).
- `LA-TIME-003` `[CHỐT]` Mỗi câu khi được hiển thị có một thời hạn duy nhất do server ghi **một lần** (`deadline_at`). F5, chuyển tab, đăng nhập lại hoặc chuyển thiết bị không làm mới thời hạn.
- `LA-TIME-004` `[CHỐT]` Thời hạn câu: Game 1 câu Dễ 6 s, Trung bình 8 s, Khó 10 s, gỡ bom 5 s; Game 2 câu Dễ 5 s, Trung bình 7 s, Khó 9 s.
- `LA-TIME-005` `[CHỐT]` Server chấp nhận câu trả lời khi thời điểm server nhận ≤ `deadline_at + latency_allowance`. Thời gian do trình duyệt gửi không bao giờ được dùng để quyết định.
- `LA-TIME-006` `[THỬ NGHIỆM]` `latency_allowance` là cấu hình theo cuộc thi; thử nghiệm trong khoảng 300–500 ms và chỉ khóa sau khi đo độ trễ thực tế trên Wi-Fi lớp học (§11, P2). Không khóa cứng 1 000 ms.
- `LA-TIME-007` `[CHỐT]` Đồng hồ hiển thị ở client chỉ để hiển thị, tính từ `remainingMs` server trả về lúc nhận phản hồi.
- `LA-TIME-008` `[CHỐT]` Câu hết hạn trong lúc mất mạng được tính là hết giờ: 0 điểm, tiêu hao x2 nếu đang có, đặt lại combo, và với câu gỡ bom thì tính là gỡ thất bại.
- `LA-TIME-009` `[ĐỀ XUẤT]` Thời hạn hiệu lực của một câu là `min(deadline_at, attempt_ends_at)`. Khi đồng hồ toàn trận hết lúc một câu gỡ bom đang mở, câu đó được xử lý như gỡ thất bại (khiên hoặc −100) trước khi lượt kết thúc, để không khuyến khích chờ hết giờ.
- `LA-TIME-010` `[ĐỀ XUẤT]` Mốc bắt đầu tính thời hạn câu là `available_at = thời điểm commit + offset`, với offset là thời gian hiệu ứng lật ô (Game 1, ≤ 600 ms `[THỬ NGHIỆM]`) hoặc thời gian phản hồi câu trước (Game 2, 800–1 000 ms `[THỬ NGHIỆM]`). `deadline_at = available_at + thời hạn câu`. Client không hiển thị câu hỏi và đáp án trước `available_at`. Phương án thay thế: client gọi riêng để lấy câu tiếp theo sau phản hồi (thêm một vòng mạng mỗi câu).
- `LA-TIME-011` `[CHỐT]` Thời điểm kết thúc hợp lệ muộn nhất của một lượt = `start_deadline_at + thời lượng toàn trận + latency_allowance` (sửa Core `EVT-004`, không còn 120 s).
- `LA-TIME-012` `[CHỐT]` Heartbeat chỉ dùng để hiển thị trạng thái kết nối và giám sát; không ảnh hưởng đồng hồ (sửa Core `ATT-006`).

### 5.5 Phân bổ câu hỏi

- `LA-ALLOC-001` `[CHỐT]` Mỗi lượt nhận bộ câu riêng, rút ngẫu nhiên từ ngân hàng Published của đúng game, theo cùng blueprint.
- `LA-ALLOC-002` `[CHỐT]` Blueprint Game 1: 10 câu chính (3 Dễ, 4 Trung bình, 3 Khó) và 3 câu gỡ bom A/B. Blueprint Game 2: 15 câu (5 Dễ, 7 Trung bình, 3 Khó). Thay thế Core `ALLOC-002` (blueprint theo chương).
- `LA-ALLOC-003` `[CHỐT]` Thứ tự đáp án được đảo cho từng lượt khi loại câu cho phép, và được lưu cùng phân bổ.
- `LA-ALLOC-004` `[CHỐT]` Phân bổ câu, bàn cờ và độ khó gắn với ô được tạo một lần khi bắt đầu lượt và không thay đổi sau F5, đăng nhập lại hay chuyển thiết bị.
- `LA-ALLOC-005` `[CHỐT]` Server chỉ gửi một câu khi câu đó được hiển thị; không gửi toàn bộ đề xuống trình duyệt.
- `LA-ALLOC-006` `[CHỐT]` Ngân hàng của hai game tách riêng; một phiên bản câu hỏi không xuất hiện hai lần trong cùng một lượt.
- `LA-ALLOC-007` `[ĐỀ XUẤT]` Khi ngân hàng đủ, phân bổ trải đều câu hỏi qua ba chương; đây là mục tiêu mềm, không chặn mở cuộc thi.

### 5.6 Game 1 – Bãi Mìn Tri Thức

Trải nghiệm: mở ô bí ẩn, trả lời câu hỏi, gỡ bom, nhận vật phẩm và tích điểm.

#### Bàn cờ

- `MINE-BOARD-001` `[CHỐT]` Bàn cờ 4 × 5, đúng 20 ô: 10 câu hỏi, 3 bom, 1 x2, 2 khiên, 4 rương (+40).
- `MINE-BOARD-002` `[CHỐT]` Vị trí ô được server xáo trộn riêng cho từng lượt bằng nguồn ngẫu nhiên an toàn và lưu lại.
- `MINE-BOARD-003` `[CHỐT]` Ô đầu tiên được mở không phải bom. Cơ chế `[ĐỀ XUẤT]`: nếu ô đầu tiên người chơi chọn chứa bom, server đổi nội dung ô đó với một ô không phải bom chưa mở được chọn ngẫu nhiên, trong cùng transaction, và ghi vào nhật ký sự kiện của lượt.
- `MINE-BOARD-004` `[CHỐT]` Độ khó của 10 ô câu hỏi (3 Dễ, 4 Trung bình, 3 Khó) được gán ngẫu nhiên khi tạo bàn cờ, cùng với câu hỏi cụ thể. Độ khó chỉ hiện khi mở ô.
- `MINE-BOARD-005` `[CHỐT]` Nội dung ô chưa mở không bao giờ được gửi xuống client.
- `MINE-BOARD-006` `[CHỐT]` Không có gợi ý kiểu Minesweeper (số bom lân cận) trong V1.
- `MINE-BOARD-007` `[CHỐT]` Mỗi ô chỉ được mở một lần. Yêu cầu mở lại trả về kết quả đã có, không tạo hiệu ứng điểm lần hai.
- `MINE-BOARD-008` `[ĐỀ XUẤT]` Khi đang có câu chính hoặc câu gỡ bom chưa xử lý, server từ chối mở ô khác (`409 interaction_pending`).

#### Câu hỏi chính

- `MINE-Q-001` `[CHỐT]` Điểm và thời hạn:

  | Mức độ | Số câu | Điểm đúng | Thời hạn |
  |---|---:|---:|---:|
  | Dễ | 3 | +100 | 6 s |
  | Trung bình | 4 | +200 | 8 s |
  | Khó | 3 | +300 | 10 s |

- `MINE-Q-002` `[CHỐT]` Trả lời sai hoặc hết giờ: 0 điểm. Mỗi câu chỉ được trả lời một lần.

#### Bom

- `MINE-BOMB-001` `[CHỐT]` Mở ô bom hiển thị câu gỡ bom hai đáp án A/B với thời hạn 5 s.
- `MINE-BOMB-002` `[CHỐT]` Gỡ đúng: không bị trừ điểm và giữ nguyên khiên.
- `MINE-BOMB-003` `[CHỐT]` Gỡ sai hoặc hết giờ: nếu có khiên, tiêu hao một khiên thay vì trừ điểm; nếu không có khiên, trừ 100 điểm.
- `MINE-BOMB-004` `[CHỐT]` Điểm không xuống dưới 0 (`score = max(0, score − 100)`).
- `MINE-BOMB-005` `[CHỐT]` Câu gỡ bom không cộng điểm, không tính vào 10 câu chính và không dùng trong tiêu chí phân định hòa.

#### Vật phẩm

- `MINE-ITEM-001` `[CHỐT]` **x2:** áp dụng cho câu chính tiếp theo; nhân đôi điểm nếu trả lời đúng; sai hoặc hết giờ vẫn tiêu hao. Không áp dụng và không bị tiêu hao bởi câu gỡ bom.
- `MINE-ITEM-002` `[CHỐT]` **Khiên:** giữ tối đa 2; tự động bảo vệ khi gỡ bom thất bại.
- `MINE-ITEM-003` `[CHỐT]` **Rương:** cộng ngay 40 điểm khi mở.
- `MINE-ITEM-004` `[CHỐT]` Vật phẩm chưa dùng khi kết thúc không quy đổi thành điểm.

#### Kết thúc và điểm tối đa

- `MINE-END-001` `[CHỐT]` Lượt kết thúc khi đã xử lý đủ 10 câu chính hoặc hết đồng hồ toàn trận, tùy điều kiện nào đến trước.
- `MINE-END-002` `[CHỐT]` Sau khi kết thúc, không được mở thêm ô.
- `MINE-END-003` `[CHỐT]` Điểm tối đa lý thuyết **2 460** = 2 000 (10 câu chính) + 300 (x2 rơi vào câu Khó) + 160 (4 rương).
- `MINE-END-004` `[CHỐT]` Cơ cấu 20 ô và điểm tối đa không được thay đổi nếu chưa có phê duyệt mới. Ảnh hưởng của thứ tự mở ô được theo dõi bằng mô phỏng và kiểm thử (§11, P6).

### 5.7 Game 2 – Đường Đua Lịch Sử

Trải nghiệm: trả lời nhanh, tích combo, tăng tốc và cạnh tranh thứ hạng.

- `RACE-001` `[CHỐT V0.1]` Một lượt gồm 15 câu; thứ tự độ khó cố định: 5 Dễ, rồi 7 Trung bình, rồi 3 Khó (giai đoạn nước rút). Câu cụ thể khác nhau giữa các lượt nhưng theo cùng blueprint.
- `RACE-002` `[CHỐT V0.1]` Mỗi câu chỉ cần một thao tác chọn. Ba dạng: trắc nghiệm A/B/C, trước–sau, chọn cặp sự kiện đúng. Không có tư liệu dài và không có kéo thả.
- `RACE-003` `[CHỐT]` Điểm và thời hạn:

  | Mức độ | Số câu | Điểm đúng | Thời hạn |
  |---|---:|---:|---:|
  | Dễ | 5 | +100 | 5 s |
  | Trung bình | 7 | +150 | 7 s |
  | Khó | 3 | +200 | 9 s |

- `RACE-004` `[CHỐT V0.1]` Sai hoặc hết giờ: 0 điểm.
- `RACE-005` `[CHỐT V0.1]` Combo: chuỗi câu đúng liên tiếp tăng 1 sau mỗi câu đúng; mỗi khi chuỗi đạt bội số của 3 (3, 6, 9, 12, 15) nhận +30. Sai hoặc hết giờ đặt chuỗi về 0. Tối đa 5 lần thưởng combo mỗi lượt.
- `RACE-006` `[CHỐT V0.1]` Nước rút: 3 câu cuối là câu Khó, mỗi câu đúng +200 theo mức chuẩn, có hiệu ứng chuyển giai đoạn. Không cấp điểm ngẫu nhiên, không có x2 hoặc ưu đãi cho người đang tụt hạng.
- `RACE-007` `[CHỐT V0.1]` Không có vật phẩm hay yếu tố may rủi nào khác.
- `RACE-008` `[CHỐT]` Điểm tối đa **2 300** = 2 150 (15 câu) + 150 (5 lần combo).
- `RACE-009` `[CHỐT V0.1]` Lượt kết thúc khi xử lý đủ 15 câu hoặc hết đồng hồ toàn trận.
- `RACE-010` `[CHỐT V0.1]` Đường đua thể hiện tiến độ 15 câu của chính người chơi. Có thể hiển thị mốc điểm tham chiếu (ví dụ điểm hạng 1 và hạng 10 hiện tại) nhưng không mô phỏng như thể mọi người đang chạy cùng lúc.
- `RACE-011` `[CHỐT V0.1]` Khi người chơi tăng hạng, hiển thị phản hồi ngắn và rõ.

### 5.8 Phản hồi trong trận và xem lại sau trận

- `LA-FB-001` `[CHỐT]` Khi cuộc thi chưa ở trạng thái Finalized, phản hồi sau mỗi tương tác chỉ gồm đúng/sai (hoặc hết giờ), điểm nhận được và hiệu ứng tương ứng. **Không** công bố đáp án đúng hay giải thích. Thay thế Core `LEARN-001`, `LEARN-002`, `LEARN-003`, `LEARN-005`.
- `LA-FB-002` `[THỬ NGHIỆM]` Phản hồi kéo dài khoảng 800–1 000 ms, không chặn thao tác quá thời gian này, không che câu hỏi tiếp theo.
- `LA-FB-003` `[CHỐT]` Mọi response API trong lúc cuộc thi chưa Finalized không chứa đáp án đúng, rubric hoặc giải thích, kể cả với câu đã trả lời.
- `LA-FB-004` `[CHỐT]` Sau khi cuộc thi Finalized, sinh viên sở hữu lượt được xem lại từng câu của mình: đề, lựa chọn đã chọn, đáp án đúng, giải thích và nguồn. Trước đó, yêu cầu xem lại trả `409 review_not_available`.
- `LA-FB-005` `[CHỐT]` Thông tin trên vẫn là riêng tư: không có trang công khai liệt kê đáp án.
- `LA-FB-006` `[CHỐT]` Hiệu ứng ngắn, không chiếm thời gian trả lời; có tùy chọn tắt âm thanh và tôn trọng reduced-motion.

### 5.9 Hai bảng xếp hạng

- `LA-LB-001` `[CHỐT]` Hai bảng độc lập: BXH Bãi Mìn Tri Thức và BXH Đường Đua Lịch Sử. Không có BXH tổng.
- `LA-LB-002` `[CHỐT]` Điểm và thứ hạng tạm thời cập nhật realtime sau mỗi sự kiện điểm hợp lệ đã được server commit (sửa Core `SCORE-004`, `LEARN-004`).
- `LA-LB-003` `[CHỐT]` Chế độ trình chiếu song song hiển thị **Top 10** của từng game; có chế độ phóng lớn Top 10 của một game.
- `LA-LB-004` `[CHỐT]` Có hiệu ứng tăng/giảm hạng, thông báo vượt hạng và số người đã hoàn thành.
- `LA-LB-005` `[CHỐT]` Trên laptop người chơi: hiển thị thứ hạng hiện tại và khoảng cách điểm tới người ngay trên; người ngoài Top 10 thấy khoảng cách tới hạng 10. `[ĐỀ XUẤT]` Người đang hạng 1 thấy khoảng cách dẫn trước hạng 2.
- `LA-LB-006` `[CHỐT]` Phân biệt trạng thái từng người: đang chơi, đã hoàn thành, hết giờ.
- `LA-LB-007` `[CHỐT]` Bảng được gắn nhãn **Tạm thời** cho tới khi cuộc thi Finalized; chỉ sau khi mọi lượt hợp lệ đã kết thúc hoặc quá thời điểm kết thúc hợp lệ muộn nhất và server đã đối soát, bảng được gắn nhãn **Chính thức**. API trả trường `standing: "provisional" | "official"`.
- `LA-LB-008` `[CHỐT]` Phân định hòa:
  - Game 1: điểm → số câu chính đúng → số câu Khó đúng → thời gian hoàn thành.
  - Game 2: điểm → số câu đúng → số câu Khó đúng → thời gian hoàn thành.
  - Nếu vẫn bằng nhau: đồng hạng (xếp hạng kiểu 1, 2, 2, 4). Thứ tự hiển thị giữa những người đồng hạng ổn định nhưng không mang ý nghĩa xếp hạng.
  
  Thay thế Core `SCORE-005`.
- `LA-LB-009` `[ĐỀ XUẤT]` "Thời gian hoàn thành" = thời lượng từ lúc bắt đầu lượt tới lúc lượt kết thúc theo đồng hồ server (không phải giờ đồng hồ trong ngày, vì mọi người bắt đầu khác thời điểm). Lượt hết giờ có thời gian hoàn thành bằng thời lượng toàn trận.
- `LA-LB-010` `[CHỐT]` Chỉ người đã bắt đầu lượt mới xuất hiện trong bảng của game đó.
- `LA-LB-011` `[CHỐT]` Bảng công khai hiển thị họ tên đầy đủ, điểm, trạng thái; không hiển thị MSSV (giữ `PRV-001..004`).
- `LA-LB-012` `[ĐỀ XUẤT]` Khi trùng họ tên, hiển thị hậu tố trung tính "(2)", "(3)" theo thứ tự ổn định; không suy ra từ MSSV.

### 5.10 Hạn chế tra cứu AI và gian lận

- `LA-ANTI-001` `[CHỐT]` Câu hỏi ngắn, rõ, tối đa ba đáp án (câu gỡ bom đúng hai đáp án).
- `LA-ANTI-002` `[CHỐT]` Áp dụng `LA-ALLOC-001..005` và `LA-TIME-003..008`.
- `LA-ANTI-003` `[CHỐT]` Server xác nhận đáp án, điểm, vật phẩm, trạng thái bàn cờ và lượt thi. Client không gửi điểm, độ đúng, thời gian hay trạng thái vật phẩm; nếu có, server bỏ qua.
- `LA-ANTI-004` `[CHỐT]` Server từ chối thao tác gửi trùng (trả kết quả cũ), gửi muộn (hết giờ, 0 điểm) và từ phiên không hợp lệ.
- `LA-ANTI-005` `[CHỐT]` Không tự động kết luận gian lận chỉ vì sinh viên chuyển tab. V1 không ghi nhận sự kiện chuyển tab.
- `LA-ANTI-006` `[CHỐT]` Giới hạn thời gian không ngăn tuyệt đối việc dùng AI hoặc thiết bị khác; hiệu quả phải được đo (§11, P5).
- `LA-ANTI-007` `[CHỐT]` Đáp án, ngân hàng đề và MSSV đầy đủ không xuất hiện trong API công khai, client bundle, sự kiện realtime hay bảng xếp hạng.

### 5.11 An toàn khi gửi trùng và kết nối lại

- `LA-IDEM-001` `[CHỐT]` Các thao tác bắt đầu lượt, mở ô, trả lời và chuyển thiết bị mang `Idempotency-Key`. Gửi lại cùng khóa trả về kết quả đã commit, không thay đổi điểm.
- `LA-IDEM-002` `[CHỐT]` Database bảo vệ bằng ràng buộc duy nhất: một lượt cho mỗi (cuộc thi, game, sinh viên); một lần mở cho mỗi (lượt, ô); một câu trả lời cho mỗi (lượt, câu đã phân bổ); một sự kiện điểm cho mỗi nguồn gây điểm.
- `LA-IDEM-003` `[CHỐT]` Các thao tác đồng thời trên một lượt được tuần tự hóa bằng khóa hàng của lượt trong transaction.
- `LA-IDEM-004` `[CHỐT]` Cộng/trừ điểm, cập nhật vật phẩm, cập nhật bảng xếp hạng và tăng phiên bản bảng diễn ra trong cùng một transaction.

### 5.12 Xử lý sự cố của quản trị viên

- `LA-ADMIN-001` `[CHỐT]` Quản trị viên có thể xử lý sự cố đặc biệt bằng thao tác có ghi audit (người làm, thời điểm, lý do, trước/sau). Hệ thống **không bao giờ tự động** tạo lượt mới.
- `LA-ADMIN-002` `[CHỐT]` Quản trị viên không được sửa trực tiếp điểm, thứ hạng hoặc thời gian của lượt.
- `LA-ADMIN-003` `[ĐỀ XUẤT]` Bộ thao tác sự cố V1: (a) thu hồi phiên chơi / khóa tạm tài khoản; (b) ghi chú sự cố vào lượt; (c) vô hiệu lượt (lượt bị loại khỏi bảng chính thức nhưng được lưu lại).
- `LA-ADMIN-004` `[MỞ]` Có cho phép quản trị viên cấp thủ công một lượt thay thế khi sự cố đã được xác minh (ví dụ server ngừng hoạt động) hay không. Mặc định V1: không.

### 5.13 Ngân hàng câu hỏi

- `LA-CONTENT-001` `[CHỐT]` Mục tiêu 87 câu Published: Game 1 gồm 9 Dễ, 12 Trung bình, 9 Khó và 12 câu gỡ bom; Game 2 gồm 15 Dễ, 21 Trung bình, 9 Khó.
- `LA-CONTENT-002` `[CHỐT]` Mỗi câu có: game, chương, chủ đề, dạng, độ khó, đề, 2–3 đáp án, đáp án đúng, giải thích, nguồn, người duyệt và trạng thái (giữ `CONTENT-001..006`; danh sách dạng câu của Core `CONTENT-003` được thay bằng `single_choice`, `before_after`, `pair_choice`, `defuse_ab`).
- `LA-CONTENT-003` `[CHỐT]` Chỉ câu Published do người duyệt học thuật đánh dấu mới được dùng trong cuộc thi thật. AI có thể soạn nháp nhưng không được đánh dấu Reviewed/Published.
- `LA-CONTENT-004` `[CHỐT]` Chưa có người duyệt học thuật chính thức, nên không câu nào được đánh dấu Published ở thời điểm này.
- `LA-CONTENT-005` `[CHỐT]` Dữ liệu giả lập dùng cho phát triển và kiểm thử nằm trong không gian riêng (`origin = fixture`), có nội dung đánh dấu rõ là giả lập, không bao giờ được seed vào môi trường production và không được dùng trong cuộc thi thật. Kiểm tra sẵn sàng của cuộc thi thật từ chối mọi câu `fixture`.
- `LA-CONTENT-006` `[ĐỀ XUẤT]` Cuộc thi có thuộc tính `kind: official | rehearsal`. Cuộc thi diễn tập được dùng câu `fixture`, bảng xếp hạng gắn nhãn "Diễn tập" và không xuất hiện trong lịch sử kết quả chính thức.
- `LA-CONTENT-007` `[CHỐT]` Cuộc thi chỉ mở được khi mỗi ô blueprint có ít nhất số câu bằng nhu cầu của một lượt (giữ `AC-CONTENT-001`); mức mục tiêu gấp 3 lần là `LA-CONTENT-001`.
- `LA-CONTENT-008` `[ĐỀ XUẤT]` Giới hạn độ dài: đề ≤ 120 ký tự, mỗi đáp án ≤ 60 ký tự `[THỬ NGHIỆM]` (đo khả năng đọc trong 5 s, §11, P8).
- `LA-CONTENT-009` `[MỞ]` Chính sách tái sử dụng câu hỏi đã được công bố đáp án sau một cuộc thi Finalized (`LA-FB-004`). Đề xuất mặc định: theo dõi số lần xuất hiện và cảnh báo trong kiểm tra sẵn sàng.

### 5.14 Giao diện và hiệu ứng

- `LA-UX-001` `[CHỐT]` Laptop người chơi ưu tiên: câu hỏi, đáp án lớn, đồng hồ dễ thấy, điểm, vật phẩm, tiến độ và thứ hạng cá nhân.
- `LA-UX-002` `[CHỐT]` Máy chiếu ưu tiên hai bảng Top 10 song song, chữ lớn, đổi hạng mượt, trạng thái trận và sự kiện nổi bật; đọc rõ ở 1920 × 1080.
- `LA-UX-003` `[CHỐT]` Có tùy chọn tắt âm thanh (mặc định tắt) và giảm chuyển động.
- `LA-UX-004` `[CHỐT]` Responsive; hỗ trợ bàn phím (phím mũi tên và Enter trên bàn cờ, phím 1/2/3 hoặc A/B/C để trả lời), màn hình laptop thông dụng và máy chiếu Full HD.
- `LA-UX-005` `[CHỐT]` Màn giới thiệu luật của mỗi game đọc được trong khoảng 10 giây (tối đa ba ý, có biểu tượng).
- `LA-UX-006` `[CHỐT]` Trạng thái kết nối: đã kết nối, chập chờn (realtime mất nhưng API còn), mất mạng, đang đồng bộ lại, phiên bị thu hồi. Không có trạng thái "grace pause".

## 6. Mô hình trạng thái

### 6.1 Cuộc thi

Giữ nguyên Core §5.1: `Draft -> Scheduled -> Open -> StartClosed -> Settling -> Finalized -> Archived`.

### 6.2 Lượt thi

`NotStarted -> Active -> Completed | TimedOut`

- Không còn `GracePaused` và `DisconnectedRunning` (thay Core §5.2).
- `[ĐỀ XUẤT]` Trạng thái bổ sung `Voided` chỉ do quản trị viên đặt (`LA-ADMIN-003`), có audit; lượt `Voided` không xuất hiện trong bảng chính thức.

### 6.3 Tương tác trong lượt

- Game 1: `Board -> QuestionOpen -> Board` và `Board -> DefuseOpen -> Board`. Mở rương, khiên, x2 trả ngay về `Board`. Khi đang `QuestionOpen` hoặc `DefuseOpen`, không mở được ô khác.
- Game 2: `QuestionOpen(i) -> QuestionOpen(i+1)` cho tới câu 15.
- Mọi trạng thái kết thúc khi đồng hồ toàn trận hết (`LA-TIME-009`).

## 7. Công thức điểm

### 7.1 Game 1

Với mỗi sự kiện theo thứ tự commit:

- Câu chính đúng: `score += base(difficulty) × (x2Armed ? 2 : 1)`; sau đó `x2Armed = false`.
- Câu chính sai hoặc hết giờ: `score += 0`; `x2Armed = false`.
- Rương: `score += 40`.
- x2: `x2Armed = true`.
- Khiên: `shields = min(2, shields + 1)`.
- Gỡ bom thất bại: nếu `shields > 0` thì `shields −= 1`, ngược lại `score = max(0, score − 100)`.

Điểm tối đa: 3×100 + 4×200 + 3×300 = 2 000; cộng 300 khi x2 rơi vào câu Khó; cộng 4×40 = 160; tổng **2 460**.

### 7.2 Game 2

- Câu đúng: `score += base(difficulty)`; `streak += 1`; nếu `streak % 3 == 0` thì `score += 30`.
- Câu sai hoặc hết giờ: `streak = 0`.

Điểm tối đa: 5×100 + 7×150 + 3×200 = 2 150; cộng 5×30 = 150; tổng **2 300**.

## 8. Tiêu chí chấp nhận (EARS)

Bảng dưới ánh xạ 12 yêu cầu kiểm thử bắt buộc của đặc tả gốc (cột "Gốc") và bổ sung.

| Mã | Gốc | Tiêu chí |
|---|---|---|
| `LA-AC-001` | 1 | WHEN cùng một MSSV gửi đồng thời nhiều yêu cầu bắt đầu cùng một game trong một cuộc thi, THE SYSTEM SHALL tạo đúng một lượt và trả lượt đó cho mọi yêu cầu. |
| `LA-AC-002` | 2 | WHEN sinh viên hoàn thành lượt Game 1, THE SYSTEM SHALL cho phép bắt đầu lượt Game 2 riêng và hai lượt không chia sẻ điểm, câu hỏi hay trạng thái. |
| `LA-AC-003` | 2 | IF sinh viên đang có lượt chưa kết thúc ở một game, THEN THE SYSTEM SHALL từ chối bắt đầu game còn lại với `another_attempt_active`. |
| `LA-AC-004` | 3 | WHEN sinh viên F5, mất mạng rồi kết nối lại, hoặc đăng nhập trên thiết bị khác, THE SYSTEM SHALL tiếp tục cùng lượt với cùng câu đang mở và cùng `deadline_at`. |
| `LA-AC-005` | 3 | WHEN sinh viên chuyển thiết bị, THE SYSTEM SHALL từ chối mọi thao tác từ phiên cũ ngay cả khi phiên cũ chưa nhận sự kiện thu hồi. |
| `LA-AC-006` | 4 | WHEN một lượt Game 1 bắt đầu, THE SYSTEM SHALL tạo bàn cờ đúng 20 ô với 10 câu (3/4/3 theo độ khó), 3 bom, 1 x2, 2 khiên, 4 rương. |
| `LA-AC-007` | 5 | WHEN người chơi mở ô đầu tiên ở bất kỳ vị trí nào, THE SYSTEM SHALL không trả về bom. |
| `LA-AC-008` | 6 | WHEN các sự kiện x2, khiên, rương và gỡ bom xảy ra theo mọi thứ tự, THE SYSTEM SHALL tính điểm đúng §7.1, kể cả điểm sàn 0, x2 bị tiêu hao khi sai, khiên tối đa 2, x2 không bị câu gỡ bom tiêu hao. |
| `LA-AC-009` | 7 | IF câu trả lời đến server sau `min(deadline_at, attempt_ends_at) + latency_allowance`, THEN THE SYSTEM SHALL ghi hết giờ, không cộng điểm và áp dụng hệ quả hết giờ. |
| `LA-AC-010` | 8 | WHEN người chơi Game 2 trả lời, THE SYSTEM SHALL tính combo +30 ở mỗi bội số 3 của chuỗi, đặt lại chuỗi khi sai hoặc hết giờ, và dùng 3 câu Khó cuối làm nước rút. |
| `LA-AC-011` | 9 | WHEN một sự kiện điểm được commit ở một game, THE SYSTEM SHALL cập nhật bảng của game đó cho người xem đang kết nối và SHALL NOT thay đổi bảng của game kia. |
| `LA-AC-012` | 9 | WHEN chế độ trình chiếu mở, THE SYSTEM SHALL hiển thị Top 10 của cả hai game song song, kèm số người hoàn thành và trạng thái từng người. |
| `LA-AC-013` | 10 | WHILE cuộc thi chưa Finalized, THE SYSTEM SHALL gắn nhãn bảng là "Tạm thời"; WHEN cuộc thi Finalized, THE SYSTEM SHALL gắn nhãn "Chính thức" và khóa thứ hạng. |
| `LA-AC-014` | 10 | WHILE cuộc thi chưa Finalized, THE SYSTEM SHALL NOT trả đáp án đúng hoặc giải thích trong bất kỳ response hoặc sự kiện nào; WHEN Finalized, THE SYSTEM SHALL cho sinh viên xem lại lượt của chính mình. |
| `LA-AC-015` | 11 | WHEN bảng trình chiếu hiển thị ở 1920 × 1080, THE SYSTEM SHALL hiển thị đủ hai Top 10 không cuộn, chữ đọc được từ cuối phòng học (kiểm tra bằng ảnh chụp và duyệt thủ công). |
| `LA-AC-016` | 12 | WHEN 60 người chơi và 200 người xem hoạt động đồng thời, THE SYSTEM SHALL hiển thị thứ hạng đã commit tới người xem trong 1 s ở p95 (giữ `NFR-RT-001..003`). |
| `LA-AC-017` | — | WHEN cùng một yêu cầu mở ô, trả lời hoặc bắt đầu lượt được gửi lại với cùng `Idempotency-Key` hoặc gửi đồng thời, THE SYSTEM SHALL áp dụng hiệu ứng điểm đúng một lần. |
| `LA-AC-018` | — | WHEN quản trị viên tải tệp `.xlsx` hoặc `.csv`, THE SYSTEM SHALL hiển thị bản xem trước với lỗi theo hàng và SHALL NOT tạo tài khoản trước khi được xác nhận. |
| `LA-AC-019` | — | WHEN sinh viên đăng nhập bằng MSSV và mật khẩu mặc định, THE SYSTEM SHALL cho vào Live Arena mà không yêu cầu đổi mật khẩu. |
| `LA-AC-020` | — | WHEN response công khai, client bundle hoặc sự kiện realtime được kiểm tra tự động, THE SYSTEM SHALL không chứa MSSV, đáp án đúng, giải thích hay ngân hàng đề. |
| `LA-AC-021` | — | IF cuộc thi thật được kiểm tra sẵn sàng mà phân bổ có thể dùng câu `fixture` hoặc câu chưa Published, THEN THE SYSTEM SHALL chặn mở cuộc thi. |

## 9. Trường hợp biên cần kiểm thử

- Hai yêu cầu bắt đầu đồng thời cho cùng game; hai yêu cầu bắt đầu đồng thời cho hai game khác nhau.
- Mở ô đầu tiên chứa bom; mở hai ô đồng thời; mở lại cùng một ô.
- Trả lời đúng lúc `deadline_at`, trong `latency_allowance` và ngay sau đó.
- Đồng hồ toàn trận hết khi câu chính hoặc câu gỡ bom đang mở.
- x2 mở trước câu cuối cùng; x2 mở sau câu chính thứ 10 (bị mất); x2 còn hiệu lực khi gặp bom.
- Bom khi điểm < 100; ba bom liên tiếp không khiên; hai khiên rồi ba lần gỡ thất bại.
- Combo bị ngắt ở câu 3, 6, 15; hết giờ toàn trận giữa chuỗi.
- Chuyển thiết bị khi yêu cầu trả lời đang bay; sự kiện thu hồi đến trễ.
- Sự kiện realtime trùng, sai thứ tự, giả mạo version cao.
- Hai người trùng họ tên; đồng hạng ở mọi tiêu chí.
- Tệp nhập lớp: trùng MSSV trong tệp và với dữ liệu cũ, hàng trống, ô công thức, tệp sai định dạng, tệp vượt giới hạn, nhiều sheet.
- Cuộc thi mở với ngân hàng thiếu một ô blueprint; cuộc thi thật có câu `fixture`.

## 10. Yêu cầu phi chức năng

Giữ `NFR-RT-001..005` (60 người chơi, 200 người xem, 1 s, không phân kỳ khi mất sự kiện, server có thẩm quyền). Bổ sung:

- `LA-NFR-001` `[CHỐT]` Hiệu ứng phản hồi không làm trễ việc hiển thị câu tiếp theo quá `LA-FB-002`.
- `LA-NFR-002` `[CHỐT]` Thời gian server xử lý một thao tác mở ô hoặc trả lời được đo và báo cáo ở p50/p95 trong kiểm thử tải.

## 11. Thông số chờ thử nghiệm và tiêu chí đo

| Mã | Thông số | Giá trị hiện tại | Cách đo | Tiêu chí đề xuất (chờ duyệt) |
|---|---|---|---|---|
| P1 | Thời lượng toàn trận | 3:00 / 2:30 | Diễn tập: tỷ lệ người kịp xử lý hết câu; phân bố thời gian dư | ≥ 90 % người chơi tích cực xử lý hết câu trước khi hết giờ |
| P2 | `latency_allowance` | 300–500 ms | Đo RTT của thao tác mở ô/trả lời trên Wi-Fi lớp học (p50/p95/p99), thời gian xử lý server | Chọn giá trị ≥ p95 RTT trong khoảng 300–500 ms; nếu p95 > 500 ms thì báo lại để quyết định |
| P3 | Thời gian phản hồi | 800–1 000 ms | Đo cảm nhận và tổng thời gian chiếm dụng | Không người chơi nào mất thời gian câu vì phản hồi (đã đảm bảo bởi `LA-TIME-010`) |
| P4 | Offset lật ô Game 1 | ≤ 600 ms | Đo thời gian hiệu ứng thực tế | Hiệu ứng kết thúc trước `available_at` |
| P5 | Hiệu quả chống tra AI | — | Diễn tập có tình nguyện viên được phép dùng AI; so sánh tỷ lệ đúng và thời gian trả lời | Chủ dự án quyết định ngưỡng chấp nhận sau khi có số liệu |
| P6 | Ảnh hưởng may rủi Game 1 | Mô phỏng nền: `docs/sdd/evidence/live-arena/balance-baseline.md` | Mô phỏng Monte Carlo + so sánh với dữ liệu diễn tập | Spearman ≥ 0,95; trùng Top 10 ≥ 80 %; xác suất người kém hơn một câu Trung bình vượt lên ≤ 10 % |
| P7 | Tải | 60 người chơi + 200 người xem | Kịch bản tải | p95 hiển thị thứ hạng ≤ 1 s |
| P8 | Độ dài câu hỏi | 120 / 60 ký tự | Diễn tập: tỷ lệ hết giờ ở câu Dễ | Tỷ lệ hết giờ câu Dễ ≤ 10 % |

## 12. Điểm còn mở

| Mã | Nội dung | Mặc định đề xuất | Chặn task |
|---|---|---|---|
| O1 | `LA-TIME-009`: thời hạn hiệu lực = min với đồng hồ toàn trận; câu gỡ bom dở dang khi hết giờ tính là thất bại | Như đề xuất | T042, T044 |
| O2 | `LA-TIME-010`: `available_at` có offset; gửi câu kèm phản hồi hay gọi riêng | Gửi kèm, client chờ `available_at` | T042, T045, T051, T052 |
| O3 | `LA-LB-009`: định nghĩa thời gian hoàn thành | Thời lượng theo đồng hồ server | T046 |
| O4 | `LA-LB-005`: hiển thị cho người hạng 1 | Khoảng cách dẫn trước hạng 2 | T050 |
| O5 | `LA-LB-012`: hiển thị trùng họ tên | Hậu tố "(2)" | T046, T053 |
| O6 | `LA-ADMIN-003/004`: bộ thao tác sự cố; lượt thay thế thủ công | (a)(b)(c), không có lượt thay thế | T056 |
| O7 | `LA-CONTENT-006`: cuộc thi diễn tập | Có `kind: rehearsal` | T040, T048 |
| O8 | `LA-CONTENT-009`: tái sử dụng câu đã công bố đáp án | Theo dõi và cảnh báo | T055 |
| O9 | `LA-ACC-008/009/010`: rate limit lớp NAT, nhật ký đăng nhập, chính sách nhập lại | Như đề xuất | T031, T032 |
| O10 | `MINE-BOARD-003` cơ chế đổi ô, `MINE-BOARD-008` chặn mở ô khi đang có câu | Như đề xuất | T044 |
| O11 | `LA-CONTENT-008`: giới hạn độ dài câu | 120 / 60 ký tự | T048 |
| O12 | Thư viện đọc `.xlsx` (ADR-004) | Chọn ở Giai đoạn B sau kiểm tra bảo mật | T032 |
| O13 | Xác minh Supabase Auth thực tế từ chối mật khẩu < 6 ký tự | Giả định là có; dùng `LA-ACC-005` | T031 |
| O14 | Phương án cân bằng may rủi nếu P6 không đạt | Giữ nguyên; các phương án ở tài liệu mô phỏng | — |

## 13. Truy vết

Ánh xạ luật → task → kiểm thử nằm trong `docs/sdd/traceability-matrix.md` (mục Live Arena V1.0) và `docs/sdd/TASKS.md`.
