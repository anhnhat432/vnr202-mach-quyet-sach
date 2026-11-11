// Locators read directly from the supplied scan, not accepted from OCR alone.
// Only bibliographic metadata and page references are distributed with the app.
export const TEXTBOOK = {
  title: "Giáo trình Lịch sử Đảng Cộng sản Việt Nam",
  audience: "Dành cho bậc đại học hệ không chuyên lý luận chính trị",
  author: "Bộ Giáo dục và Đào tạo",
  publisher: "Nhà xuất bản Chính trị quốc gia Sự thật",
  year: 2021,
  isbn: "978-604-57-6590-6",
  pageCount: 440,
  checkedAt: "2026-11-11",
} as const;

type TextbookReference = { pages: number[]; pdfPages: number[]; scope: string; note?: string };
function reference(pages: number[], scope: string, note?: string): TextbookReference {
  return { pages, pdfPages: [...pages], scope, ...(note ? { note } : {}) };
}

export const TEXTBOOK_REFERENCES: Record<string, TextbookReference> = {
  "1911-ra-di": reference([49, 50], "Bối cảnh bế tắc của các phong trào cứu nước và việc Nguyễn Tất Thành ra đi năm 1911. Ngày 5/6 và con tàu được đối chiếu bằng nguồn bảo tàng bên dưới."),
  "1920-tours": reference([51], "Đọc Luận cương, tham gia Đại hội Tours tháng 12/1920, tán thành Quốc tế III và tham gia sáng lập Đảng Cộng sản Pháp."),
  "1925-thanh-nien": reference([55, 56], "Thành lập Hội tại Quảng Châu tháng 6/1925, báo Thanh niên số đầu ngày 21/6/1925 và hoạt động huấn luyện cán bộ."),
  "1930-thanh-lap-dang": reference([61, 62, 63, 64], "Hội nghị hợp nhất, vai trò Nguyễn Ái Quốc, Cương lĩnh đầu tiên; chú thích trang 61 giải thích ngày kỷ niệm 3/2."),
  "1941-viet-minh": reference([95, 96, 97, 98], "Hội nghị Trung ương VIII, ưu tiên giải phóng dân tộc, Mặt trận Việt Minh và chuẩn bị khởi nghĩa. Ngày 19/5 được đối chiếu bằng nguồn bảo tàng."),
  "1945-thang-tam": reference([114, 115], "Giành chính quyền tại Hà Nội ngày 19/8, Huế ngày 23/8 và Sài Gòn ngày 25/8; vai trò của quần chúng."),
  "1945-doc-lap": reference([117], "Ngày 2/9/1945, lễ Độc lập tại Ba Đình, Hồ Chí Minh đọc Tuyên ngôn và tuyên bố sự ra đời của nước Việt Nam Dân chủ Cộng hòa."),
  "1946-khang-chien": reference([145, 146, 147, 148], "Bối cảnh hòa hoãn cuối năm 1946, quyết định kháng chiến, Lời kêu gọi và chiến đấu tại Hà Nội tối 19/12/1946."),
  "1950-bien-gioi": reference([159, 160], "Chủ trương mở Chiến dịch Biên giới, mục tiêu khai thông liên lạc, phạm vi Cao Bằng – Lạng Sơn và thời gian 16/9–17/10/1950."),
  "1954-dien-bien": reference([171, 172, 173], "Chuẩn bị hậu cần, mở màn ngày 13/3, thắng lợi ngày 7/5 sau 56 ngày đêm và chuyển sang đàm phán Genève."),
  "1960-dong-khoi": reference([191, 192], "Đồng khởi tại Mỏ Cày ngày 17/1/1960, vai trò Nguyễn Thị Định và chuyển biến từ giữ gìn lực lượng sang thế tiến công."),
  "1968-mau-than": reference([217, 218, 219], "Tiến công đô thị dịp Tết Mậu Thân, tác động chiến lược và đàm phán; trang 219 trình bày hạn chế chỉ đạo cùng tổn thất."),
  "1973-paris": reference([227, 228], "Ký Hiệp định ngày 27/1/1973, việc rút quân Mỹ và tình hình chiến tranh tiếp diễn sau Hiệp định."),
  "1975-thong-nhat": reference([232, 233], "Chiến dịch Hồ Chí Minh bắt đầu ngày 26/4, thắng lợi ở Sài Gòn ngày 30/4 và ý nghĩa kết thúc cuộc kháng chiến."),
  "1976-quoc-hoi": reference([240, 241], "Tổng tuyển cử 25/4/1976, kỳ họp Quốc hội chung và các quyết định về nhà nước thống nhất. Ngày 2/7 được đối chiếu thêm bằng nguồn Quốc hội."),
  "1981-khoan-100": reference([247], "Chỉ thị 100 ngày 13/1/1981, khoán sản phẩm đến nhóm và người lao động, cách phân chia công việc và động lực sản xuất."),
  "1986-doi-moi": reference([260, 261, 262], "Đại hội VI ngày 15–18/12/1986, bối cảnh khủng hoảng, bầu Nguyễn Văn Linh và nội dung đổi mới quản lý kinh tế."),
  "1995-asean": reference([281], "Việt Nam trở thành thành viên ASEAN ngày 28/7/1995 trong quá trình mở rộng quan hệ đối ngoại. Địa điểm và thứ tự thành viên được đối chiếu với ASEAN."),
  "2007-wto": reference([332], "Nội dung về hội nhập WTO, vị trí thành viên thứ 150 và các cơ hội hội nhập; ngày hiệu lực được kiểm chứng bằng hồ sơ WTO.", "Cần phân biệt mốc: trang 332 của bản scan ghi tháng 11/2006. Hồ sơ WTO ghi nhận phê duyệt gia nhập ngày 07/11/2006 và tư cách thành viên có hiệu lực ngày 11/01/2007. Timeline dùng ngày hiệu lực; trang giáo trình này không được dùng để xác nhận ngày 11/01/2007."),
  "2021-dai-hoi-xiii": reference([386, 387], "Đại hội XIII ngày 25/1–1/2/2021 tại Hà Nội, bối cảnh, chủ đề và các tầm nhìn phát triển tới 2025, 2030, 2045."),
};
