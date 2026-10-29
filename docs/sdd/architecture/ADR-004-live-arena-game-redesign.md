# ADR-004: Thiết kế lại Live Arena V1.0 (Bãi Mìn Tri Thức và Đường Đua Lịch Sử)

Trạng thái: Accepted (2026-10-29) — Q1–Q14, O1–O14 và N1–N9 đã được chủ dự án quyết định; bản sửa 2 hoàn thiện các điểm cuối của Giai đoạn A  
Ngày: 2026-10-29  
Liên quan: `docs/sdd/specs/live-arena-game-spec.md`, `core-platform-spec.md` §16 (Amendment v1.1), ADR-001

## Bối cảnh

Core Platform Spec v1.0 định nghĩa hai game thi đấu: Dòng Chảy Lịch Sử (15 câu, 6 phút, chấm theo độ chính xác và tốc độ) và Phòng Quyết Sách (6 tình huống, 9 phút, bốn chặng có trọng số). Spec v1.0 cũng cho phép tạm dừng đồng hồ tới 120 giây khi mất kết nối, dừng 8 giây để đọc giải thích sau mỗi câu, chuẩn hóa điểm về 1 000 và yêu cầu đổi mật khẩu tạm ở lần đăng nhập đầu.

Đặc tả "Live Arena Game Design Specification V1.0" của chủ dự án thay hai game bằng hai trận ngắn (3:00 và 2:30), câu hỏi 5–10 giây, và mục tiêu hạn chế tra cứu AI. Các luật cũ về tạm dừng 120 giây, phản hồi 8 giây kèm giải thích, và quy trình mật khẩu không tương thích với mục tiêu này. Ở thời điểm quyết định, repository chưa triển khai bất kỳ phần Core nào của Live Arena (chưa có auth, roster, competition, attempt, ngân hàng câu hỏi, bảng xếp hạng thật), nên không có dữ liệu hay mã cần di chuyển.

## Quyết định

### 1. Hai game thi đấu

- Game 1 là Bãi Mìn Tri Thức (`minefield`), Game 2 là Đường Đua Lịch Sử (`race`). Định danh API cũ `timeline | decision_room` được thay bằng `minefield | race`.
- Dòng Chảy Lịch Sử hiện có trở thành chế độ luyện tập tự do; Phòng Quyết Sách tiếp tục tồn tại như chặng của Scenario Engine trong hồ sơ công khai.

### 2. Thời gian tuyệt đối, không tạm dừng

- Đồng hồ toàn trận không tạm dừng (`disconnect_grace_limit_ms` bị loại bỏ). Mỗi câu có `deadline_at` ghi một lần.
- Server chấp nhận câu trả lời khi `server_received_at ≤ effective_deadline + latency_allowance`. `latency_allowance` là cấu hình theo cuộc thi, thử nghiệm 300–500 ms.
- Heartbeat chỉ còn vai trò giám sát và hiển thị trạng thái kết nối.
- **Phát hành nội dung do server kiểm soát:** khi một câu được tạo, server ghi `presented_at`, `available_at = presented_at + offset` và `deadline_at = available_at + thời hạn` trong cùng transaction. Không response nào (mở ô, trả lời, projection, realtime) chứa đề hay lựa chọn trước `available_at`. Client lấy nội dung qua endpoint riêng; server giữ yêu cầu tới `available_at` (long-poll, đề xuất) hoặc trả `425`. Lấy nội dung muộn không kéo dài `deadline_at`. Chi tiết: `live-arena-game-spec.md` §5.4.1.

Lý do: với trận 150–180 giây, tạm dừng 120 giây cho phép ngắt mạng có chủ đích để tra cứu. Thời hạn tuyệt đối đơn giản hơn để kiểm thử và công bằng hơn với người chơi bắt đầu ở các thời điểm khác nhau.

### 3. Không công bố trực tiếp đáp án trong lúc cuộc thi chưa chốt

Phản hồi trong trận chỉ có đúng/sai và điểm. Đáp án, giải thích và nguồn chỉ được trả qua endpoint xem lại khi cuộc thi ở trạng thái Finalized. Lý do: người chơi bắt đầu không đồng thời, nên đáp án công bố sớm có thể bị chia sẻ cho người chơi sau.

Rủi ro còn lại: phản hồi đúng/sai vẫn làm lộ đáp án của câu hai lựa chọn và thu hẹp câu ba lựa chọn. Biện pháp giảm thiểu là phân bổ riêng, đảo đáp án, theo dõi và hạn chế số người thấy mỗi câu, và không tái sử dụng âm thầm câu đã lộ (`LA-FB-007`, `LA-CONTENT-009..012`). Hệ thống không tuyên bố chống chia sẻ đáp án tuyệt đối.

### 4. Điểm thô và phân định hòa theo từng game

Bỏ chuẩn hóa 1 000 và thành phần tốc độ. Mỗi bảng dùng điểm thô (tối đa 2 460 và 2 300) và tiêu chí hòa riêng; cho phép đồng hạng. Thứ hạng được tính khi đọc bằng window function `rank()` trên bộ tiêu chí thay vì lưu cột `rank`, vì quy mô một lớp (≤ 100 dòng mỗi game) và cần đồng hạng nhất quán.

### 5. Mật khẩu mặc định chung và ánh xạ phía server

- Sinh viên đăng nhập bằng MSSV và mật khẩu mặc định chung (`1`), không bắt buộc đổi mật khẩu.
- Supabase Auth (giữ nguyên stack) mặc định từ chối mật khẩu dưới 6 ký tự (cần xác minh ở Giai đoạn B, cả local lẫn project thực tế). Email nội bộ là định danh ngẫu nhiên lưu ổn định phía server, không suy ra từ MSSV (`LA-ACC-015`). Server dùng mật khẩu nội bộ dẫn xuất `base64url(HMAC-SHA256(AUTH_PASSWORD_PEPPER, MSSV + ":" + matKhauNhap))`. Pepper là bí mật server-only.
- Giá trị mật khẩu mặc định đọc từ biến môi trường server-only `ROSTER_DEFAULT_PASSWORD`; không nằm trong mã, seed hoặc fixture.
- Rủi ro được chấp nhận và ghi nhận: mật khẩu chung không chứng minh danh tính.

### 6. Logic có thẩm quyền trong PostgreSQL (giữ ADR-001)

Mọi thao tác ảnh hưởng điểm (`start_or_resume_attempt`, `open_minefield_cell`, `submit_answer`, `transfer_attempt_session`, `reconcile_attempt`, `finalize_competition`) là RPC giao dịch: khóa hàng của lượt, kiểm tra `session_version`, kiểm tra thời hạn bằng `now()`, ghi sổ sự kiện điểm, cập nhật bảng xếp hạng và tăng phiên bản trong một transaction. Sự kiện realtime được phát sau commit bằng `realtime.send` (hoặc server broadcaster), chỉ mang `game` và `version`.

Một mô hình tham chiếu TypeScript thuần (không I/O) được phép tồn tại để mô phỏng cân bằng và làm oracle cho test đối chiếu với SQL; nó không bao giờ chấm điểm thật.

### 7. Nhập lớp từ `.xlsx` và `.csv`

Hỗ trợ cả hai định dạng theo yêu cầu. Đánh giá công việc: phần đọc `.xlsx` cần thêm một thư viện phía server nhưng không làm tăng đáng kể khối lượng (cùng một bước chuẩn hóa hàng, xem trước và áp dụng như CSV). Lựa chọn thư viện được chốt ở Giai đoạn B sau khi kiểm tra bảo trì và `npm audit`; ứng viên: `read-excel-file` (nhẹ, chỉ đọc), `exceljs`. Không dùng gói `xlsx` trên npm (bản 0.18.x không còn được cập nhật trên npm registry). Ràng buộc: chỉ đọc sheet đầu tiên, đọc văn bản hiển thị của ô (không đánh giá công thức), giới hạn 1 MiB và số hàng cấu hình được, chạy phía server. MSSV luôn là chuỗi, giữ số 0 đầu; ô MSSV kiểu số sinh cảnh báo. Mẫu định dạng MSSV và giới hạn số hàng chỉ được chốt sau khi xem tệp danh sách thật (`LA-ACC-011..014`).

### 8. Tách dữ liệu giả lập

Câu hỏi giả lập có `origin = fixture`, nằm ở vị trí riêng, không seed vào production, và bị chặn bởi kiểm tra sẵn sàng của cuộc thi thật. Cuộc thi `rehearsal` dùng được câu giả lập và tách hoàn toàn khỏi kết quả chính thức.

### 9. Theo dõi xuất hiện và câu đã lộ đáp án

Bảng `question_exposures` ghi số lần xuất hiện theo cuộc thi; khi cuộc thi Finalized, mọi câu đã dùng được đánh dấu đã lộ đáp án. Cuộc thi `official` mặc định loại câu đã lộ; muốn dùng lại phải có xác nhận rõ ràng từng câu, có audit. Ngân hàng 87 câu chỉ là mục tiêu phát triển: mỗi câu được khoảng 20 trên 60 người thấy trong một cuộc thi.

### 10. Quyền riêng tư của bảng xếp hạng

Bảng công khai và máy chiếu chỉ dùng tên hiển thị lớp học dạng rút gọn (ví dụ "An N.V."), quản trị viên chỉnh được; khách chưa đăng nhập chỉ nhận Top 10 và số liệu tổng hợp (`LA-PRV-003`, `LA-PRV-004`, quyết định N1/N2). Core `PRV-001`, CONSTITUTION và `AGENTS.md` được sửa tương ứng. Họ tên đầy đủ và MSSV không bao giờ công khai.

### 11. Đồng hồ database và chờ khóa

Mọi mốc quyết định dùng `clock_timestamp()` thay `now()` (thời điểm bắt đầu transaction, có thể cũ). `received_at` được lấy ở câu lệnh đầu của RPC trả lời, trước khi chờ khóa; chờ khóa bị giới hạn bởi `lock_timeout`; đối soát hết giờ cộng thêm giới hạn chờ khóa để không chen trước câu trả lời đúng hạn (`LA-TIME-019..023`).

### 12. Phân bổ cân bằng khi nhiều lượt bắt đầu cùng lúc

Phân bổ trong RPC bắt đầu lượt được tuần tự hóa theo `competition_game` bằng khóa advisory phạm vi transaction, chọn câu có số lần phân bổ ít nhất (phá hòa ngẫu nhiên), tách bộ đếm phân bổ và hiển thị (`LA-ALLOC-008`, `LA-ALLOC-011`, `LA-ALLOC-012`). Đánh đổi: các yêu cầu bắt đầu lượt của cùng một game xếp hàng trong vài mili giây; được đo ở P7.

## Phương án đã cân nhắc

- **Giữ tạm dừng 120 giây nhưng không áp dụng cho câu đang mở:** vẫn cho phép đóng băng đồng hồ toàn trận giữa các câu; phức tạp hơn và không cần thiết với trận ngắn. Bị loại theo Q5.
- **Bỏ Supabase Auth, tự quản lý phiên:** đổi stack đã duyệt, phải viết lại quản lý phiên và refresh token. Bị loại.
- **Logic game trong TypeScript với kết nối Postgres trực tiếp:** đơn giản hóa test bằng Vitest nhưng đổi ranh giới ADR-001 và cần pooler transaction. Bị loại.
- **Lưu cột `rank`:** cần cập nhật toàn bảng sau mỗi sự kiện; không cần thiết ở quy mô một lớp.

## Hệ quả

### Tích cực

- Luật thời gian đơn giản, kiểm thử được bằng thời gian server; giảm khả năng lợi dụng mất kết nối.
- Không công bố trực tiếp đáp án trong khung giờ thi và không phát hành nội dung câu trước giờ được phép đọc.
- Không cần di chuyển dữ liệu vì Core chưa được triển khai.

### Đánh đổi

- Sinh viên mất mạng thật sẽ mất thời gian thi; quản trị viên chỉ có thao tác sự cố có audit, không có lượt tự động.
- Mật khẩu chung cho phép mạo danh; chỉ phù hợp thi đua lớp học.
- Bàn cờ Game 1 đưa vào yếu tố may rủi có chủ đích; được theo dõi bằng mô phỏng (`docs/sdd/evidence/live-arena/balance-baseline.md`).
- Thêm một phụ thuộc đọc `.xlsx`.
- Lấy nội dung câu qua yêu cầu riêng thêm khoảng nửa tới một vòng mạng mỗi câu; được bù bằng `latency_allowance` và đo ở P2.
- Đồng hồ 3:00 của Game 1 có thể bị chạm bởi người chọn ô chậm (`time-budget.md`), nên tốc độ thao tác cũng ảnh hưởng điểm Game 1.
- Phản hồi đúng/sai vẫn cho phép suy ra đáp án câu hai lựa chọn; chỉ giảm thiểu, không loại trừ.

## Kiểm chứng

- Kiểm thử PostgreSQL cục bộ (pgTAP) cho RPC, ràng buộc và thời gian **không thay thế** kiểm thử Supabase Auth, RLS và Realtime thật; cả hai đều bắt buộc trước khi đóng T047 và T057.
- Tiêu chí chấp nhận `LA-AC-001..021`.
