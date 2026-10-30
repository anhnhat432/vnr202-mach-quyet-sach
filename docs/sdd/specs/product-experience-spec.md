# Đặc tả trải nghiệm sản phẩm: VNR202 - Mạch Quyết Sách

Trạng thái: Approved; sửa đổi v1.1 cho Live Arena V1.0 (2026-10-29) chờ duyệt văn bản — luật game chi tiết nằm ở `live-arena-game-spec.md`  
Phương pháp: Hybrid SDD + ADD  
Độ sâu: Standard cho trải nghiệm công khai, Light cho phong cách thị giác  
Phạm vi: Website công khai, 15 Hồ sơ Quyết sách, Mạch Nguyên Nhân, Ma trận Bằng chứng, Student Passport và vỏ giao diện Live Arena

## 1. Mục tiêu sản phẩm

VNR202 - Mạch Quyết Sách không trình bày lịch sử như một bảo tàng số hoặc một chuỗi bài học. Website đặt người học vào một trung tâm dữ liệu - điều hành, nơi mỗi giai đoạn lịch sử xuất hiện như một bài toán có bối cảnh, lực lượng, mâu thuẫn, bằng chứng, quyết sách, hệ quả và bài học.

Trải nghiệm phải tạo được ba phản ứng:

1. Người dùng muốn khám phá tiếp vì cách kể chuyện và tương tác khác một website môn học thông thường.
2. Người dùng hiểu được quan hệ nhân - quả và lý do của quyết sách, thay vì chỉ nhớ mốc thời gian.
3. Giảng viên có thể truy ngược mỗi luận điểm về học liệu hoặc nguồn tham khảo đã được duyệt.

Live Arena là một phân hệ nổi bật nhưng không thay thế phần trải nghiệm lịch sử chính.

## 2. Nguyên tắc thiết kế

- Không mô phỏng lịch sử phản thực tế như một kết luận chắc chắn. Mọi nhánh trước khi đối chiếu lịch sử chỉ được mô tả là hệ quả dự kiến dựa trên dữ kiện đã cung cấp.
- Không chấm điểm quan điểm chính trị của người dùng trong phần công khai. Hệ thống đánh giá khả năng đọc dữ kiện, nhận diện vấn đề và lập luận.
- Mỗi luận điểm quan trọng phải có nguồn; mỗi nguồn phải chỉ ra nó hỗ trợ luận điểm nào.
- Thành tựu, hạn chế, nguyên nhân và bài học phải được trình bày cân bằng trong cùng một cấu trúc.
- Một Scenario Engine dùng chung phải vận hành cả 15 hồ sơ để bảo đảm tính nhất quán và giúp một người có thể duy trì sản phẩm.
- Hiệu ứng thị giác phải phục vụ việc hiểu dữ liệu, diễn biến hoặc thay đổi trạng thái; không dùng chuyển động trang trí liên tục.

## 3. Kiến trúc thông tin

### 3.1 Khu vực công khai

- `Trang chủ / Phòng Điều Hành`: giới thiệu luận đề, ba chương, trạng thái Live Arena và lối vào ba trải nghiệm chính.
- `Phòng Phương Pháp`: chuyển nội dung Chương nhập môn thành hướng dẫn cách đọc sự kiện, phân biệt dữ kiện - nhận định - nguồn và sử dụng phương pháp lịch sử, logic.
- `Kho Hồ sơ`: danh mục 15 Hồ sơ Quyết sách, lọc theo chương, giai đoạn, chủ đề và trạng thái đã khám phá.
- `Hồ sơ Quyết sách`: trải nghiệm tương tác theo Scenario Engine.
- `Mạch Nguyên Nhân`: đồ thị thời gian liên kết bối cảnh, mâu thuẫn, chủ trương, tổ chức thực hiện, kết quả và bài học.
- `Ma trận Bằng chứng`: đối chiếu luận điểm với nguồn, loại bằng chứng và phần nội dung mà nguồn hỗ trợ.
- `Live Arena`: trạng thái cuộc thi, hai game, hai bảng xếp hạng và chế độ trình chiếu.
- `Luyện tập Dòng Chảy Lịch Sử`: chế độ luyện tập tự do, không đăng nhập, không tính điểm, không thuộc cuộc thi (`LA-SCOPE-002`).
- `Giới thiệu nguồn và AI`: danh mục học liệu, nguyên tắc kiểm chứng và nhật ký AI ở mức phù hợp để giải trình sản phẩm.

### 3.2 Khu vực cần đăng nhập

- `Student Passport`: hồ sơ học tập, tiến độ hồ sơ đã hoàn thành, trạng thái lượt chơi và kết quả của hai game theo từng cuộc thi.
- `Game 1 – Bãi Mìn Tri Thức`: bàn cờ 20 ô, 10 câu chính, thử nghiệm 3:00 (`MINE-*`).
- `Game 2 – Đường Đua Lịch Sử`: 15 câu, combo và nước rút, thử nghiệm 2:30 (`RACE-*`).
- `Kết quả cá nhân`: điểm, thứ hạng, số câu đúng, số câu Khó đúng và thời gian hoàn thành; không cho phép bắt đầu lượt thứ hai. Phần xem lại đáp án, giải thích và nguồn chỉ mở sau khi cuộc thi Finalized (`LA-FB-004`).

### 3.3 Khu vực quản trị

- Nhập lớp từ `.xlsx` hoặc `.csv` có bản xem trước; tài khoản dùng mật khẩu mặc định chung (`LA-ACC-001..006`).
- Thao tác xử lý sự cố có ghi audit, không tự động tạo lượt mới (`LA-ADMIN-*`).
- Quản lý câu hỏi theo Draft -> Reviewed -> Published.
- Quản lý 15 hồ sơ, nguồn và liên kết nhân - quả.
- Tạo, kiểm tra điều kiện, lên lịch, theo dõi, chốt và lưu trữ cuộc thi.
- Theo dõi phiên chơi, trạng thái mất kết nối, chuyển thiết bị, điểm và audit log.

## 4. Scenario Engine dùng chung

Mỗi Hồ sơ Quyết sách sử dụng cùng sáu chặng. Nội dung thay đổi theo hồ sơ nhưng hành vi giao diện và mô hình dữ liệu không thay đổi.

### Chặng 1 - Briefing

Hiển thị giai đoạn, bối cảnh thế giới và trong nước, mâu thuẫn trung tâm, lực lượng liên quan, mục tiêu và các ràng buộc. Người dùng phải hiểu vấn đề trước khi xem lựa chọn.

### Chặng 2 - Phòng Dữ kiện

Người dùng mở các thẻ dữ kiện gồm văn kiện, sự kiện, số liệu, bản đồ, trích dẫn hoặc nhận định. Thẻ có nhãn loại nguồn và đường dẫn tới Ma trận Bằng chứng. Một số thẻ là nhiễu có chủ đích nhưng vẫn phải đúng về mặt lịch sử.

### Chặng 3 - Bàn Quyết sách

Người dùng chọn dữ kiện then chốt, xác định vấn đề và đề xuất hướng quyết định. Hệ thống yêu cầu nêu căn cứ bằng thao tác chọn thẻ, sắp xếp ưu tiên hoặc nối quan hệ; không yêu cầu viết bài tự do.

### Chặng 4 - Mô phỏng Hệ quả

Hệ thống hiển thị chuỗi hệ quả dự kiến dựa trên lựa chọn và dữ kiện. Ngôn ngữ phải thể hiện đây là phép phân tích, không khẳng định một lịch sử thay thế chắc chắn.

### Chặng 5 - Đối chiếu Lịch sử

Giao diện chia đôi `Bạn đã ưu tiên` và `Lịch sử thực tế`, sau đó giải thích quyết định lịch sử, cách tổ chức thực hiện, kết quả, ý nghĩa, hạn chế, nguyên nhân và bài học.

### Chặng 6 - Kết nối Mạch

Hồ sơ kết thúc bằng các nút liên kết tới nguyên nhân trước đó, hệ quả về sau, hồ sơ kế tiếp và các nguồn trong Ma trận Bằng chứng. Người dùng nhận một dấu hoàn thành trong trình duyệt; nếu đã đăng nhập, dấu này được đồng bộ vào Student Passport nhưng không ảnh hưởng điểm Live Arena.

## 5. Danh mục 15 Hồ sơ Quyết sách

Danh mục dưới đây khóa phạm vi và câu hỏi trung tâm. Tên hiển thị cuối cùng có thể được biên tập ngắn hơn mà không thay đổi chủ đề.

### Chương 1 - Từ khủng hoảng đường lối đến giành chính quyền

1. `Con đường nào cho độc lập?` - Phân tích khủng hoảng đường lối cứu nước, bối cảnh thuộc địa và tiêu chí của một con đường cách mạng mới.
2. `Hợp nhất để mở đường` - Nguyễn Ái Quốc chuẩn bị điều kiện, thống nhất các tổ chức cộng sản, thành lập Đảng và Cương lĩnh chính trị đầu tiên.
3. `Giữ mạch phong trào` - Phong trào 1930-1931, cao trào Xô viết Nghệ - Tĩnh, tổn thất và quá trình phục hồi 1932-1935.
4. `Linh hoạt trong một cửa sổ dân chủ` - Bối cảnh, mục tiêu, hình thức đấu tranh và bài học của phong trào dân chủ 1936-1939.
5. `Chớp đúng thời cơ` - Chuyển hướng chiến lược 1939-1945, chuẩn bị lực lượng, cao trào kháng Nhật và quyết định Tổng khởi nghĩa Tháng Tám.

### Chương 2 - Giữ chính quyền, kháng chiến và thống nhất đất nước

6. `Giữ chính quyền giữa vòng vây` - Xử lý nạn đói, nạn dốt, tài chính, ngoại giao và các lực lượng đe dọa chính quyền 1945-1946.
7. `Khi hòa hoãn không còn đủ` - Thời điểm toàn quốc kháng chiến và đường lối toàn dân, toàn diện, lâu dài, dựa vào sức mình là chính.
8. `Tạo thế cho quyết chiến` - Chuyển biến 1950-1954, Đại hội II, xây dựng lực lượng, Điện Biên Phủ và Hiệp định Geneve.
9. `Một đất nước, hai nhiệm vụ chiến lược` - Xây dựng miền Bắc, đấu tranh ở miền Nam và quan hệ hậu phương - tiền tuyến giai đoạn 1954-1965.
10. `Từ đối đầu cục bộ đến toàn thắng` - Điều chỉnh chiến lược 1965-1975, vai trò hai miền, Hiệp định Paris và quyết định giải phóng hoàn toàn miền Nam.

### Chương 3 - Thống nhất, đổi mới và năng lực phát triển

11. `Bài toán hậu chiến` - Hoàn thành thống nhất về nhà nước, khôi phục đất nước, bảo vệ Tổ quốc và những khó khăn của mô hình 1975-1981.
12. `Phá vỡ sức ì của cơ chế cũ` - Chỉ thị 100, các bước đột phá, Đại hội V, cải cách giá - lương - tiền và khủng hoảng trước 1986.
13. `Đổi mới hay tụt hậu` - Đại hội VI, đổi mới toàn diện, kinh tế nhiều thành phần, Khoán 10 và quá trình thoát khỏi khủng hoảng 1986-1996.
14. `Mở cửa nhưng không mất phương hướng` - Công nghiệp hóa, hiện đại hóa, kinh tế tri thức, hội nhập quốc tế, chuyển đổi số và phát triển kinh tế tư nhân từ 1996 đến nay.
15. `Giữ niềm tin bằng năng lực thể chế` - Thành tựu, hạn chế, nguyên nhân, kinh nghiệm đổi mới; nguyên nhân, tác hại và yêu cầu phòng chống tham nhũng, tiêu cực.

## 6. Mạch Nguyên Nhân

Mạch Nguyên Nhân là bản đồ dữ liệu dùng chung, không phải một timeline trang trí.

- Trục ngang thể hiện thời gian từ trước 1930 đến hiện nay.
- Sáu làn dữ liệu gồm `Bối cảnh`, `Mâu thuẫn`, `Lực lượng`, `Quyết sách`, `Kết quả`, `Bài học`.
- Người dùng có thể lọc theo chương hoặc loại quan hệ: nguyên nhân trực tiếp, điều kiện, phản ứng, kết quả, hạn chế và bài học.
- Mỗi nút phải chỉ ra hồ sơ chứa phần giải thích đầy đủ và nguồn liên quan.
- Khi chọn hai nút, hệ thống giải thích đường liên kết bằng văn bản ngắn thay vì chỉ vẽ một đường nối.
- Trên màn hình nhỏ, đồ thị chuyển thành chuỗi thẻ theo lát cắt, không ép người dùng thao tác trên canvas thu nhỏ.

## 7. Ma trận Bằng chứng

Ma trận Bằng chứng giúp giảng viên và sinh viên kiểm chứng cách sản phẩm xây dựng luận điểm.

- Hàng là luận điểm hoặc quyết sách; cột là `Bối cảnh`, `Căn cứ`, `Tổ chức thực hiện`, `Kết quả`, `Hạn chế`, `Bài học`.
- Mỗi ô chứa một hoặc nhiều nguồn và phạm vi mà nguồn hỗ trợ; không gán một nguồn cho kết luận rộng hơn nội dung nguồn.
- Bộ lọc gồm chương, hồ sơ, loại tài liệu, văn kiện, giáo trình, slide và tài liệu tham khảo.
- Mỗi nguồn có tên, tác giả/cơ quan, năm, trang hoặc phần, URL nếu có và ghi chú sử dụng.
- Nội dung do AI hỗ trợ phải có trạng thái kiểm chứng và người chịu trách nhiệm duyệt.

## 8. Live Arena trong tổng thể website

Sửa đổi v1.1: hai game thi đấu là Bãi Mìn Tri Thức và Đường Đua Lịch Sử (`LA-SCOPE-001`). Mô tả Dòng Chảy Lịch Sử và Phòng Quyết Sách dạng game thi đấu của v1.0 đã bị thay thế; Dòng Chảy còn là chế độ luyện tập tự do, Phòng Quyết Sách còn là chặng trong hồ sơ công khai.

### Nguyên tắc chung cho hai game

- Người chơi hiểu cách chơi trong khoảng 10 giây; câu hỏi ngắn, tối đa ba đáp án, một lần nhấn để trả lời.
- Đồng hồ câu và đồng hồ toàn trận lấy từ server; F5 hoặc đổi thiết bị không làm mới thời gian (`LA-TIME-*`).
- Phản hồi sau mỗi tương tác chỉ có đúng/sai, điểm nhận được và hiệu ứng ngắn khoảng 0,8–1 giây; không hiển thị đáp án đúng hay giải thích khi cuộc thi chưa chốt (`LA-FB-001..003`).
- Hiệu ứng không che câu hỏi và không lấy thời gian trả lời; có tắt âm thanh và giảm chuyển động.

### Bãi Mìn Tri Thức

- Bàn cờ 4 × 5 là trung tâm màn hình; ô chưa mở giống nhau, ô đã mở hiện loại (câu hỏi kèm độ khó, bom, x2, khiên, rương).
- Khi mở ô câu hỏi hoặc bom, câu hỏi phủ lên bàn cờ với đồng hồ đếm ngược lớn và hai hoặc ba nút đáp án lớn.
- Thanh trạng thái hiển thị điểm, số khiên, x2 đang chờ, số câu chính đã xử lý /10, đồng hồ toàn trận và thứ hạng cá nhân.
- Bàn phím: phím mũi tên di chuyển giữa các ô, Enter để mở, 1/2/3 hoặc A/B/C để trả lời.

### Đường Đua Lịch Sử

- Một câu mỗi màn hình; đường đua thể hiện tiến độ 15 câu của chính người chơi.
- Đồng hồ câu, đồng hồ toàn trận, điểm, chuỗi combo và thứ hạng luôn nhìn thấy.
- Ba câu cuối chuyển sang giai đoạn nước rút với hiệu ứng ngắn; có thể hiển thị mốc điểm tham chiếu của hạng 1 và hạng 10 nhưng không giả lập người khác đang chạy cùng lúc.
- Khi tăng hạng, có phản hồi ngắn và rõ.

### Hai bảng xếp hạng

- Hai game có hai bảng độc lập trong mọi trạng thái: tạm thời, chính thức và lưu trữ. Không có bảng tổng hợp hai game.
- Bảng được gắn nhãn `Tạm thời` cho tới khi cuộc thi Finalized, sau đó là `Chính thức` (`LA-LB-007`).
- Bảng công khai hiển thị **tên hiển thị lớp học** dạng rút gọn (ví dụ "An N.V."), điểm, trạng thái (đang chơi, đã hoàn thành, hết giờ) và xu hướng thay đổi hạng; không hiển thị họ tên đầy đủ, mã sinh viên hay người chưa chơi (`LA-PRV-003`).
- Khách chưa đăng nhập chỉ xem Top 10 mỗi game và số liệu tổng hợp; sinh viên đăng nhập xem thêm thứ hạng cá nhân (`LA-PRV-004`).
- Phản hồi đúng/sai không được trình bày như cơ chế chống chia sẻ đáp án tuyệt đối (`LA-FB-007`).
- Người chơi thấy hàng của mình được ghim hoặc làm nổi bật mà không làm thay đổi thứ tự dữ liệu; thấy khoảng cách điểm tới người ngay trên, hoặc tới hạng 10 nếu ở ngoài Top 10 (`LA-LB-005`).
- Chế độ trình chiếu 1920x1080 hiển thị song song Top 10 của cả hai game, số người đã hoàn thành, thông báo vượt hạng và có chế độ phóng lớn Top 10 của một game; chuyển động đổi hạng phải rõ nhưng không gây nhấp nháy.

## 9. Student Passport

- Hiển thị họ tên (chỉ cho chính sinh viên), tên hiển thị trên bảng xếp hạng, lớp và lịch sử cuộc thi (V1 không có bước đổi mật khẩu bắt buộc, `LA-ACC-004`).
- Hiển thị 15 dấu hồ sơ theo ba chương; tiến độ hồ sơ không cộng vào điểm game.
- Mỗi cuộc thi có hai thẻ kết quả độc lập, thể hiện `Chưa bắt đầu`, `Đang chơi`, `Đã hoàn thành` hoặc `Hết giờ`.
- Nếu lượt đang hoạt động, nút chính là `Tiếp tục lượt chơi`; không xuất hiện nút tạo lượt mới.
- Với lượt đã kết thúc, hiển thị điểm, thứ hạng (gắn nhãn tạm thời hoặc chính thức), số câu đúng, số câu Khó đúng và thời gian hoàn thành; liên kết xem lại đáp án và giải thích chỉ xuất hiện sau khi cuộc thi Finalized.

## 10. Hướng thị giác và cảm xúc

### Tuyên ngôn

Giao diện mang cảm giác của một phòng điều hành dữ liệu lịch sử được xây trên nền tài liệu thật: chính xác, hiện đại, có chiều sâu và có sức căng. Toàn bộ website không dùng nền tối mặc định; nền giấy kỹ thuật sáng tạo độ tin cậy, còn các bảng điều hành tối được dùng có chủ đích ở những đoạn cần tập trung.

### Hệ màu đề xuất

- `Paper`: ngà ấm `#F3EBDD`.
- `Ink`: xanh than `#14212B`.
- `Command Red`: đỏ son trầm `#B1282E`.
- `Signal Amber`: hổ phách `#D6922E`.
- `Evidence Teal`: xanh lục lam `#0D6B66`.
- `Night Panel`: than xanh `#182126`.

Màu đỏ chỉ đánh dấu quyết định, trạng thái quan trọng hoặc điểm chuyển lịch sử; không phủ toàn bộ giao diện.

### Kiểu chữ đề xuất

- Tiêu đề và nhãn điều hành: `Saira Condensed`, đậm, hẹp, tạo nhịp dữ liệu.
- Nội dung tiếng Việt: `Be Vietnam Pro`, dễ đọc ở kích thước nhỏ.
- Số liệu và mã hồ sơ: kiểu mono có hỗ trợ tiếng Việt hoặc dùng chữ số tabular từ font nội dung.

### Nền và chất liệu

- Lưới tọa độ mờ, đường đồng mức, dấu đăng ký in, lớp giấy và các đường tín hiệu mảnh.
- Hình ảnh lịch sử được xử lý như tài liệu lưu trữ có chú thích nguồn, không dùng collage ngẫu nhiên.
- Không dùng card bo tròn đồng đều cho mọi nội dung; ưu tiên panel cắt góc, đường dẫn, thẻ hồ sơ và vùng dữ liệu có cấp bậc rõ.

### Chuyển động chủ đạo

1. `System boot`: trang chủ khởi động các mạch dữ liệu trong tối đa 2.5 giây, có thể bỏ qua.
2. `Cause reveal`: đường nhân - quả được vẽ khi người dùng chọn nút, kèm giải thích văn bản.
3. `Decision compare`: tấm phân cách trượt để đối chiếu lựa chọn của người dùng với lịch sử thực tế.
4. `Rank shift`: hàng xếp hạng di chuyển tới vị trí mới sau một cập nhật đã được server xác nhận.

Mọi chuyển động phải có biến thể reduced-motion.

## 11. Trải nghiệm theo thiết bị

- Desktop 1440px là trải nghiệm khám phá đầy đủ.
- Mobile 390px là trải nghiệm chơi game và đọc hồ sơ hạng nhất, không phải bản desktop bị thu nhỏ.
- Projector 1920x1080 là chế độ riêng cho bảng xếp hạng trong lớp.
- Các thao tác kéo thả phải có phương án chạm chọn - chạm đặt và điều khiển bàn phím tương đương.
- Mọi văn bản chính phải đạt độ tương phản WCAG AA; không truyền trạng thái chỉ bằng màu.

## 12. Trạng thái giao diện bắt buộc

- Loading, empty, partial content, content unavailable và retry.
- Chưa đăng nhập, sai thông tin đăng nhập và phiên hết hạn.
- Cuộc thi chưa mở, đang mở, đã đóng nhận lượt, đang chốt và đã kết thúc.
- Chưa chơi, đang chơi, đang có lượt ở game kia, mất kết nối (đồng hồ vẫn chạy), đang đồng bộ lại, phiên bị thu hồi do chuyển thiết bị, đã hoàn thành và hết giờ.
- Bảng xếp hạng chưa có dữ liệu, tạm thời đang live, mất realtime nhưng còn dữ liệu cache, đang đồng bộ lại và chính thức.
- Hồ sơ thiếu nguồn hoặc chưa được Published phải không xuất hiện công khai.

## 13. Tiêu chí chấp nhận EARS

- `UX-AC-001`: WHEN một khách mở trang chủ, THE SYSTEM SHALL hiển thị lối vào ba chương, Phòng Phương Pháp, Kho Hồ sơ và Live Arena mà không yêu cầu đăng nhập.
- `UX-AC-002`: WHEN một khách mở Kho Hồ sơ, THE SYSTEM SHALL hiển thị đúng 15 hồ sơ, chia thành ba chương với năm hồ sơ mỗi chương.
- `UX-AC-003`: WHEN một người dùng hoàn thành một hồ sơ, THE SYSTEM SHALL cho phép đi qua đủ sáu chặng và hiển thị phần đối chiếu lịch sử cùng nguồn.
- `UX-AC-004`: WHEN một luận điểm quan trọng xuất hiện, THE SYSTEM SHALL cung cấp đường dẫn tới nguồn hỗ trợ trong Ma trận Bằng chứng.
- `UX-AC-005`: WHEN người dùng chọn một nút trong Mạch Nguyên Nhân, THE SYSTEM SHALL hiển thị quan hệ, giải thích ngắn và liên kết tới hồ sơ tương ứng.
- `UX-AC-006`: IF thiết bị có chiều rộng nhỏ, THEN THE SYSTEM SHALL chuyển Mạch Nguyên Nhân sang lát cắt dạng thẻ có thể sử dụng mà không cần canvas thu nhỏ.
- `UX-AC-007`: WHEN một sinh viên đã đăng nhập mở Live Arena, THE SYSTEM SHALL hiển thị riêng trạng thái lượt của từng game và nút bắt đầu hoặc tiếp tục hợp lệ.
- `UX-AC-008`: WHEN điểm của một game được server xác nhận, THE SYSTEM SHALL cập nhật đúng bảng xếp hạng của game đó mà không thay đổi bảng của game còn lại.
- `UX-AC-009`: WHEN bảng xếp hạng công khai được hiển thị, THE SYSTEM SHALL hiển thị tên hiển thị lớp học và SHALL NOT hiển thị họ tên đầy đủ hay mã sinh viên. (Sửa đổi v1.1 theo `LA-PRV-003`.)
- `UX-AC-010`: IF realtime bị gián đoạn, THEN THE SYSTEM SHALL báo trạng thái đồng bộ và khôi phục bảng từ dữ liệu có thẩm quyền mà không giả vờ dữ liệu vẫn live.
- `UX-AC-011`: WHEN reduced-motion được bật, THE SYSTEM SHALL thay các chuyển động boot, vẽ mạch, so sánh và đổi hạng bằng chuyển trạng thái không gây chuyển động lớn.
- `UX-AC-012`: WHEN một hồ sơ chưa Published hoặc thiếu nguồn bắt buộc, THE SYSTEM SHALL không hiển thị hồ sơ đó trong khu vực công khai.
- `UX-AC-013`: WHEN chế độ trình chiếu mở ở 1920x1080, THE SYSTEM SHALL hiển thị song song Top 10 của hai game, số người đã hoàn thành và nhãn tạm thời/chính thức.
- `UX-AC-014`: WHEN một sinh viên đang chơi, THE SYSTEM SHALL hiển thị thứ hạng hiện tại và khoảng cách điểm tới người ngay trên, hoặc tới hạng 10 nếu ở ngoài Top 10.
- `UX-AC-015`: WHILE cuộc thi chưa Finalized, THE SYSTEM SHALL chỉ phản hồi đúng/sai và điểm sau mỗi câu, SHALL NOT hiển thị đáp án đúng hoặc giải thích.
- `UX-AC-016`: WHEN người chơi mới vào một game, THE SYSTEM SHALL trình bày luật trong một màn hình đọc được trong khoảng 10 giây.
- `UX-AC-017`: WHEN một khách mở chế độ luyện tập Dòng Chảy Lịch Sử, THE SYSTEM SHALL cho chơi không cần đăng nhập và SHALL NOT ghi kết quả vào bảng xếp hạng cuộc thi.

## 14. Ngoài phạm vi trải nghiệm đầu tiên

- Bảo tàng 3D, VR/AR và bản đồ thế giới 3D.
- Mạng xã hội, chat, bình luận công khai và nội dung do sinh viên đăng.
- Tạo lịch sử thay thế bằng AI hoặc chatbot tự do trả lời kiến thức môn học.
- Nhiều lớp, giải đấu giữa trường hoặc matchmaking toàn cầu.
- CMS kéo thả tổng quát; quản trị chỉ cần biểu mẫu phù hợp mô hình nội dung đã khóa.

## 15. Definition of Done cho Figma

- Có foundations, token, typography, grid và component states.
- Có luồng desktop và mobile cho Trang chủ, Kho Hồ sơ, một Hồ sơ hoàn chỉnh, Mạch Nguyên Nhân, Ma trận Bằng chứng, Live Arena, hai game, Student Passport và đăng nhập.
- Có projector mode cho hai bảng xếp hạng.
- Có trạng thái mất kết nối, resume, chuyển thiết bị và realtime resync (không có bước đổi mật khẩu lần đầu trong V1).
- Prototype thể hiện bốn chuyển động chủ đạo và reduced-motion.
- Nội dung mẫu lấy từ ít nhất một hồ sơ của mỗi chương; không dùng lorem ipsum cho màn hình đánh giá chính.

## 16. Ràng buộc triển khai

- Thiết kế Figma không được tự ý thay đổi luật Core trong `core-platform-spec.md` và `live-arena-game-spec.md`.
- Scenario Engine, Mạch Nguyên Nhân và Ma trận Bằng chứng phải dùng cùng mô hình nội dung để tránh ba bộ dữ liệu mâu thuẫn.
- Mọi điểm, thời gian, lượt chơi, quyền truy cập và bảng xếp hạng đều lấy từ server/database có thẩm quyền.
- Hình ảnh, trích dẫn và tài liệu chỉ được đưa vào bản công khai khi có nguồn và quyền sử dụng phù hợp.
