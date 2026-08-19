import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Live Arena" };

const demoRanks = [
  ["01", "Nguyễn Minh Anh", "860"],
  ["02", "Trần Gia Huy", "820"],
  ["03", "Lê Thảo Vy", "790"],
] as const;

export default function LiveArenaPage() {
  return (
    <div className="page-shell arena-page">
      <header className="page-intro page-intro--wide">
        <p className="eyebrow">Live Arena · Chế độ khách</p>
        <h1>Hai nhịp chơi. Hai bảng xếp hạng.</h1>
        <p>Khách có thể xem trạng thái cuộc thi và bảng công khai. Tài khoản sinh viên mới được bắt đầu hoặc tiếp tục đúng một lượt cho mỗi game.</p>
      </header>
      <div className="arena-status"><span className="arena-status__dot" />Cuộc thi demo chưa mở nhận lượt <small>Backend realtime được kích hoạt ở Phase 4-5</small></div>
      <section className="arena-games">
        <article>
          <span>GAME 01 · 15 câu · 6 phút</span>
          <h2>Dòng Chảy Lịch Sử</h2>
          <p>Sắp xếp chuỗi sự kiện bằng kéo thả, chạm-chọn hoặc bàn phím. Điểm và hạng cập nhật sau từng câu server xác nhận.</p>
          <Link href="/dang-nhap">Đăng nhập để chơi →</Link>
        </article>
        <article>
          <span>GAME 02 · 6 tình huống · 9 phút</span>
          <h2>Phòng Quyết Sách</h2>
          <p>Ra quyết định qua bốn giai đoạn có trọng số. Lượt đang chơi được tiếp tục trên thiết bị khác, không tạo lượt mới.</p>
          <Link href="/dang-nhap">Đăng nhập để chơi →</Link>
        </article>
      </section>
      <section className="arena-leaderboards">
        {["Dòng Chảy Lịch Sử", "Phòng Quyết Sách"].map((game, gameIndex) => (
          <article key={game}>
            <header><div><span>Bảng {gameIndex + 1}</span><h2>{game}</h2></div><strong>DEMO</strong></header>
            <ol>{demoRanks.map(([rank, name, score]) => <li key={`${game}-${rank}`}><span>{rank}</span><strong>{name}</strong><b>{Number(score) - gameIndex * 120} điểm</b></li>)}</ol>
          </article>
        ))}
      </section>
    </div>
  );
}
