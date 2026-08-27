import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Live Arena" };

const sampleRanks = [
  ["01", "Nguyễn Minh Anh", "860"],
  ["02", "Trần Gia Huy", "820"],
  ["03", "Lê Thảo Vy", "790"],
] as const;

const games = [
  {
    tag: "GAME 01 · 6 sự kiện · luyện tập",
    title: "Dòng Chảy Lịch Sử",
    body: "Sắp xếp chuỗi sự kiện bằng kéo thả, chạm-chọn hoặc bàn phím. Chơi thử ngay, không cần đăng nhập.",
    href: "/live-arena/dong-chay-lich-su",
    cta: "Chơi luyện tập →",
    playable: true,
  },
  {
    tag: "GAME 02 · 6 tình huống · 9 phút",
    title: "Phòng Quyết Sách",
    body: "Ra quyết định qua bốn giai đoạn có trọng số. Lượt đang chơi được tiếp tục trên thiết bị khác, không tạo lượt mới.",
    href: "/ho-so",
    cta: "Trải nghiệm qua Hồ sơ →",
    playable: false,
  },
] as const;

export default function LiveArenaPage() {
  return (
    <div className="page-shell arena-page">
      <header className="page-intro">
        <p className="eyebrow">Live Arena · Chế độ khách</p>
        <h1>Hai nhịp chơi. Hai bảng xếp hạng.</h1>
        <p>Chơi thử chế độ luyện tập ngay. Cuộc thi tính điểm với một lượt duy nhất mở theo lịch giảng viên.</p>
        <p className="arena-status">
          <span className="arena-status__dot" />
          Chế độ luyện tập đang mở · chơi thử tự do
        </p>
      </header>

      <section className="arena-grid">
        {games.map((game, gameIndex) => (
          <article className="arena-col" data-playable={game.playable} key={game.title}>
            <div className="arena-col__game">
              <span className="arena-col__tag">{game.tag}</span>
              <h2>{game.title}</h2>
              <p>{game.body}</p>
              <Link className="arena-col__cta" href={game.href}>{game.cta}</Link>
            </div>
            <div className="arena-col__board">
              <header>
                <span>Bảng xếp hạng</span>
                <strong>Mẫu</strong>
              </header>
              <ol>
                {sampleRanks.map(([rank, name, score]) => (
                  <li key={`${game.title}-${rank}`}>
                    <span>{rank}</span>
                    <strong>{name}</strong>
                    <b>{Number(score) - gameIndex * 120} điểm</b>
                  </li>
                ))}
              </ol>
              <p className="arena-col__note">Dữ liệu thật cập nhật khi cuộc thi chính thức mở</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
