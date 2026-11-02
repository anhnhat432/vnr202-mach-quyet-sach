# Figma Make Brief: VNR202 - Mạch Quyết Sách

Trạng thái: Approved  
Nguồn yêu cầu: `product-experience-spec.md` và `core-platform-spec.md`  
Mục tiêu: tạo thiết kế có thể dùng làm nguồn triển khai Next.js, không chỉ là moodboard

## 1. Chỉ dẫn tổng quát cho Figma Make

Thiết kế một website giáo dục lịch sử theo ngôn ngữ trung tâm dữ liệu - điều hành hiện đại. Trải nghiệm phải có tính biên tập, học thuật và điện ảnh nhưng vẫn dễ đọc. Không dùng kiểu bảo tàng số, LMS, landing page SaaS hoặc dashboard card-grid thông thường.

Sử dụng nền ngà kỹ thuật, chữ xanh than, đỏ son trầm cho quyết sách, hổ phách cho tín hiệu thời gian và xanh teal cho bằng chứng. Kết hợp `Saira Condensed` cho tiêu đề với `Be Vietnam Pro` cho nội dung. Tạo nền bằng lưới tọa độ, đường đồng mức và đường tín hiệu mảnh; tránh gradient tím, nền tối toàn trang và các khối bo tròn giống nhau.

## 2. Kích thước khung

- Desktop chính: 1440 x 1024, nội dung tối đa 1280px.
- Mobile chính: 390 x 844.
- Projector leaderboard: 1920 x 1080.
- Admin desktop: 1440 x 1024.

## 3. Pages trong file Figma

1. `00 Cover & Narrative`
2. `01 Foundations`
3. `02 Components`
4. `03 Public Desktop`
5. `04 Public Mobile`
6. `05 Live Arena`
7. `06 Projector`
8. `07 Admin`
9. `08 Prototype & Motion`
10. `09 Handoff Notes`

## 4. Foundations bắt buộc

- Color variables cho Paper, Ink, Command Red, Signal Amber, Evidence Teal, Night Panel và các semantic states.
- Typography styles cho Display, Section, Body, Data, Caption và Source Citation.
- Spacing variables theo thang 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Radius chỉ dùng ba mức: 0, 4 và 12; panel điều hành ưu tiên cắt góc hoặc đường viền kỹ thuật.
- Grid desktop 12 cột; mobile 4 cột; projector safe area riêng.
- Shadow rất hạn chế; phân tầng chủ yếu bằng màu nền, đường viền và mật độ dữ liệu.

## 5. Component set bắt buộc

- Global navigation, mobile command bar và footer nguồn.
- Chapter rail, dossier tile, dossier status và progress marker.
- Briefing panel, constraint chip, actor marker và time marker.
- Evidence card với variants theo loại nguồn, trạng thái mở/chọn/loại và citation link.
- Decision option, priority stack, relation connector và consequence chain.
- Historical compare panel và source drawer.
- Cause node, cause edge label, filters và mobile slice card.
- Matrix cell, source badge và verification status.
- Game status card, timer, progress, connection banner và feedback panel.
- Leaderboard row với rank-up, rank-down, current-player, top-three và final variants.
- Button, input, password state, modal, toast, skeleton, empty, error và retry.

Mọi component tương tác phải có default, hover, focus-visible, active, disabled, loading và error khi phù hợp.

## 6. Màn hình công khai bắt buộc

### Trang chủ

- Hero không dùng ảnh phủ toàn màn hình. Dùng một `decision signal map` động làm trung tâm.
- Tiêu đề chính: `Lịch sử không tự xảy ra. Nó được định hình bởi những quyết sách.`
- Ba cửa vào theo chương hiển thị như ba tuyến dữ liệu, không như ba course cards.
- Trạng thái Live Arena xuất hiện như một module tín hiệu: sắp mở, đang live hoặc đã kết thúc.
- Có lối vào Phòng Phương Pháp, Mạch Nguyên Nhân và Ma trận Bằng chứng.

### Kho Hồ sơ

- Hiển thị đúng 15 hồ sơ, năm hồ sơ mỗi chương.
- Cho phép lọc nhưng vẫn thể hiện được toàn bộ quy mô ngay từ lần đầu nhìn.
- Mỗi tile có số hồ sơ, giai đoạn, câu hỏi trung tâm, mức thời gian khám phá và các liên kết nhân - quả chính.

### Hồ sơ Quyết sách mẫu

Thiết kế trọn luồng cho hồ sơ `Giữ chính quyền giữa vòng vây` với sáu chặng. Dùng nội dung mẫu có nghĩa về nạn đói, nạn dốt, tài chính, ngoại giao và bảo vệ chính quyền; không dùng lorem ipsum.

### Mạch Nguyên Nhân

- Desktop hiển thị sáu làn dữ liệu và đường liên kết có nhãn.
- Mobile hiển thị lát cắt dạng thẻ theo một quyết sách được chọn.
- Tạo trạng thái chọn một nút và trạng thái giải thích đường nối giữa hai nút.

### Ma trận Bằng chứng

- Tạo chế độ overview và source detail drawer.
- Thể hiện rõ một luận điểm được nhiều nguồn hỗ trợ ở các phạm vi khác nhau.

## 7. Live Arena bắt buộc

### Arena Lobby

- Hai game có hai thẻ trạng thái riêng và hai leaderboard entry riêng.
- Tạo variants: chưa mở, có thể bắt đầu, đang chơi cần resume, đã hoàn thành và hết hạn.

Sửa đổi 2026-10-29: hai game thi đấu được thay theo `live-arena-game-spec.md`. Dòng Chảy Lịch Sử chỉ còn là chế độ luyện tập; Phòng Quyết Sách chỉ còn trong hồ sơ.

### Bãi Mìn Tri Thức

- Thiết kế laptop và mobile cho bàn cờ 4 × 5 và overlay câu hỏi.
- Variants ô: chưa mở, focus bàn phím, câu hỏi Dễ/Trung bình/Khó, bom (gỡ thành công / thất bại / khiên đỡ), x2, khiên, rương.
- HUD: điểm, khiên, x2 đang chờ, tiến độ /10, đồng hồ toàn trận, thứ hạng và khoảng cách điểm.
- Feedback đúng/sai và điểm trong khoảng 0,8–1 giây, không hiển thị đáp án đúng.

### Đường Đua Lịch Sử

- Thiết kế laptop và mobile cho một câu mỗi màn hình với ba dạng: A/B/C, trước–sau, chọn cặp đúng.
- Đường đua tiến độ 15 câu, đồng hồ câu, đồng hồ toàn trận, chuỗi combo, chuyển cảnh nước rút và phản hồi tăng hạng.
- Feedback đúng/sai và điểm trong khoảng 0,8–1 giây, không hiển thị đáp án đúng.

### Xem lại sau khi cuộc thi chốt

- Màn xem lại từng câu: đề, lựa chọn, đáp án đúng, giải thích và nguồn; trạng thái "chưa mở" khi cuộc thi chưa Finalized.

### Bảng xếp hạng

- Hai bảng xếp hạng phải có nhận diện game khác nhau nhưng cùng hệ thống component.
- Tạo web view và projector view 1920x1080.
- Projector view hiển thị song song Top 10 của cả hai game bằng tên hiển thị lớp học ("An N.V.", không họ tên đầy đủ, không MSSV), người hoàn thành, thông báo vượt hạng, nhãn tạm thời/chính thức và timestamp đồng bộ; có chế độ phóng lớn Top 10 của một game.

## 8. Student và Auth bắt buộc

- Login bằng mã sinh viên và mật khẩu.
- Không có bước đổi mật khẩu lần đầu trong V1 (`LA-ACC-004`); màn đăng nhập có ghi chú dùng mật khẩu do giảng viên cung cấp.
- Student Passport có tiến độ 15 hồ sơ và hai kết quả độc lập theo cuộc thi.
- Resume flow sau mất mạng.
- Device transfer confirmation cho phiên chơi đang hoạt động.
- Generic error không tiết lộ chi tiết bảo mật.

## 9. Admin bắt buộc

Admin ưu tiên rõ ràng và hiệu quả hơn hiệu ứng:

- Dashboard trạng thái cuộc thi.
- Import CSV với preview, row errors và atomic rejection.
- Question workflow Draft, Reviewed, Published.
- Competition readiness checklist, schedule và insufficient-pool error.
- Live monitor cho attempt, disconnect allowance và session transfer.
- Audit log.

## 10. Prototype và chuyển động

- System boot tối đa 2.5 giây và có Skip.
- Cause reveal nối hai node rồi mở explanation panel.
- Decision compare dùng divider trượt.
- Rank shift chạy sau trạng thái server-confirmed.
- Tạo một prototype reduced-motion thay thế các hiệu ứng trên bằng dissolve hoặc instant state change.

## 11. Tiêu chuẩn bàn giao

- Auto layout và constraints đầy đủ; không đặt thủ công hàng loạt.
- Dùng variables và component variants thay vì style rời rạc.
- Layer và component đặt tên bằng tiếng Anh có cấu trúc; nội dung hiển thị bằng tiếng Việt.
- Mọi màn hình chính có trạng thái loading, empty, error và responsive cần thiết.
- Không tự tạo luật điểm, lượt chơi, timer hoặc dữ liệu cá nhân trái với Core Spec.
- Handoff notes phải chỉ rõ token, breakpoint, component behavior, motion timing và dữ liệu nào đến từ server.
