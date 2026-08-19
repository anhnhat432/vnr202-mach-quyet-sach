import type { Metadata } from "next";

export const metadata: Metadata = { title: "Phòng Phương Pháp" };

const methods = [
  { code: "01", title: "Dữ kiện", copy: "Điều có thể quy về sự kiện, văn bản, số liệu hoặc dấu vết trong một nguồn xác định." },
  { code: "02", title: "Nhận định", copy: "Cách giải thích ý nghĩa của dữ kiện. Nhận định cần chỉ rõ căn cứ và giới hạn." },
  { code: "03", title: "Nguồn", copy: "Nơi cho phép người đọc kiểm tra dữ kiện: giáo trình, bài giảng, văn kiện hoặc tư liệu đã được duyệt." },
] as const;

export default function MethodRoomPage() {
  return (
    <div className="page-shell method-room">
      <header className="page-intro">
        <p className="eyebrow">Phòng Phương Pháp</p>
        <h1>Đọc lịch sử như một hệ thống bằng chứng</h1>
        <p>Website không yêu cầu bạn nhớ mọi mốc. Nó yêu cầu bạn phân biệt điều đã biết, điều đang được diễn giải và nguồn nào cho phép kiểm tra.</p>
      </header>
      <section className="method-triad" aria-label="Ba khái niệm nền tảng">
        {methods.map((item) => (
          <article key={item.code}><span>{item.code}</span><h2>{item.title}</h2><p>{item.copy}</p></article>
        ))}
      </section>
      <section className="method-sequence">
        <div><p className="eyebrow">Phương pháp lịch sử</p><h2>Đi từ cụ thể đến bối cảnh</h2><p>Xác định sự kiện trong thời gian, không gian, lực lượng và điều kiện riêng của nó trước khi rút ra kết luận.</p></div>
        <div><p className="eyebrow">Phương pháp logic</p><h2>Đi từ quan hệ đến bản chất</h2><p>So sánh nhiều dữ kiện để nhận ra mâu thuẫn, xu hướng, nguyên nhân và hệ quả có tính hệ thống.</p></div>
      </section>
      <section className="method-protocol">
        <p className="eyebrow">Protocol đọc một hồ sơ</p>
        <ol><li>Nhận diện áp lực của tình thế.</li><li>Loại dữ kiện nhiễu.</li><li>Chọn hướng quyết định.</li><li>Phân tích hệ quả có điều kiện.</li><li>Đối chiếu với lịch sử và nguồn.</li></ol>
      </section>
    </div>
  );
}
