import Link from "next/link";

const chapterSignals = [
  { number: "01", years: "1919-1945", label: "Tìm đường và giành chính quyền", href: "/ho-so#chapter-1" },
  { number: "02", years: "1945-1975", label: "Giữ nước và thống nhất", href: "/ho-so#chapter-2" },
  { number: "03", years: "1975-nay", label: "Đổi mới và phát triển", href: "/ho-so#chapter-3" },
] as const;

export default function Home() {
  return (
    <div className="home-shell">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="eyebrow">Bộ môn VNR202 · FPT University · trước 1930-nay</p>
          <h1 id="home-title">Mạch Quyết Sách</h1>
          <p className="home-hero__lead">
            Lịch sử không chỉ là điều đã xảy ra. Đó là chuỗi dữ kiện, sức ép và lựa chọn đã đổi hướng cả một thời đại.
          </p>
          <div className="home-hero__actions">
            <Link className="command-button" href="/ho-so">
              Mở kho hồ sơ <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" href="/phong-phuong-phap">
              Cách đọc một quyết sách
            </Link>
          </div>
        </div>
        <div className="signal-field" aria-label="Ba chương lịch sử">
          <div className="signal-field__axis" aria-hidden="true" />
          {chapterSignals.map((chapter) => (
            <Link className="signal-node" href={chapter.href} key={chapter.number}>
              <span className="signal-node__pulse" aria-hidden="true" />
              <span className="signal-node__number">CH.{chapter.number}</span>
              <strong>{chapter.label}</strong>
              <span>{chapter.years}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mission-strip" aria-labelledby="mission-title">
        <div>
          <p className="eyebrow">Luồng khám phá chính</p>
          <h2 id="mission-title">Từ dữ kiện đến quyết định</h2>
        </div>
        <ol>
          <li><span>01</span>Đọc bối cảnh</li>
          <li><span>02</span>Lọc bằng chứng</li>
          <li><span>03</span>Chọn quyết sách</li>
          <li><span>04</span>Đối chiếu lịch sử</li>
        </ol>
      </section>

      <section className="home-portal" aria-label="Các phân hệ chính">
        <Link href="/mach-nguyen-nhan">
          <span className="home-portal__index">A</span>
          <h2>Mạch Nguyên Nhân</h2>
          <p>Đọc sáu lớp quan hệ từ bối cảnh đến bài học, thay vì một dòng thời gian phẳng.</p>
          <span className="home-portal__action">Kích hoạt mạch →</span>
        </Link>
        <Link href="/ma-tran-bang-chung">
          <span className="home-portal__index">B</span>
          <h2>Ma trận Bằng chứng</h2>
          <p>Kiểm tra luận điểm nào được nguồn nào hỗ trợ và phần nào còn cần xác minh.</p>
          <span className="home-portal__action">Mở ma trận →</span>
        </Link>
        <Link className="home-portal__arena" href="/live-arena">
          <span className="home-portal__index">LIVE</span>
          <h2>Live Arena</h2>
          <p>Hai game, hai lượt độc lập và hai bảng xếp hạng realtime cho cả lớp.</p>
          <span className="home-portal__action">Xem trạng thái cuộc thi →</span>
        </Link>
      </section>
    </div>
  );
}
