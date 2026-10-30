# Live Arena Game Specification V1.0

Trạng thái: Giai đoạn A được duyệt về cơ bản (2026-10-29). **Bản sửa 2** áp dụng quyết định N1–N9 và năm yêu cầu sửa cuối (đồng hồ database, phân tích thời gian có điều kiện, phân bổ ngân hàng, quyền riêng tư, kiểm tra nhất quán).  
Rủi ro: High  
Độ sâu: Full (Core)  
Thay thế: một phần `core-platform-spec.md` v1.0 — xem `core-platform-spec.md` §16 (Amendment v1.1) và ADR-004.  
Nguồn quyết định: "VNR202 – Live Arena Game Design Specification V1.0", phản hồi Q1–Q14, O1–O14 kèm yêu cầu chỉnh A–F, và N1–N9 kèm năm yêu cầu sửa cuối của chủ dự án ngày 2026-10-29.

## 1. Bối cảnh và mục tiêu

Live Arena là đấu trường kiến thức lịch sử cho sinh viên một lớp, gồm hai game ngắn, mỗi game có một lượt chơi và một bảng xếp hạng riêng. Sinh viên tự chọn thời điểm chơi trong khung giờ cuộc thi; không cần mọi người bắt đầu cùng lúc.

Nguyên tắc thiết kế:

1. Người chơi hiểu cách chơi trong khoảng 10 giây.
2. Câu hỏi ngắn, thao tác chủ yếu là một lần nhấn chọn.
3. Có cảm giác hồi hộp, tăng điểm, vượt hạng và tranh Top 1.
4. **Hạn chế** (không loại trừ) tra cứu AI và chia sẻ đáp án bằng thời hạn ngắn, kiểm soát từ máy chủ, phân bổ riêng và hạn chế lặp câu. Hệ thống không tuyên bố chống tra cứu hoặc chia sẻ đáp án tuyệt đối (§5.10, `LA-FB-007`).
5. Điểm phản ánh kiến thức là chính; may rủi không được quyết định hoàn toàn kết quả.
6. Chỉ dùng nội dung lịch sử đã được người duyệt và có nguồn.

## 2. Nhãn trạng thái của luật

| Nhãn | Ý nghĩa |
|---|---|
| `[CHỐT]` | Chủ dự án đã quyết định. Không được thay đổi nếu không có phê duyệt mới. |
| `[CHỐT V0.1]` | Thiết kế ban đầu của Game 2 đã được duyệt làm cấu hình khởi điểm; chỉ tinh chỉnh sau kiểm thử và có phê duyệt. |
| `[THỬ NGHIỆM]` | Giá trị cấu hình thử nghiệm, chưa được coi là kết quả kiểm thử. Có tiêu chí đo ở §11. |
| `[ĐỀ XUẤT]` | Đề xuất để lấp khoảng trống của đặc tả; chờ chủ dự án duyệt trước khi triển khai phần liên quan. |
| `[MỞ]` | Chưa có quyết định; liệt kê ở §12. |

Luật `[ĐỀ XUẤT]` và `[MỞ]` không được triển khai như hành vi Core cho tới khi được duyệt (CONSTITUTION, "Agent rules"). Bảng tổng hợp nhãn nằm ở §12.3.

## 3. Phạm vi và thứ tự ưu tiên

- Tài liệu này là nguồn chân lý cho hai game Live Arena, thời gian, phản hồi, bảng xếp hạng, quyền riêng tư của bảng xếp hạng và tài khoản thi đua.
- Khi mâu thuẫn với `core-platform-spec.md` v1.0, luật ở đây thắng đối với các rule được liệt kê trong Core §16. Các rule Core không bị liệt kê vẫn giữ nguyên hiệu lực (ví dụ `TRY-*`, `SESSION-*`, `CONTENT-*`, `PRV-*`, `EVT-001..003/005`, `NFR-RT-*`).
- Luật `[ĐỀ XUẤT]` hoặc `[MỞ]` có ảnh hưởng tới rule Core chưa thay thế rule Core cho tới khi được duyệt.
- CONSTITUTION không thay đổi. Kiến trúc tuân thủ ADR-001 và ADR-004.

## 4. Thuật ngữ

- **Lượt thi (attempt):** một lần chơi của một MSSV cho một game trong một cuộc thi.
- **Câu chính:** câu hỏi được tính điểm (10 câu ở Game 1, 15 câu ở Game 2).
- **Câu gỡ bom:** câu A/B xuất hiện khi mở ô bom ở Game 1; không cộng điểm, không tính vào 10 câu chính.
- **Sự kiện điểm:** mọi thay đổi điểm đã được server commit: trả lời câu chính, mở rương, phạt bom, thưởng combo.
- **Đồng hồ toàn trận:** thời lượng của lượt thi, bắt đầu khi server commit lượt và không bao giờ tạm dừng.
- **Nội dung câu:** đề và các lựa chọn đáp án của một câu.
- **Mốc thời gian của câu:** `presented_at`, `available_at`, `content_released_at`, `deadline_at`, `effective_deadline`, định nghĩa ở §5.4.1.
- **Độ trễ cho phép (`latency_allowance`):** dung sai server cộng thêm sau thời hạn hiệu lực để bù độ trễ mạng.
- **Bảng tạm thời / bảng chính thức:** thứ hạng trong khi cuộc thi chưa chốt / sau khi cuộc thi ở trạng thái Finalized.
- **Câu đã lộ đáp án:** câu đã được phân bổ trong một cuộc thi đã Finalized, nên đáp án đã có thể được xem lại (`LA-FB-004`).

## 5. Luật nghiệp vụ

### 5.1 Phạm vi sản phẩm

- `LA-SCOPE-001` `[CHỐT]` Game 1 của cuộc thi là **Bãi Mìn Tri Thức** (`minefield`); Game 2 là **Đường Đua Lịch Sử** (`race`). Thay thế Dòng Chảy Lịch Sử và Phòng Quyết Sách trong vai trò game thi đấu. Không có game thi đấu thứ ba.
- `LA-SCOPE-002` `[CHỐT]` Dòng Chảy Lịch Sử hiện có được giữ làm **chế độ luyện tập tự do** công khai, không đăng nhập, không tính điểm, không có bảng xếp hạng, không được gắn nhãn "Game 01".
- `LA-SCOPE-003` `[CHỐT]` Giữ nguyên các trải nghiệm học lịch sử công khai: 15 hồ sơ và Scenario Engine (bao gồm chặng Phòng Quyết Sách trong hồ sơ), Mạch Nguyên Nhân, Ma trận Bằng chứng, Ngàn Cân Treo Sợi Tóc, Khoảnh khắc và Giờ G.
- `LA-SCOPE-004` `[CHỐT]` Giờ G và các chế độ luyện tập là trải nghiệm không tính điểm, tách biệt hoàn toàn với cuộc thi (dữ liệu, kênh realtime, nhãn giao diện).
- `LA-SCOPE-005` `[CHỐT]` Không có bảng xếp hạng tổng hợp điểm hai game.

### 5.2 Tài khoản, đăng nhập và danh sách lớp

- `LA-ACC-001` `[CHỐT]` Quản trị viên nhập danh sách lớp từ tệp `.xlsx` hoặc `.csv`. MSSV là định danh tài khoản.
- `LA-ACC-002` `[CHỐT]` Trước khi nhập chính thức, hệ thống hiển thị bản xem trước gồm số hàng hợp lệ, lỗi và cảnh báo theo từng hàng: MSSV trùng trong tệp, MSSV đã tồn tại, thiếu MSSV, thiếu họ tên, MSSV không khớp mẫu đã cấu hình (nếu có, `LA-ACC-013`), ô MSSV kiểu số (`LA-ACC-012`). Không ghi tài khoản nào trước bước xác nhận.
- `LA-ACC-003` `[CHỐT]` Tất cả tài khoản sinh viên dùng chung mật khẩu mặc định do chủ dự án quyết định là `1`, chỉ cho cuộc thi lớp học. Giá trị được cấu hình phía server (biến môi trường server-only `ROSTER_DEFAULT_PASSWORD`); không hard-code trong mã nguồn, seed, test fixture hoặc client.
- `LA-ACC-004` `[CHỐT]` V1 **không** bắt buộc đổi mật khẩu ở lần đăng nhập đầu. Đây là ngoại lệ có ghi nhận đối với Core `ACC-003` và Security Spec §3.
- `LA-ACC-005` `[CHỐT]` Nếu Supabase Auth không chấp nhận mật khẩu một ký tự, server chuyển mật khẩu người dùng nhập thành mật khẩu nội bộ: `providerPassword = base64url(HMAC-SHA256(AUTH_PASSWORD_PEPPER, normalizedStudentId + ":" + enteredPassword))`. `AUTH_PASSWORD_PEPPER` là bí mật server-only; không xuất hiện ở client, repository, log hoặc response. Supabase Auth vẫn băm và lưu mật khẩu nội bộ; ứng dụng không lưu mật khẩu dạng rõ.
- `LA-ACC-006` `[CHỐT]` Mật khẩu chung **không bảo đảm danh tính**: người biết MSSV có thể đăng nhập thay và sử dụng lượt của người khác. Mức bảo mật này chỉ được chấp nhận cho thi đua lớp học giá trị thấp; không dùng cho cuộc thi có giá trị cao (điểm học phần, giải thưởng). Giao diện quản trị phải hiển thị lời cảnh báo này khi tạo cuộc thi.
- `LA-ACC-007` `[CHỐT]` Đăng nhập nhận MSSV và mật khẩu; MSSV được chuẩn hóa theo `LA-ACC-011`. Thông báo lỗi luôn chung chung, không xác nhận MSSV có tồn tại.
- `LA-ACC-008` `[THỬ NGHIỆM]` Giới hạn đăng nhập ban đầu: 5 lần sai/10 phút theo MSSV-hash; 300 yêu cầu/10 phút theo IP-hash để cả lớp dùng chung một NAT Wi-Fi không bị chặn. Đo lại khi nhiều sinh viên dùng chung NAT (§11, P10).
- `LA-ACC-009` `[CHỐT]` Server ghi sự kiện đăng nhập và chuyển thiết bị (thời gian, tài khoản, nhãn thiết bị đã băm, IP đã băm) để quản trị viên xử lý tranh chấp mạo danh. Sinh viên không thấy dữ liệu của người khác.
- `LA-ACC-010` `[CHỐT]` Khi nhập lại, MSSV đã tồn tại được báo "đã tồn tại" và không bị sửa; sửa họ tên làm qua thao tác quản trị riêng có audit.
- `LA-ACC-011` `[CHỐT]` MSSV luôn được xử lý là **chuỗi ký tự**: giữ nguyên số 0 đầu, không ép kiểu số, không định dạng số khoa học hoặc dấu phân cách hàng nghìn. Chuẩn hóa chỉ gồm bỏ khoảng trắng đầu/cuối và chuyển chữ cái Latin sang in hoa.
- `LA-ACC-012` `[CHỐT]` Với `.xlsx`, hệ thống đọc văn bản hiển thị của ô MSSV. Ô MSSV có kiểu số được đánh dấu cảnh báo trong bản xem trước (Excel có thể đã làm mất số 0 đầu); quản trị viên phải sửa tệp hoặc xác nhận từng hàng trước khi nhập.
- `LA-ACC-013` `[MỞ]` Mẫu định dạng MSSV chưa được cố định cho tới khi kiểm tra danh sách lớp thật (N6). Ví dụ `^[A-Z]{2,4}\d{5,8}$` không phải luật. Trong lúc mở, hệ thống chỉ áp dụng kiểm tra an toàn tối thiểu của `LA-ACC-018`; mẫu (nếu có) là cấu hình, không hard-code.
- `LA-ACC-014` `[MỞ]` Giới hạn số hàng của tệp nhập lớp chưa được cố định cho tới khi kiểm tra danh sách lớp thật (N6). Trong lúc mở, chỉ giới hạn kích thước tệp (`LA-ACC-017`); nếu cần giới hạn số hàng thì là cấu hình, không hard-code.
- `LA-ACC-015` `[CHỐT]` Email nội bộ cho Supabase Auth dùng **định danh ngẫu nhiên** (UUID v4) sinh một lần khi tạo tài khoản, lưu ổn định trong bảng chỉ server truy cập, cộng `INTERNAL_AUTH_EMAIL_DOMAIN`; không suy ra từ MSSV. Chỉ server quản lý ánh xạ MSSV → email nội bộ; email không bao giờ hiển thị cho người dùng hay trả qua API. Khi MSSV không tồn tại, server vẫn thực hiện cùng khối lượng tính toán để không lộ sự tồn tại qua thời gian phản hồi.
- `LA-ACC-016` `[CHỐT]` Hành vi Supabase Auth với mật khẩu ngắn **phải được xác minh trên một project Supabase thực tế** (không chỉ môi trường local) trước khi chọn có dùng ánh xạ `LA-ACC-005` hay không; kết quả được ghi vào evidence.
- `LA-ACC-017` `[THỬ NGHIỆM]` Kích thước tệp nhập lớp tối đa 1 MiB.
- `LA-ACC-018` `[CHỐT]` Kiểm tra an toàn tối thiểu cho MSSV khi chưa có mẫu: không rỗng sau chuẩn hóa, ≤ 32 ký tự, không chứa ký tự điều khiển hay khoảng trắng ở giữa, không bắt đầu bằng ký tự công thức (`=`, `+`, `-`, `@`).

### 5.3 Cuộc thi và lượt thi

- `LA-TRY-001` `[CHỐT]` Mỗi MSSV có đúng một lượt cho mỗi game trong mỗi cuộc thi (giữ Core `TRY-001`).
- `LA-TRY-002` `[CHỐT]` Hai game có lượt độc lập; sinh viên tự chọn game và thời điểm bắt đầu trong khung giờ cuộc thi.
- `LA-TRY-003` `[CHỐT]` Mỗi MSSV có tối đa **một lượt đang hoạt động** trên cả hai game. Yêu cầu bắt đầu game còn lại khi lượt kia chưa kết thúc bị từ chối với `409 another_attempt_active` kèm liên kết tiếp tục lượt đang chơi.
- `LA-TRY-004` `[CHỐT]` Đóng tab, F5, đăng nhập lại hoặc đổi thiết bị không tạo lượt mới; hệ thống tiếp tục đúng lượt hiện có nếu còn thời gian.
- `LA-TRY-005` `[CHỐT]` Cuộc thi mới tạo quyền chơi mới cho cả hai game; kết quả cuộc thi cũ được giữ nguyên (giữ `TRY-002..004`).
- `LA-TRY-006` `[CHỐT]` Chuyển thiết bị tuân theo `SESSION-001..005`: phiên mới nhận quyền điều khiển, phiên cũ bị vô hiệu ngay, server từ chối thao tác từ phiên cũ.
- `LA-TRY-007` `[CHỐT]` Hết hạn bắt đầu (`EVT-002`) từ chối tạo lượt mới; lượt đã bắt đầu trước hạn được chơi đủ thời lượng toàn trận.

### 5.4 Thời gian và phát hành nội dung câu

- `LA-TIME-001` `[CHỐT]` Đồng hồ toàn trận bắt đầu khi server commit lượt thi và **không tạm dừng** vì mất mạng, đóng tab hoặc chuyển thiết bị. Thay thế Core `ATT-003`, `ATT-004`, `AC-DISC-001`, `AC-DISC-002`.
- `LA-TIME-002` `[THỬ NGHIỆM]` Thời lượng toàn trận: Game 1 = 180 000 ms (3:00); Game 2 = 150 000 ms (2:30). Quản trị viên chỉ được đổi trước khi cuộc thi mở (`CFG-001/002`).
- `LA-TIME-003` `[CHỐT]` Mỗi câu có các mốc thời gian do server ghi **một lần** (§5.4.1). F5, chuyển tab, đăng nhập lại, chuyển thiết bị hoặc gọi lại API không làm mới bất kỳ mốc nào.
- `LA-TIME-004` `[CHỐT]` Thời hạn câu: Game 1 câu Dễ 6 s, Trung bình 8 s, Khó 10 s, gỡ bom 5 s; Game 2 câu Dễ 5 s, Trung bình 7 s, Khó 9 s.
- `LA-TIME-005` `[CHỐT]` Server chấp nhận câu trả lời khi thời điểm server nhận `received_at ≤ effective_deadline + latency_allowance`. Thời gian do trình duyệt gửi không bao giờ được dùng để quyết định.
- `LA-TIME-006` `[THỬ NGHIỆM]` `latency_allowance` là cấu hình theo cuộc thi; thử nghiệm trong khoảng 300–500 ms và chỉ khóa sau khi đo độ trễ thực tế trên Wi-Fi lớp học (§11, P2). Không khóa cứng 1 000 ms.
- `LA-TIME-007` `[CHỐT]` Đồng hồ hiển thị ở client chỉ để hiển thị, tính từ `remainingMs` server trả về lúc nhận phản hồi. Client không quyết định thời điểm bắt đầu hay kết thúc hạn.
- `LA-TIME-008` `[CHỐT]` Câu hết hạn trong lúc mất mạng được tính là hết giờ: 0 điểm, tiêu hao x2 nếu đang có, đặt lại combo, và với câu gỡ bom thì tính là gỡ thất bại.
- `LA-TIME-009` `[CHỐT]` Thời hạn hiệu lực của một câu là `effective_deadline = min(deadline_at, attempt_ends_at)`. Khi đồng hồ toàn trận hết lúc một câu gỡ bom đang mở hoặc đã được tạo, câu đó được xử lý là gỡ thất bại (khiên hoặc −100) trước khi lượt kết thúc.
- `LA-TIME-010` `[CHỐT]` Thời gian hiệu ứng (lật ô, phản hồi câu trước) không tính vào thời gian đọc câu: `available_at = presented_at + offset`, `deadline_at = available_at + thời hạn câu`, cả hai do server tính khi commit thao tác tạo ra câu.
- `LA-TIME-011` `[CHỐT]` Thời điểm kết thúc hợp lệ muộn nhất của một lượt = `start_deadline_at + thời lượng toàn trận + latency_allowance` (sửa Core `EVT-004`, không còn 120 s).
- `LA-TIME-012` `[CHỐT]` Heartbeat chỉ dùng để hiển thị trạng thái kết nối và giám sát; không ảnh hưởng đồng hồ (sửa Core `ATT-006`).
- `LA-TIME-013` `[CHỐT]` **Nội dung câu không được gửi tới client trước `available_at`**, qua bất kỳ kênh nào: response mở ô, response trả lời, projection khi F5, sự kiện realtime hay endpoint khác. Trước `available_at`, client chỉ nhận định danh câu, vai trò, độ khó (Game 1 sau khi mở ô) và `availableInMs`.
- `LA-TIME-014` `[CHỐT]` Client lấy nội dung câu bằng một yêu cầu riêng. Nếu yêu cầu tới trước `available_at`, server không trả nội dung. Cơ chế cụ thể ở `LA-TIME-017`.
- `LA-TIME-015` `[CHỐT]` Thời điểm client lấy nội dung không ảnh hưởng thời hạn: lấy nội dung muộn (do mạng chậm, F5, chuyển thiết bị) không kéo dài `deadline_at`. Server ghi `content_released_at` lần đầu nội dung được trả ra để audit.
- `LA-TIME-016` `[CHỐT]` Nếu `available_at ≥ attempt_ends_at`, nội dung câu không bao giờ được phát hành; câu được xử lý là hết giờ khi lượt kết thúc (câu chính: 0 điểm; câu gỡ bom: gỡ thất bại).
- `LA-TIME-017` `[CHỐT]` Cơ chế lấy nội dung là **long-poll**: client gửi yêu cầu ngay khi biết câu tiếp theo; server giữ yêu cầu tới `available_at` (tối đa bằng offset, ≤ 1 000 ms) rồi trả nội dung. **Dự phòng:** nếu yêu cầu tới sớm hơn offset tối đa, hoặc server không giữ được kết nối, server trả `425 too_early` kèm `availableInMs` và **không** kèm nội dung; client gọi lại. Trong mọi trường hợp, nội dung không bao giờ được phát trước `available_at` (`LA-TIME-013`).
- `LA-TIME-018` `[THỬ NGHIỆM]` Offset: lật ô Game 1 ≤ 600 ms; phản hồi Game 2 800–1 000 ms (bằng `LA-FB-002`); câu đầu tiên của Game 2 ≤ 1 000 ms sau khi bắt đầu lượt.
- `LA-TIME-019` `[CHỐT]` Mọi mốc thời gian dùng để quyết định (đặt mốc câu, `received_at`, kiểm tra hạn, hết giờ, kết thúc lượt) lấy bằng `clock_timestamp()` của PostgreSQL, **không** dùng `now()`/`CURRENT_TIMESTAMP` (vốn là thời điểm bắt đầu transaction và có thể đã cũ). Mỗi thao tác là một transaction ngắn do một RPC tạo ra; không transaction nào được giữ mở giữa hai yêu cầu của client.
- `LA-TIME-020` `[CHỐT]` `received_at` được lấy bằng `clock_timestamp()` ở câu lệnh **đầu tiên** của RPC trả lời, **trước** khi chờ khóa hàng của lượt. Kiểm tra hạn dùng `received_at` này. Thời gian chờ khóa vì vậy không làm một câu trả lời đến đúng hạn bị coi là muộn, và một timestamp cũ (từ transaction bắt đầu sớm) không thể làm câu trả lời đến muộn được chấp nhận.
- `LA-TIME-021` `[CHỐT]` Thời gian chờ khóa bị giới hạn bởi `lock_wait_limit` (`SET LOCAL lock_timeout`). Hết giới hạn: transaction bị hủy, không ghi gì, server trả `503 temporarily_unavailable` có thể thử lại; lần thử lại được chấm theo `received_at` của chính nó.
- `LA-TIME-022` `[CHỐT]` Thao tác đối soát chỉ ghi hết giờ cho một câu chưa có câu trả lời khi `clock_timestamp() > effective_deadline + latency_allowance + lock_wait_limit`. Nhờ vậy, một câu trả lời đã đến đúng hạn nhưng đang chờ khóa không bao giờ bị đối soát "chen trước" và ghi hết giờ. Giao diện vẫn hiển thị câu đã hết giờ ngay khi qua `effective_deadline + latency_allowance` mà không cần ghi.
- `LA-TIME-023` `[THỬ NGHIỆM]` `lock_wait_limit` = 2 000 ms; đo thời gian chờ khóa thực tế ở kiểm thử tải (P7).

#### 5.4.1 Mô hình mốc thời gian của một câu

Mọi mốc dùng đồng hồ của database bằng `clock_timestamp()` tại thời điểm câu lệnh chạy (`LA-TIME-019`), không dùng `now()` của transaction và không dùng thời gian client.

| Mốc | Do ai đặt | Định nghĩa |
|---|---|---|
| `started_at` | Server, khi commit tạo lượt | Bắt đầu đồng hồ toàn trận |
| `attempt_ends_at` | Server, cùng lúc | `started_at + thời lượng toàn trận` |
| `presented_at` | Server, khi commit thao tác tạo ra câu | Game 1: commit mở ô câu hỏi/bom. Game 2: commit câu trả lời trước (hoặc commit tạo lượt với câu đầu) |
| `available_at` | Server, cùng lúc | `presented_at + offset` (`LA-TIME-010`, `LA-TIME-018`) |
| `content_released_at` | Server | Lần đầu nội dung được trả ra; luôn `≥ available_at` (`LA-TIME-013`) |
| `deadline_at` | Server, cùng lúc với `presented_at` | `available_at + thời hạn câu`; không bao giờ cập nhật |
| `effective_deadline` | Tính khi chấm | `min(deadline_at, attempt_ends_at)` (`LA-TIME-009`) |
| `received_at` | Server, câu lệnh đầu tiên của RPC trả lời, trước khi chờ khóa | `clock_timestamp()` (`LA-TIME-020`) |
| Chấp nhận | — | `received_at ≤ effective_deadline + latency_allowance` |
| Hiển thị hết giờ | Projection | `clock_timestamp() > effective_deadline + latency_allowance` (chỉ hiển thị, không ghi) |
| Ghi hết giờ | Server, khi đối soát | `clock_timestamp() > effective_deadline + latency_allowance + lock_wait_limit` mà chưa có câu trả lời hợp lệ (`LA-TIME-022`) |
| Lượt kết thúc | Server | Xử lý đủ câu chính, hoặc `clock_timestamp() > attempt_ends_at + latency_allowance + lock_wait_limit` sau khi xử lý câu dở dang; thời điểm kết thúc ghi nhận cho phân định hòa là `min(thời điểm xử lý câu cuối, attempt_ends_at)` |

Bất biến: `presented_at ≤ available_at ≤ content_released_at`; `available_at < deadline_at`; `deadline_at` và `available_at` không đổi sau khi ghi; mỗi câu có tối đa một câu trả lời được chấp nhận.

Ảnh hưởng của mạng: thời gian người chơi thực sự nhìn thấy câu ≈ thời hạn câu − (độ trễ nhận nội dung) − (độ trễ gửi câu trả lời). `latency_allowance` bù phần gửi câu trả lời; cơ chế long-poll (`LA-TIME-017`) giảm phần nhận nội dung xuống một chiều mạng. Cả hai phần được đo ở P2.

Thứ tự gửi lại: nếu yêu cầu trả lời đầu tiên đã được commit, mọi lần gửi lại cùng `Idempotency-Key` nhận kết quả đã commit. Nếu yêu cầu đầu không tới server hoặc bị hủy vì hết `lock_wait_limit` (không ghi gì), lần gửi lại được chấm theo `received_at` của chính nó.

Chờ khóa và transaction chậm: `received_at` được lấy trước khi chờ khóa (`LA-TIME-020`); thời gian chờ khóa bị giới hạn (`LA-TIME-021`); đối soát hết giờ cộng thêm `lock_wait_limit` (`LA-TIME-022`). Ba luật này cùng bảo đảm: (a) đáp án đến muộn không bao giờ được chấp nhận nhờ timestamp cũ; (b) đáp án đến đúng hạn không bị từ chối chỉ vì phải chờ khóa trong giới hạn.

### 5.5 Phân bổ câu hỏi

- `LA-ALLOC-001` `[CHỐT]` Mỗi lượt nhận bộ câu riêng, rút ngẫu nhiên từ ngân hàng Published của đúng game, theo cùng blueprint.
- `LA-ALLOC-002` `[CHỐT]` Blueprint Game 1: 10 câu chính (3 Dễ, 4 Trung bình, 3 Khó) và 3 câu gỡ bom A/B. Blueprint Game 2: 15 câu (5 Dễ, 7 Trung bình, 3 Khó). Thay thế Core `ALLOC-002` (blueprint theo chương).
- `LA-ALLOC-003` `[CHỐT]` Thứ tự đáp án được đảo cho từng lượt khi loại câu cho phép, và được lưu cùng phân bổ.
- `LA-ALLOC-004` `[CHỐT]` Phân bổ câu, bàn cờ và độ khó gắn với ô được tạo một lần khi bắt đầu lượt và không thay đổi sau F5, đăng nhập lại hay chuyển thiết bị.
- `LA-ALLOC-005` `[CHỐT]` Server chỉ phát hành nội dung một câu theo `LA-TIME-013`; không gửi toàn bộ đề xuống trình duyệt.
- `LA-ALLOC-006` `[CHỐT]` Ngân hàng của hai game tách riêng; một phiên bản câu hỏi không xuất hiện hai lần trong cùng một lượt.
- `LA-ALLOC-007` `[CHỐT]` Khi ngân hàng đủ, phân bổ trải đều câu hỏi qua ba chương; đây là mục tiêu mềm, không chặn mở cuộc thi.
- `LA-ALLOC-008` `[CHỐT]` Trong mỗi ô blueprint (game, vai trò, độ khó), câu được chọn trong nhóm có **số lần đã phân bổ ít nhất** trong cuộc thi hiện tại, phá hòa ngẫu nhiên, ưu tiên chương còn thiếu trong lượt; lũy kế số lần hiển thị từ các cuộc thi trước được dùng làm tiêu chí phụ.
- `LA-ALLOC-010` `[CHỐT]` Mỗi lượt Game 2 có **tối đa 5 câu hai lựa chọn** (dạng `before_after`) trong 15 câu. Câu gỡ bom của Game 1 luôn có đúng hai đáp án (`MINE-BOMB-001`).
- `LA-ALLOC-011` `[CHỐT]` Phân bổ trong RPC bắt đầu lượt được tuần tự hóa theo từng `competition_game` (khóa advisory phạm vi transaction hoặc khóa hàng bộ đếm), để nhiều lượt bắt đầu gần như đồng thời đều thấy bộ đếm mới nhất. Kết quả bắt buộc: trong mỗi ô blueprint, chênh lệch số lần phân bổ giữa hai câu bất kỳ ≤ 1 tại mọi thời điểm của cuộc thi; không câu nào lặp trong một lượt; blueprint và `LA-ALLOC-010` luôn thỏa.
- *Ghi chú triển khai (Giai đoạn C):* chênh lệch ≤ 1 của `LA-ALLOC-011` được bảo đảm và kiểm thử khi ràng buộc 5 câu hai lựa chọn (`LA-ALLOC-010`) không buộc thuật toán chọn khác thứ tự "ít được phân bổ nhất trước". Khi nguồn cung câu ba lựa chọn thiếu và ràng buộc này buộc chọn lệch, hai luật không thể cùng đúng tuyệt đối; thuật toán ưu tiên `LA-ALLOC-010` (kiểm tra sẵn sàng báo `two_option_cap_unsatisfiable` khi không thể thỏa). Cần chủ dự án xác nhận thứ tự ưu tiên này.
- `LA-ALLOC-012` `[CHỐT]` Tách hai bộ đếm cho mỗi phiên bản câu trong mỗi cuộc thi: **số lượt được phân bổ** (tăng khi tạo lượt) và **số lượt thực sự hiển thị** (tăng khi nội dung được phát hành lần đầu, `content_released_at`). Câu Game 1 nằm ở ô chưa mở hoặc câu gỡ bom không gặp thì được phân bổ nhưng không hiển thị. Cân bằng phân bổ dùng số lượt được phân bổ; báo cáo mức lộ đề và câu đã lộ dùng số lượt hiển thị.
- `LA-ALLOC-009` `[CHỐT]` Câu đã lộ đáp án không được phân bổ trong cuộc thi `official`, trừ khi quản trị viên xác nhận rõ ràng theo `LA-CONTENT-009`.

### 5.6 Game 1 – Bãi Mìn Tri Thức

Trải nghiệm: mở ô bí ẩn, trả lời câu hỏi, gỡ bom, nhận vật phẩm và tích điểm.

#### Bàn cờ

- `MINE-BOARD-001` `[CHỐT]` Bàn cờ 4 × 5, đúng 20 ô: 10 câu hỏi, 3 bom, 1 x2, 2 khiên, 4 rương (+40).
- `MINE-BOARD-002` `[CHỐT]` Vị trí ô được server xáo trộn riêng cho từng lượt bằng nguồn ngẫu nhiên an toàn và lưu lại.
- `MINE-BOARD-003` `[CHỐT]` Ô đầu tiên được mở không phải bom. Nếu ô đầu tiên người chơi chọn chứa bom, server đổi nội dung ô đó với một ô không phải bom chưa mở được chọn ngẫu nhiên, trong cùng transaction, và ghi vào nhật ký sự kiện của lượt.
- `MINE-BOARD-004` `[CHỐT]` Độ khó của 10 ô câu hỏi (3 Dễ, 4 Trung bình, 3 Khó) được gán ngẫu nhiên khi tạo bàn cờ, cùng với câu hỏi cụ thể. Độ khó chỉ hiện khi mở ô.
- `MINE-BOARD-005` `[CHỐT]` Nội dung ô chưa mở không bao giờ được gửi xuống client.
- `MINE-BOARD-006` `[CHỐT]` Không có gợi ý kiểu Minesweeper (số bom lân cận) trong V1.
- `MINE-BOARD-007` `[CHỐT]` Mỗi ô chỉ được mở một lần. Yêu cầu mở lại trả về kết quả đã có, không tạo hiệu ứng điểm lần hai.
- `MINE-BOARD-008` `[CHỐT]` Khi đang có câu chính hoặc câu gỡ bom chưa xử lý, server từ chối mở ô khác (`409 interaction_pending`).

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
- `MINE-END-004` `[CHỐT]` Cơ cấu 20 ô, luật điểm và điểm tối đa không được thay đổi nếu chưa có phê duyệt mới. Các phương án cân bằng B1/B2 **không áp dụng** (quyết định O14). Ảnh hưởng của thứ tự mở ô và áp lực thời gian được tiếp tục đo (§11, P6).

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
- `LA-FB-003` `[CHỐT]` Mọi response API và sự kiện realtime khi cuộc thi chưa Finalized không chứa đáp án đúng, rubric hoặc giải thích, kể cả với câu đã trả lời.
- `LA-FB-004` `[CHỐT]` Sau khi cuộc thi Finalized, sinh viên sở hữu lượt được xem lại từng câu của mình: đề, lựa chọn đã chọn, đáp án đúng, giải thích và nguồn. Trước đó, yêu cầu xem lại trả `409 review_not_available`. Mọi câu của cuộc thi đó được đánh dấu đã lộ đáp án (`LA-CONTENT-009`).
- `LA-FB-005` `[CHỐT]` Thông tin xem lại là riêng tư: không có trang công khai liệt kê đáp án.
- `LA-FB-006` `[CHỐT]` Hiệu ứng ngắn, không chiếm thời gian trả lời; có tùy chọn tắt âm thanh và tôn trọng reduced-motion.
- `LA-FB-007` `[CHỐT]` **Rủi ro còn lại được ghi nhận:** phản hồi đúng/sai làm lộ hoàn toàn đáp án của câu hai lựa chọn (câu gỡ bom A/B, dạng trước–sau) và thu hẹp đáp án của câu ba lựa chọn. Người chơi trước có thể chia sẻ nội dung câu và đáp án suy ra cho người chơi sau. Biện pháp giảm thiểu là phân bổ riêng (`LA-ALLOC-001`), đảo thứ tự đáp án (`LA-ALLOC-003`, chữ cái A/B/C không mang nghĩa giữa các lượt), trải đều và hạn chế số người thấy mỗi câu (`LA-ALLOC-008`, `LA-CONTENT-010/011`), không tái sử dụng âm thầm câu đã lộ (`LA-CONTENT-009`). Tài liệu, giao diện và báo cáo **không được** tuyên bố hệ thống chống tra cứu hoặc chia sẻ đáp án tuyệt đối.

### 5.9 Hai bảng xếp hạng

- `LA-LB-001` `[CHỐT]` Hai bảng độc lập: BXH Bãi Mìn Tri Thức và BXH Đường Đua Lịch Sử. Không có BXH tổng.
- `LA-LB-002` `[CHỐT]` Điểm và thứ hạng tạm thời cập nhật realtime sau mỗi sự kiện điểm hợp lệ đã được server commit (sửa Core `SCORE-004`, `LEARN-004`).
- `LA-LB-003` `[CHỐT]` Chế độ trình chiếu song song hiển thị **Top 10** của từng game; có chế độ phóng lớn Top 10 của một game.
- `LA-LB-004` `[CHỐT]` Có hiệu ứng tăng/giảm hạng, thông báo vượt hạng và số người đã hoàn thành.
- `LA-LB-005` `[CHỐT]` Trên laptop người chơi: hiển thị thứ hạng hiện tại và khoảng cách điểm tới người ngay trên; người ngoài Top 10 thấy khoảng cách tới hạng 10. Người hạng 1 thấy khoảng cách dẫn trước hạng 2; nếu chưa có hạng 2 thì hiển thị "Đang dẫn đầu" không kèm khoảng cách; nếu đồng hạng 1 thì hiển thị "Đồng hạng 1".
- `LA-LB-006` `[CHỐT]` Phân biệt trạng thái từng người: đang chơi, đã hoàn thành, hết giờ.
- `LA-LB-007` `[CHỐT]` Bảng được gắn nhãn **Tạm thời** cho tới khi cuộc thi Finalized; chỉ sau khi mọi lượt hợp lệ đã kết thúc hoặc quá thời điểm kết thúc hợp lệ muộn nhất và server đã đối soát, bảng được gắn nhãn **Chính thức**. API trả trường `standing: "provisional" | "official"`. Cuộc thi diễn tập không bao giờ có nhãn Chính thức (`LA-CONTENT-006`).
- `LA-LB-008` `[CHỐT]` Phân định hòa:
  - Game 1: điểm → số câu chính đúng → số câu Khó đúng → thời gian hoàn thành.
  - Game 2: điểm → số câu đúng → số câu Khó đúng → thời gian hoàn thành.
  - Nếu vẫn bằng nhau: đồng hạng (xếp hạng kiểu 1, 2, 2, 4). Thứ tự hiển thị giữa những người đồng hạng ổn định nhưng không mang ý nghĩa xếp hạng.

  Thay thế Core `SCORE-005`.
- `LA-LB-009` `[CHỐT]` "Thời gian hoàn thành" = thời lượng từ `started_at` tới lúc lượt kết thúc theo đồng hồ server. Lượt hết giờ có thời gian hoàn thành bằng thời lượng toàn trận.
- `LA-LB-010` `[CHỐT]` Chỉ người đã bắt đầu lượt mới xuất hiện trong bảng của game đó.
- `LA-LB-011` `[CHỐT]` Bảng xếp hạng tuân theo §5.15 (quyền riêng tư); không bao giờ hiển thị MSSV.
- `LA-LB-012` `[CHỐT]` Khi trùng tên hiển thị, thêm hậu tố trung tính "(2)", "(3)" theo thứ tự ổn định (thứ tự nhập lớp); không suy ra từ MSSV.

### 5.10 Hạn chế tra cứu AI và gian lận

- `LA-ANTI-001` `[CHỐT]` Câu hỏi ngắn, rõ, tối đa ba đáp án (câu gỡ bom đúng hai đáp án).
- `LA-ANTI-002` `[CHỐT]` Áp dụng `LA-ALLOC-001..006`, `LA-ALLOC-009` và `LA-TIME-003..016`.
- `LA-ANTI-003` `[CHỐT]` Server xác nhận đáp án, điểm, vật phẩm, trạng thái bàn cờ và lượt thi. Client không gửi điểm, độ đúng, thời gian hay trạng thái vật phẩm; nếu có, server bỏ qua.
- `LA-ANTI-004` `[CHỐT]` Server từ chối thao tác gửi trùng (trả kết quả cũ), gửi muộn (hết giờ, 0 điểm) và từ phiên không hợp lệ.
- `LA-ANTI-005` `[CHỐT]` Không tự động kết luận gian lận chỉ vì sinh viên chuyển tab. V1 không ghi nhận sự kiện chuyển tab.
- `LA-ANTI-006` `[CHỐT]` Giới hạn thời gian và các biện pháp trên chỉ **hạn chế**, không ngăn tuyệt đối việc dùng AI, thiết bị khác hoặc chia sẻ đáp án (xem `LA-FB-007`); hiệu quả phải được đo (§11, P5).
- `LA-ANTI-007` `[CHỐT]` Đáp án, ngân hàng đề và MSSV không xuất hiện trong API công khai, client bundle, sự kiện realtime hay bảng xếp hạng.

### 5.11 An toàn khi gửi trùng và kết nối lại

- `LA-IDEM-001` `[CHỐT]` Các thao tác bắt đầu lượt, mở ô, trả lời và chuyển thiết bị mang `Idempotency-Key`. Gửi lại cùng khóa trả về kết quả đã commit, không thay đổi điểm.
- `LA-IDEM-002` `[CHỐT]` Database bảo vệ bằng ràng buộc duy nhất: một lượt cho mỗi (cuộc thi, game, sinh viên); một lần mở cho mỗi (lượt, ô); một câu trả lời cho mỗi (lượt, câu đã phân bổ); một sự kiện điểm cho mỗi nguồn gây điểm.
- `LA-IDEM-003` `[CHỐT]` Các thao tác đồng thời trên một lượt được tuần tự hóa bằng khóa hàng của lượt trong transaction.
- `LA-IDEM-004` `[CHỐT]` Cộng/trừ điểm, cập nhật vật phẩm, cập nhật bảng xếp hạng và tăng phiên bản bảng diễn ra trong cùng một transaction.

### 5.12 Xử lý sự cố của quản trị viên

- `LA-ADMIN-001` `[CHỐT]` Quản trị viên có thể xử lý sự cố đặc biệt bằng thao tác có ghi audit (người làm, thời điểm, lý do, trước/sau). Hệ thống **không bao giờ tự động** tạo lượt mới.
- `LA-ADMIN-002` `[CHỐT]` Quản trị viên không được sửa trực tiếp điểm, thứ hạng hoặc thời gian của lượt.
- `LA-ADMIN-003` `[CHỐT]` Bộ thao tác sự cố V1: (a) thu hồi phiên chơi / khóa tạm tài khoản; (b) ghi chú sự cố vào lượt; (c) vô hiệu lượt (lượt bị loại khỏi bảng chính thức nhưng được lưu lại).
- `LA-ADMIN-004` `[CHỐT]` V1 **không** có thao tác cấp lượt thay thế, kể cả khi sự cố đã được xác minh.

### 5.13 Ngân hàng câu hỏi

- `LA-CONTENT-001` `[CHỐT]` Mức 87 câu (Game 1: 9 Dễ, 12 Trung bình, 9 Khó và 12 câu gỡ bom; Game 2: 15 Dễ, 21 Trung bình, 9 Khó) dùng cho **phát triển và kiểm thử**. Con số này **không** bảo đảm chống chia sẻ đáp án cho lớp khoảng 60 người: với 87 câu, mỗi câu được phân bổ cho khoảng 20 người trong cùng một cuộc thi (§5.13.1).
- `LA-CONTENT-002` `[CHỐT]` Mỗi câu có: game, chương, chủ đề, dạng, độ khó, đề, 2–3 đáp án, đáp án đúng, giải thích, nguồn, người duyệt và trạng thái (giữ `CONTENT-001..006`; danh sách dạng câu của Core `CONTENT-003` được thay bằng `single_choice`, `before_after`, `pair_choice`, `defuse_ab`).
- `LA-CONTENT-003` `[CHỐT]` Chỉ câu Published do người duyệt học thuật đánh dấu mới được dùng trong cuộc thi thật. AI có thể soạn nháp nhưng **không được** đánh dấu Reviewed/Published.
- `LA-CONTENT-004` `[CHỐT]` Chưa có người duyệt học thuật chính thức, nên không câu nào được đánh dấu Published ở thời điểm này.
- `LA-CONTENT-005` `[CHỐT]` Dữ liệu giả lập dùng cho phát triển và kiểm thử nằm trong không gian riêng (`origin = fixture`), có nội dung đánh dấu rõ là giả lập, không bao giờ được seed vào môi trường production và không được dùng trong cuộc thi `official`. Kiểm tra sẵn sàng của cuộc thi `official` từ chối mọi câu `fixture`.
- `LA-CONTENT-006` `[CHỐT]` Cuộc thi có thuộc tính `kind: official | rehearsal`. Cuộc thi diễn tập được dùng câu `fixture`, có bảng xếp hạng riêng gắn nhãn "Diễn tập", không bao giờ có nhãn Chính thức, không xuất hiện trong lịch sử kết quả chính thức hay Student Passport, và không đánh dấu câu ngân hàng là đã lộ trừ khi câu đó thực sự được dùng.
- `LA-CONTENT-007` `[CHỐT]` Cuộc thi chỉ mở được khi mỗi ô blueprint có ít nhất số câu bằng nhu cầu của một lượt (giữ `AC-CONTENT-001`).
- `LA-CONTENT-008` `[THỬ NGHIỆM]` Giới hạn độ dài thử nghiệm: đề ≤ 80 ký tự, mỗi đáp án ≤ 40 ký tự. Đo khả năng đọc trong 5–10 s trước khi khóa (§11, P8).
- `LA-CONTENT-009` `[CHỐT]` Khi một cuộc thi Finalized, mọi phiên bản câu đã **hiển thị** cho ít nhất một người trong cuộc thi đó (`LA-ALLOC-012`) được đánh dấu **đã lộ đáp án** (kèm cuộc thi gây lộ); câu chỉ được phân bổ mà không hiển thị không bị coi là đã lộ. Kiểm tra sẵn sàng của cuộc thi `official` liệt kê các câu đã lộ trong ngân hàng khả dụng; mặc định loại chúng khỏi phân bổ. Muốn dùng lại, quản trị viên phải xác nhận rõ ràng cho từng cuộc thi (danh sách câu và lý do), có audit. Không có đường tái sử dụng âm thầm.
- `LA-CONTENT-010` `[CHỐT]` Hệ thống theo dõi, cho mỗi phiên bản câu, số lượt được phân bổ và số lượt hiển thị theo từng cuộc thi và lũy kế (`LA-ALLOC-012`); báo cáo sẵn sàng hiển thị số người dự kiến được phân bổ mỗi câu theo kích thước ngân hàng và sĩ số lớp.
- `LA-CONTENT-011` `[CHỐT]` Mục tiêu ngân hàng cho cuộc thi `official` là **168 câu** Published chưa lộ (≤ 10 người được phân bổ mỗi câu với 60 người, bảng §5.13.1). Mục tiêu này **không** chặn triển khai tài khoản (Giai đoạn B) hay phát triển gameplay; nó chỉ áp dụng ở kiểm tra sẵn sàng của cuộc thi `official` theo `LA-CONTENT-013/014`.
- `LA-CONTENT-012` `[CHỐT]` Ngân hàng Game 2 phải có đủ câu ba lựa chọn trong từng ô độ khó để mọi lượt đều thỏa `LA-ALLOC-010` (tối đa 5 câu hai lựa chọn mỗi lượt) mà vẫn giữ cân bằng phân bổ.
- `LA-CONTENT-013` `[CHỐT]` Tiêu chí sẵn sàng **bắt buộc** của ngân hàng trước khi mở cuộc thi `official` (không đạt thì chặn mở): (1) mọi câu được phân bổ là Published, có người duyệt học thuật, giải thích và nguồn; (2) không có câu `fixture`; (3) mỗi ô blueprint có ít nhất nhu cầu của một lượt; (4) ràng buộc câu hai lựa chọn `LA-ALLOC-010` thỏa được cho mọi lượt; (5) câu đã lộ đáp án chỉ có mặt khi đã được xác nhận (`LA-CONTENT-009`); (6) mọi câu đạt giới hạn độ dài hiện hành (`LA-CONTENT-008`).
- `LA-CONTENT-014` `[ĐỀ XUẤT]` Tiêu chí sẵn sàng **mục tiêu**: số người dự kiến được phân bổ mỗi câu ≤ 10 theo sĩ số lớp (≈ 168 câu với 60 người). Nếu chưa đạt, báo cáo sẵn sàng hiển thị "Chưa đạt mục tiêu ngân hàng" kèm số liệu; mở cuộc thi `official` khi đó cần quản trị viên xác nhận rõ ràng, có audit.

#### 5.13.1 Số người thấy mỗi câu trong một cuộc thi

Với 60 người chơi và phân bổ đều, mỗi câu được **phân bổ** cho khoảng `60 × nhu cầu mỗi lượt / số câu trong ô` người; số người thực sự thấy câu ≤ con số này. Tổng nhu cầu mỗi lượt là 28 câu (10 câu chính và 3 câu gỡ bom ở Game 1, 15 câu ở Game 2), nên tổng ngân hàng ≈ `60 × 28 / số người tối đa mỗi câu`.

| Số người tối đa được phân bổ mỗi câu | Game 1 (Dễ / TB / Khó / gỡ bom) | Game 2 (Dễ / TB / Khó) | Tổng |
|---:|---|---|---:|
| ~20 (mức phát triển và kiểm thử, `LA-CONTENT-001`) | 9 / 12 / 9 / 12 | 15 / 21 / 9 | 87 |
| 10 (mục tiêu cuộc thi `official`, `LA-CONTENT-011`) | 18 / 24 / 18 / 18 | 30 / 42 / 18 | 168 |
| 5 | 36 / 48 / 36 / 36 | 60 / 84 / 36 | 336 |

Câu Game 1 ở ô chưa mở và câu gỡ bom không gặp thì không hiển thị, nên số người thực sự thấy các câu này thấp hơn bảng (`LA-ALLOC-012`). Cuộc thi sau dùng lại câu đã lộ làm tăng rủi ro theo `LA-CONTENT-009`.

### 5.14 Giao diện và hiệu ứng

- `LA-UX-001` `[CHỐT]` Laptop người chơi ưu tiên: câu hỏi, đáp án lớn, đồng hồ dễ thấy, điểm, vật phẩm, tiến độ và thứ hạng cá nhân.
- `LA-UX-002` `[CHỐT]` Máy chiếu ưu tiên hai bảng Top 10 song song, chữ lớn, đổi hạng mượt, trạng thái trận và sự kiện nổi bật; đọc rõ ở 1920 × 1080.
- `LA-UX-003` `[CHỐT]` Có tùy chọn tắt âm thanh (mặc định tắt) và giảm chuyển động.
- `LA-UX-004` `[CHỐT]` Responsive; hỗ trợ bàn phím (phím mũi tên và Enter trên bàn cờ, phím 1/2/3 hoặc A/B/C để trả lời), màn hình laptop thông dụng và máy chiếu Full HD.
- `LA-UX-005` `[CHỐT]` Màn giới thiệu luật của mỗi game đọc được trong khoảng 10 giây (tối đa ba ý, có biểu tượng) và hiển thị **trước** khi bắt đầu lượt, không tính vào đồng hồ toàn trận.
- `LA-UX-006` `[CHỐT]` Trạng thái kết nối: đã kết nối, chập chờn (realtime mất nhưng API còn), mất mạng, đang đồng bộ lại, phiên bị thu hồi. Không có trạng thái "grace pause"; khi mất mạng, giao diện báo rõ đồng hồ vẫn chạy.

### 5.15 Quyền riêng tư của bảng xếp hạng và danh sách lớp

- `LA-PRV-001` `[CHỐT]` MSSV không xuất hiện trong API công khai, màn trình chiếu, sự kiện realtime, client bundle hay URL công khai. Chỉ quản trị viên xem được MSSV và danh sách lớp đầy đủ; sinh viên chỉ xem thông tin của chính mình.
- `LA-PRV-002` `[CHỐT]` Không có endpoint công khai nào liệt kê danh sách lớp. Bảng xếp hạng chỉ chứa người đã bắt đầu lượt của game đó (`LA-LB-010`); số liệu tổng hợp công khai chỉ gồm số người đang chơi và đã hoàn thành.
- `LA-PRV-003` `[CHỐT]` Bảng xếp hạng công khai, màn trình chiếu và mọi response công khai dùng **tên hiển thị lớp học** dạng rút gọn: tên gọi kèm chữ cái đầu của họ và tên đệm có dấu chấm (ví dụ "Nguyễn Văn An" → "An N.V."; tên một từ giữ nguyên). Tên hiển thị được sinh khi nhập lớp; quản trị viên chỉnh được trong bản xem trước và sau đó (có audit), tối đa 40 ký tự. **Họ tên đầy đủ và MSSV không xuất hiện** trong bảng công khai; họ tên đầy đủ chỉ quản trị viên và chính sinh viên thấy. Thay Core `PRV-001`, `AC-PRV-001`, `UX-AC-009`.
- `LA-PRV-004` `[CHỐT]` Khách chưa đăng nhập chỉ nhận Top 10 của mỗi game và số liệu tổng hợp (số người đang chơi, đã hoàn thành). Sinh viên đã đăng nhập nhận thêm thứ hạng cá nhân, hàng của chính mình và khoảng cách điểm (`LA-LB-005`). Danh sách đầy đủ chỉ dành cho quản trị viên.
- `LA-PRV-005` `[CHỐT]` Tên hiển thị được chụp lại khi lượt bắt đầu (`display_name_snapshot`) để bảng lịch sử không đổi khi hồ sơ được sửa. Nếu quản trị viên sửa tên hiển thị trong lúc cuộc thi chưa Finalized, bản chụp của các lượt trong cuộc thi đó được cập nhật trong cùng thao tác có audit.

## 6. Mô hình trạng thái

### 6.1 Cuộc thi

Giữ nguyên Core §5.1: `Draft -> Scheduled -> Open -> StartClosed -> Settling -> Finalized -> Archived`. Thuộc tính `kind` (`official | rehearsal`) cố định từ khi tạo.

### 6.2 Lượt thi

`NotStarted -> Active -> Completed | TimedOut`, và `Active | Completed | TimedOut -> Voided` chỉ do quản trị viên (`LA-ADMIN-003`), có audit.

- Không còn `GracePaused` và `DisconnectedRunning` (thay Core §5.2).
- Lượt `Voided` không xuất hiện trong bảng chính thức nhưng được lưu lại.

### 6.3 Tương tác trong lượt

- Game 1: `Board -> QuestionPending -> QuestionReleased -> Board` và `Board -> DefusePending -> DefuseReleased -> Board`. `*Pending` là khoảng `presented_at … available_at`, khi nội dung chưa được phát hành. Mở rương, khiên, x2 trả ngay về `Board`. Khi đang có câu chưa xử lý, không mở được ô khác.
- Game 2: `QuestionPending(i) -> QuestionReleased(i) -> QuestionPending(i+1)` cho tới câu 15.
- Mọi trạng thái kết thúc khi đồng hồ toàn trận hết (`LA-TIME-009`, `LA-TIME-016`).

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

Cột "Gốc" ánh xạ 12 yêu cầu kiểm thử bắt buộc của đặc tả gốc.

| Mã | Gốc | Tiêu chí |
|---|---|---|
| `LA-AC-001` | 1 | WHEN cùng một MSSV gửi đồng thời nhiều yêu cầu bắt đầu cùng một game trong một cuộc thi, THE SYSTEM SHALL tạo đúng một lượt và trả lượt đó cho mọi yêu cầu. |
| `LA-AC-002` | 2 | WHEN sinh viên hoàn thành lượt Game 1, THE SYSTEM SHALL cho phép bắt đầu lượt Game 2 riêng và hai lượt không chia sẻ điểm, câu hỏi hay trạng thái. |
| `LA-AC-003` | 2 | IF sinh viên đang có lượt chưa kết thúc ở một game, THEN THE SYSTEM SHALL từ chối bắt đầu game còn lại với `another_attempt_active`. |
| `LA-AC-004` | 3 | WHEN sinh viên F5, mất mạng rồi kết nối lại, hoặc đăng nhập trên thiết bị khác, THE SYSTEM SHALL tiếp tục cùng lượt với cùng câu đang mở và cùng `available_at`, `deadline_at`. |
| `LA-AC-005` | 3 | WHEN sinh viên chuyển thiết bị, THE SYSTEM SHALL từ chối mọi thao tác từ phiên cũ ngay cả khi phiên cũ chưa nhận sự kiện thu hồi. |
| `LA-AC-006` | 4 | WHEN một lượt Game 1 bắt đầu, THE SYSTEM SHALL tạo bàn cờ đúng 20 ô với 10 câu (3/4/3 theo độ khó), 3 bom, 1 x2, 2 khiên, 4 rương. |
| `LA-AC-007` | 5 | WHEN người chơi mở ô đầu tiên ở bất kỳ vị trí nào, THE SYSTEM SHALL không trả về bom. |
| `LA-AC-008` | 6 | WHEN các sự kiện x2, khiên, rương và gỡ bom xảy ra theo mọi thứ tự, THE SYSTEM SHALL tính điểm đúng §7.1, kể cả điểm sàn 0, x2 bị tiêu hao khi sai, khiên tối đa 2, x2 không bị câu gỡ bom tiêu hao. |
| `LA-AC-009` | 7 | IF câu trả lời đến server sau `effective_deadline + latency_allowance`, THEN THE SYSTEM SHALL ghi hết giờ, không cộng điểm và áp dụng hệ quả hết giờ. |
| `LA-AC-010` | 8 | WHEN người chơi Game 2 trả lời, THE SYSTEM SHALL tính combo +30 ở mỗi bội số 3 của chuỗi, đặt lại chuỗi khi sai hoặc hết giờ, và dùng 3 câu Khó cuối làm nước rút. |
| `LA-AC-011` | 9 | WHEN một sự kiện điểm được commit ở một game, THE SYSTEM SHALL cập nhật bảng của game đó cho người xem đang kết nối và SHALL NOT thay đổi bảng của game kia. |
| `LA-AC-012` | 9 | WHEN chế độ trình chiếu mở, THE SYSTEM SHALL hiển thị Top 10 của cả hai game song song, kèm số người hoàn thành và trạng thái từng người. |
| `LA-AC-013` | 10 | WHILE cuộc thi chưa Finalized, THE SYSTEM SHALL gắn nhãn bảng là "Tạm thời"; WHEN cuộc thi `official` Finalized, THE SYSTEM SHALL gắn nhãn "Chính thức" và khóa thứ hạng. |
| `LA-AC-014` | 10 | WHILE cuộc thi chưa Finalized, THE SYSTEM SHALL NOT trả đáp án đúng hoặc giải thích trong bất kỳ response hoặc sự kiện nào; WHEN Finalized, THE SYSTEM SHALL cho sinh viên xem lại lượt của chính mình. |
| `LA-AC-015` | 11 | WHEN bảng trình chiếu hiển thị ở 1920 × 1080, THE SYSTEM SHALL hiển thị đủ hai Top 10 không cuộn, chữ đọc được từ cuối phòng học (ảnh chụp và duyệt thủ công). |
| `LA-AC-016` | 12 | WHEN 60 người chơi và 200 người xem hoạt động đồng thời, THE SYSTEM SHALL hiển thị thứ hạng đã commit tới người xem trong 1 s ở p95 (giữ `NFR-RT-001..003`). |
| `LA-AC-017` | — | WHEN cùng một yêu cầu mở ô, trả lời hoặc bắt đầu lượt được gửi lại với cùng `Idempotency-Key` hoặc gửi đồng thời, THE SYSTEM SHALL áp dụng hiệu ứng điểm đúng một lần. |
| `LA-AC-018` | — | WHEN quản trị viên tải tệp `.xlsx` hoặc `.csv`, THE SYSTEM SHALL hiển thị bản xem trước với lỗi và cảnh báo theo hàng và SHALL NOT tạo tài khoản trước khi được xác nhận. |
| `LA-AC-019` | — | WHEN sinh viên đăng nhập bằng MSSV và mật khẩu mặc định, THE SYSTEM SHALL cho vào Live Arena mà không yêu cầu đổi mật khẩu. |
| `LA-AC-020` | — | WHEN response công khai, client bundle hoặc sự kiện realtime được kiểm tra tự động, THE SYSTEM SHALL không chứa MSSV, đáp án đúng, giải thích hay ngân hàng đề. |
| `LA-AC-021` | — | IF cuộc thi `official` được kiểm tra sẵn sàng mà phân bổ có thể dùng câu `fixture` hoặc câu chưa Published, THEN THE SYSTEM SHALL chặn mở cuộc thi. |
| `LA-AC-022` | 3, 7 | IF client yêu cầu nội dung câu trước `available_at`, THEN THE SYSTEM SHALL không trả đề hay lựa chọn (giữ yêu cầu tới `available_at` hoặc trả `425 too_early`); và không response mở ô, trả lời, projection hay sự kiện nào chứa nội dung câu trước `available_at`. |
| `LA-AC-023` | 3, 7 | WHEN client lấy nội dung câu sau `available_at` (muộn do mạng, F5 hoặc chuyển thiết bị), THE SYSTEM SHALL giữ nguyên `deadline_at`. |
| `LA-AC-024` | 7 | WHEN `deadline_at` của câu đang mở vượt quá `attempt_ends_at`, THE SYSTEM SHALL chấp nhận câu trả lời nhận lúc `attempt_ends_at + latency_allowance` và ghi hết giờ với câu trả lời nhận sau mốc đó 1 ms. |
| `LA-AC-025` | 7 | WHEN câu trả lời tới đúng `effective_deadline + latency_allowance`, THE SYSTEM SHALL chấp nhận; WHEN tới sau mốc đó 1 ms, THE SYSTEM SHALL ghi hết giờ; IF yêu cầu đầu đã tới server, THEN lần gửi lại cùng khóa nhận kết quả đã commit. |
| `LA-AC-026` | 7, 12 | WHEN độ trễ mạng được mô phỏng ở 100, 300, 600 và 1 000 ms, THE SYSTEM SHALL chấm theo `received_at` của server, và báo cáo kiểm thử SHALL ghi thời gian nhìn thấy câu thực tế để chọn `latency_allowance` (P2). |
| `LA-AC-027` | 6, 7 | WHEN đồng hồ toàn trận hết khi câu gỡ bom đang mở hoặc chưa được phát hành, THE SYSTEM SHALL áp dụng gỡ thất bại (khiên hoặc −100, sàn 0) trước khi kết thúc lượt. |
| `LA-AC-028` | — | WHEN tệp nhập lớp có MSSV bắt đầu bằng số 0 (CSV hoặc ô văn bản XLSX), THE SYSTEM SHALL giữ nguyên chuỗi; WHEN ô MSSV trong XLSX có kiểu số, THE SYSTEM SHALL cảnh báo trong bản xem trước. |
| `LA-AC-029` | — | IF câu đã lộ đáp án có trong ngân hàng khả dụng của cuộc thi `official`, THEN THE SYSTEM SHALL loại câu đó khỏi phân bổ trừ khi quản trị viên xác nhận rõ ràng, có audit. |
| `LA-AC-030` | — | WHEN cuộc thi `rehearsal` kết thúc, THE SYSTEM SHALL NOT hiển thị kết quả của nó trong bảng chính thức, lịch sử kết quả chính thức hoặc Student Passport. |
| `LA-AC-031` | 9 | WHEN người chơi ở hạng 1, THE SYSTEM SHALL hiển thị khoảng cách dẫn trước hạng 2, hoặc "Đang dẫn đầu" khi chưa có hạng 2, hoặc "Đồng hạng 1" khi bằng điểm theo mọi tiêu chí. |
| `LA-AC-032` | — | WHEN các endpoint công khai được gọi không đăng nhập, THE SYSTEM SHALL chỉ trả Top 10 mỗi game và số liệu tổng hợp, và SHALL NOT trả danh sách lớp, MSSV, họ tên đầy đủ hay người chưa bắt đầu lượt. |
| `LA-AC-033` | 7 | WHEN một transaction bắt đầu trước `effective_deadline` nhưng câu lệnh nhận câu trả lời chạy sau `effective_deadline + latency_allowance`, THE SYSTEM SHALL ghi hết giờ (kiểm tra bằng `clock_timestamp()`, không bằng `now()`). |
| `LA-AC-034` | 7 | WHEN câu trả lời đến trước hạn nhưng phải chờ khóa do một transaction khác giữ tới sau hạn (trong `lock_wait_limit`), THE SYSTEM SHALL chấm theo `received_at` trước khi chờ khóa và SHALL NOT để thao tác đối soát ghi hết giờ trước câu trả lời đó. |
| `LA-AC-035` | 7 | IF thời gian chờ khóa vượt `lock_wait_limit`, THEN THE SYSTEM SHALL hủy transaction không ghi gì, trả `503` có thể thử lại, và chấm lần thử lại theo `received_at` của chính nó. |
| `LA-AC-036` | — | WHEN 60 lượt của cùng một game bắt đầu gần như đồng thời, THE SYSTEM SHALL tạo phân bổ thỏa blueprint, không lặp câu trong lượt, tối đa 5 câu hai lựa chọn mỗi lượt Game 2, và chênh lệch số lần phân bổ giữa hai câu cùng ô ≤ 1. |
| `LA-AC-037` | — | WHEN câu được phân bổ nhưng không hiển thị (ô chưa mở, bom không gặp), THE SYSTEM SHALL tăng bộ đếm phân bổ nhưng SHALL NOT tăng bộ đếm hiển thị hay đánh dấu câu đã lộ đáp án. |
| `LA-AC-038` | — | WHEN quản trị viên nhập lớp hoặc sửa tên hiển thị, THE SYSTEM SHALL sinh tên dạng rút gọn, cho chỉnh sửa có audit, và mọi response công khai chỉ chứa tên hiển thị. |

## 9. Trường hợp biên cần kiểm thử

- Hai yêu cầu bắt đầu đồng thời cho cùng game; hai yêu cầu bắt đầu đồng thời cho hai game khác nhau.
- Mở ô đầu tiên chứa bom; mở hai ô đồng thời; mở lại cùng một ô; mở ô khi đang có câu chưa xử lý.
- Yêu cầu nội dung câu trước `available_at`, đúng `available_at`, sau `deadline_at`; yêu cầu nội dung từ phiên cũ sau khi chuyển thiết bị.
- Trả lời đúng lúc `effective_deadline`, trong `latency_allowance`, đúng biên và ngay sau biên 1 ms.
- `deadline_at` vượt `attempt_ends_at`; `available_at ≥ attempt_ends_at` (câu không được phát hành).
- Đồng hồ toàn trận hết khi câu chính hoặc câu gỡ bom đang mở hoặc đang chờ phát hành.
- Độ trễ mạng mô phỏng 100/300/600/1 000 ms cho cả yêu cầu lấy nội dung và gửi câu trả lời; yêu cầu đầu bị mất và gửi lại sau hạn.
- x2 mở trước câu cuối cùng; x2 mở sau câu chính thứ 10 (bị mất); x2 còn hiệu lực khi gặp bom.
- Bom khi điểm < 100; ba bom liên tiếp không khiên; hai khiên rồi ba lần gỡ thất bại.
- Combo bị ngắt ở câu 3, 6, 15; hết giờ toàn trận giữa chuỗi.
- Chuyển thiết bị khi yêu cầu trả lời đang bay; sự kiện thu hồi đến trễ.
- Sự kiện realtime trùng, sai thứ tự, giả mạo version cao.
- Hai người trùng tên hiển thị; đồng hạng ở mọi tiêu chí; đồng hạng 1; chỉ có một người chơi.
- Transaction bắt đầu trước hạn nhưng câu lệnh trả lời chạy sau hạn; câu trả lời đúng hạn chờ khóa tới sau hạn; chờ khóa vượt `lock_wait_limit`; đối soát chạy đồng thời với câu trả lời đúng hạn.
- 60 lượt bắt đầu gần như đồng thời; ngân hàng chỉ vừa đủ blueprint; ngân hàng thiếu câu ba lựa chọn cho ràng buộc Game 2.
- Tên một từ, tên có nhiều tên đệm, tên trùng sau khi rút gọn, quản trị viên sửa tên trong lúc cuộc thi đang mở.
- Tệp nhập lớp: trùng MSSV trong tệp và với dữ liệu cũ, MSSV có số 0 đầu, ô MSSV kiểu số, hàng trống, ô công thức, tệp sai định dạng, tệp vượt giới hạn, nhiều sheet.
- Cuộc thi mở với ngân hàng thiếu một ô blueprint; cuộc thi `official` có câu `fixture`; cuộc thi `official` có câu đã lộ đáp án chưa được xác nhận.

## 10. Yêu cầu phi chức năng

Giữ `NFR-RT-001..005` (60 người chơi, 200 người xem, 1 s, không phân kỳ khi mất sự kiện, server có thẩm quyền). Bổ sung:

- `LA-NFR-001` `[CHỐT]` Hiệu ứng phản hồi không làm trễ việc hiển thị câu tiếp theo quá `LA-FB-002`.
- `LA-NFR-002` `[CHỐT]` Thời gian server xử lý một thao tác mở ô, lấy nội dung hoặc trả lời được đo và báo cáo ở p50/p95 trong kiểm thử tải.

## 11. Thông số chờ thử nghiệm và tiêu chí đo

| Mã | Thông số | Giá trị hiện tại | Cách đo | Tiêu chí đề xuất (chờ duyệt) |
|---|---|---|---|---|
| P1 | Thời lượng toàn trận | 3:00 / 2:30 `[THỬ NGHIỆM]` | Ngân sách thời gian tất định có điều kiện (`docs/sdd/evidence/live-arena/time-budget.md`) + diễn tập: tỷ lệ người kịp xử lý hết câu | ≥ 90 % người chơi tích cực xử lý hết câu trước khi hết giờ |
| P2 | `latency_allowance` | 300–500 ms | Đo RTT của mở ô, lấy nội dung và trả lời trên Wi-Fi lớp học (p50/p95/p99), thời gian xử lý server, thời gian nhìn thấy câu thực tế | Chọn giá trị ≥ p95 độ trễ gửi câu trả lời trong khoảng 300–500 ms; nếu vượt 500 ms thì báo lại |
| P3 | Thời gian phản hồi | 800–1 000 ms | Đo cảm nhận và tổng thời gian chiếm dụng | Phản hồi không lấy thời gian đọc câu (bảo đảm bởi `LA-TIME-010`) |
| P4 | Offset lật ô Game 1, câu đầu Game 2 | ≤ 600 ms, ≤ 1 000 ms | Đo thời gian hiệu ứng thực tế | Hiệu ứng kết thúc trước `available_at` |
| P5 | Hiệu quả hạn chế tra AI và chia sẻ | — | Diễn tập có tình nguyện viên được phép dùng AI; so sánh tỷ lệ đúng và thời gian trả lời; theo dõi tỷ lệ đúng tăng dần theo thời điểm bắt đầu trong cùng cuộc thi (dấu hiệu chia sẻ) | Chủ dự án quyết định ngưỡng sau khi có số liệu |
| P6 | Ảnh hưởng may rủi Game 1 | Baseline không áp lực thời gian (`balance-baseline.md`) | Mô phỏng có thời gian + dữ liệu diễn tập | Spearman ≥ 0,95; trùng Top 10 ≥ 80 %; xác suất người kém hơn một câu Trung bình vượt lên ≤ 10 % — đo lại khi có áp lực thời gian |
| P7 | Tải | 60 người chơi + 200 người xem | Kịch bản tải; đo thêm thời gian chờ khóa và số lần `503` do `lock_wait_limit` | p95 hiển thị thứ hạng ≤ 1 s; không câu trả lời đúng hạn nào bị từ chối |
| P8 | Độ dài câu hỏi | 80 / 40 ký tự | Diễn tập: tỷ lệ hết giờ và thời gian trả lời theo độ khó | Tỷ lệ hết giờ câu Dễ ≤ 10 % |
| P9 | Số người được phân bổ / thấy mỗi câu | ~20 với 87 câu | Báo cáo sẵn sàng và bộ đếm phân bổ/hiển thị (`LA-CONTENT-010`, `LA-ALLOC-012`) | ≤ 10 người được phân bổ mỗi câu ở cuộc thi `official` (`LA-CONTENT-011`) |
| P10 | Rate limit đăng nhập | `LA-ACC-008` | Thử đăng nhập đồng thời của cả lớp sau một NAT | Không sinh viên hợp lệ nào bị chặn |

## 12. Quyết định, điểm còn mở và bảng nhãn

### 12.1 Quyết định O1–O14 (2026-10-29)

| Mã | Quyết định | Luật |
|---|---|---|
| O1 | Thời hạn hiệu lực = mốc sớm hơn; gỡ bom dở dang khi hết trận = thất bại | `LA-TIME-009`, `LA-TIME-016` |
| O2 | Hiệu ứng không tính vào thời gian đọc; nội dung chỉ phát hành từ `available_at` do server kiểm soát | `LA-TIME-010`, `LA-TIME-013..017`, §5.4.1 |
| O3 | Thời gian phân định hòa = thời lượng lượt theo đồng hồ server | `LA-LB-009` |
| O4 | Hạng 1 thấy khoảng cách dẫn trước hạng 2; trạng thái phù hợp khi chưa có hạng 2 | `LA-LB-005` |
| O5 | Hậu tố tên trùng ổn định, không dùng MSSV | `LA-LB-012` |
| O6 | Bộ thao tác sự cố có audit; không có lượt thay thế trong V1 | `LA-ADMIN-003`, `LA-ADMIN-004` |
| O7 | Có cuộc thi diễn tập, tách biệt hoàn toàn | `LA-CONTENT-006` |
| O8 | Theo dõi xuất hiện; câu đã lộ cần xác nhận rõ ràng | `LA-CONTENT-009`, `LA-CONTENT-010`, `LA-ALLOC-009` |
| O9 | Rate limit ban đầu, đo lại với NAT; nhật ký đăng nhập; chính sách nhập lại | `LA-ACC-008..010` |
| O10 | Đổi ô đầu nếu trúng bom; chặn mở ô khi tương tác trước chưa xong | `MINE-BOARD-003`, `MINE-BOARD-008` |
| O11 | Giới hạn thử nghiệm 80/40 ký tự, đo trong 5–10 s | `LA-CONTENT-008` |
| O12 | Chọn thư viện `.xlsx` ở Giai đoạn B sau đánh giá bảo mật | §12.2 |
| O13 | Bắt buộc xác minh Supabase Auth trên môi trường thực tế | `LA-ACC-016` |
| O14 | Giữ nguyên cơ cấu và luật điểm Game 1; không áp dụng B1/B2 | `MINE-END-004` |

### 12.2 Quyết định N1–N9 (2026-10-29)

| Mã | Quyết định | Luật |
|---|---|---|
| N1 | Tên hiển thị lớp học dạng rút gọn ("An N.V."), quản trị viên chỉnh được; họ tên đầy đủ và MSSV không công khai | `LA-PRV-003`, `LA-PRV-005`, `LA-LB-012` |
| N2 | Khách chỉ xem Top 10 mỗi game và số liệu tổng hợp; sinh viên đăng nhập xem thêm thứ hạng cá nhân | `LA-PRV-004` |
| N3 | 87 câu cho phát triển/kiểm thử; 168 câu là mục tiêu cho thi chính thức, không chặn Giai đoạn B; tiêu chí sẵn sàng riêng | `LA-CONTENT-001`, `LA-CONTENT-011`, `LA-CONTENT-013`, `LA-CONTENT-014` |
| N4 | Game 2 tối đa 5 câu hai lựa chọn mỗi lượt; câu gỡ bom luôn hai đáp án | `LA-ALLOC-010`, `LA-CONTENT-012` |
| N5 | Long-poll, dự phòng `425`, không phát nội dung trước `available_at` | `LA-TIME-017` |
| N6 | Mẫu MSSV và giới hạn số hàng để mở tới khi xem danh sách thật | `LA-ACC-013`, `LA-ACC-014` (`[MỞ]`) |
| N7 | Email nội bộ bằng định danh ngẫu nhiên lưu ổn định, chỉ server quản lý | `LA-ACC-015` |
| N8 | Trải chương, cân độ khó và số lần xuất hiện; đúng khi nhiều lượt bắt đầu đồng thời | `LA-ALLOC-007`, `LA-ALLOC-008`, `LA-ALLOC-011` |
| N9 | Chọn thư viện `.xlsx` ở Giai đoạn B sau đánh giá bảo mật và bảo trì | Ghi nhận ở evidence Giai đoạn B |

Yêu cầu sửa cuối được ghi thành: đồng hồ database `LA-TIME-019..023`, `LA-AC-033..035`; phân tích thời gian có điều kiện (`time-budget.md`); phân bổ và bộ đếm `LA-ALLOC-008`, `LA-ALLOC-011`, `LA-ALLOC-012`, `LA-AC-036`, `LA-AC-037`; quyền riêng tư `LA-PRV-003/004`, `LA-AC-038` và Core `PRV-001` (sửa đổi).

### 12.2.1 Điểm còn mở

| Mã | Nội dung | Chặn task |
|---|---|---|
| N6 | `LA-ACC-013`, `LA-ACC-014`: mẫu MSSV và giới hạn số hàng, chờ danh sách lớp thật | T032 (chỉ phần cấu hình mẫu/giới hạn; phần còn lại không bị chặn) |
| N9 | Thư viện đọc `.xlsx` | T032 |
| `LA-CONTENT-014` | Đường xác nhận khi ngân hàng chưa đạt mục tiêu 168 câu | T040 (Giai đoạn D) |

### 12.3 Bảng nhãn sau bản sửa 1

Bảng do `tools/sdd/check-live-arena-docs.mjs` sinh và kiểm tra; xem kết quả trong `docs/sdd/evidence/live-arena/consistency-check.md`.

## 13. Truy vết

Ánh xạ luật → task → kiểm thử nằm trong `docs/sdd/traceability-matrix.md` (mục Live Arena V1.0) và `docs/sdd/TASKS.md`.
