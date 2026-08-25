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
      <header className="page-intro page-intro--wide">
        <p className="eyebrow">Live Arena · Chế độ khách</p>
        <h1>Hai nhịp chơi. Hai bảng xếp hạng.</h1>
        <p>
          Khách có thể chơi thử chế độ luyện tập và xem bảng công khai. Cuộc thi chính thức với một lượt duy nhất cho mỗi
          game và bảng xếp hạng realtime dành cho tài khoản sinh viên.
        </p>
      </header>
      <div className="arena-status">
        <span className="arena-status__dot" />
        Chế độ luyện tập đang mở · chơi thử tự do
        <small>Cuộc thi tính điểm chính thức mở theo lịch của giảng viên</small>
      </div>
      <section className="arena-games">
        {games.map((game) => (
          <article key={game.title} data-playable={game.playable}>
            <span>{game.tag}</span>
            <h2>{game.title}</h2>
            <p>{game.body}</p>
            <Link href={game.href}>{game.cta}</Link>
          </article>
        ))}
      </section>
      <section className="arena-leaderboards">
        {["Dòng Chảy Lịch Sử", "Phòng Quyết Sách"].map((game, gameIndex) => (
          <article key={game}>
            <header>
              <div>
                <span>Bảng {gameIndex + 1}</span>
                <h2>{game}</h2>
              </div>
              <strong>Mẫu</strong>
            </header>
            <ol>
              {sampleRanks.map(([rank, name, score]) => (
                <li key={`${game}-${rank}`}>
                  <span>{rank}</span>
                  <strong>{name}</strong>
                  <b>{Number(score) - gameIndex * 120} điểm</b>
                </li>
              ))}
            </ol>
            <p className="arena-leaderboards__note">Bảng minh họa · dữ liệu thật cập nhật khi cuộc thi chính thức mở</p>
          </article>
        ))}
      </section>
    </div>
  );
}
