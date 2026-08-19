import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nguồn và AI" };

export default function SourcesAndAiPage() {
  return (
    <div className="page-shell disclosure-page">
      <header className="page-intro">
        <p className="eyebrow">Minh bạch học thuật</p>
        <h1>Nguồn &amp; AI</h1>
        <p>AI hỗ trợ cấu trúc và soạn bản nháp. AI không có quyền xác minh, duyệt hay xuất bản nội dung học thuật.</p>
      </header>
      <section>
        <h2>Nguồn đang được xem là đã xác minh</h2>
        <ul>
          <li>Giáo trình Lịch sử Đảng Cộng sản Việt Nam, Bộ Giáo dục và Đào tạo, 2021.</li>
          <li>VNR202 Session 4, Session 11 và Session 22 trong phạm vi locator ghi trên từng hồ sơ.</li>
        </ul>
      </section>
      <section>
        <h2>Quy tắc công bố</h2>
        <p>Một hồ sơ chỉ xuất hiện công khai khi có trạng thái Published và nguồn bắt buộc đã Verified. Dữ liệu mẫu hoặc citation chưa được giảng viên xác nhận không được trình bày như sự thật đã kiểm chứng.</p>
      </section>
    </div>
  );
}
