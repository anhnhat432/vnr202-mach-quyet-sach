"use client";

import { Bomb, Flag, LogIn, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ArenaApiError, arenaApi } from "@/features/arena/client/api";
import type { Game, Lobby } from "@/features/arena/client/types";

// Live Arena hub: the open competition and this student's state in each game. Public visitors see
// how it works and the live boards; playing needs the MSSV sign-in.
const GAMES: Record<Game, { title: string; href: string; tag: string; body: string; icon: React.ReactNode }> = {
  minefield: { title: "Bãi Mìn Tri Thức", href: "/live-arena/bai-min", tag: "Game 1 · 4×5 ô · 3:00", body: "Mở ô bí ẩn, trả lời câu hỏi, gỡ bom, gom khiên, x2 và rương.", icon: <Bomb aria-hidden /> },
  race: { title: "Đường Đua Lịch Sử", href: "/live-arena/duong-dua", tag: "Game 2 · 15 câu · 2:30", body: "Trả lời liên tiếp, tích combo và bứt tốc ở ba câu nước rút.", icon: <Flag aria-hidden /> },
};

export function ArenaHub() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    arenaApi.lobby().then(setLobby).catch((error) => {
      if (error instanceof ArenaApiError && error.status === 401) setSignedOut(true);
      else setFailed(true);
    });
  }, []);

  const comp = lobby?.competition ?? null;
  return (
    <div className="hub">
      <section className="hub__status" aria-live="polite">
        {signedOut ? (
          <p>Đăng nhập bằng mã số sinh viên để vào thi. <Link className="hub__link" href="/dang-nhap"><LogIn aria-hidden size={16} /> Đăng nhập</Link></p>
        ) : failed ? (
          <p>Không tải được trạng thái cuộc thi. Hãy tải lại trang.</p>
        ) : !lobby ? (
          <p>Đang kiểm tra cuộc thi…</p>
        ) : comp ? (
          <p>
            <span className="hub__dot" /> <strong>{comp.name}</strong> · {comp.kind === "rehearsal" ? "Diễn tập" : "Cuộc thi"} ·{" "}
            {comp.state === "open" ? `nhận lượt mới tới ${new Date(comp.startDeadlineAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "đã đóng nhận lượt mới"}
          </p>
        ) : (
          <p>Chưa có cuộc thi đang mở. Bạn vẫn có thể chơi luyện tập.</p>
        )}
      </section>
      <div className="hub__games">
        {(Object.keys(GAMES) as Game[]).map((game) => {
          const meta = GAMES[game];
          const mine = lobby?.games.find((g) => g.game === game);
          const label = !mine?.attemptId ? "Vào game" : mine.state === "active" ? "Tiếp tục lượt đang chơi" : mine.state === "voided" ? "Lượt đã bị vô hiệu" : `Đã hoàn thành · ${mine.score ?? 0} điểm`;
          return (
            <article key={game} className={`hub__game hub__game--${game}`}>
              <span className="hub__icon">{meta.icon}</span>
              <span className="hub__tag">{meta.tag}</span>
              <h2>{meta.title}</h2>
              <p>{meta.body}</p>
              <Link className="hub__cta" href={meta.href}>{signedOut ? "Xem luật chơi" : label} →</Link>
            </article>
          );
        })}
      </div>
      <div className="hub__links">
        <Link className="hub__link" href="/live-arena/bang-xep-hang"><Trophy aria-hidden size={16} /> Hai bảng xếp hạng trực tiếp</Link>
        {signedOut ? null : <Link className="hub__link" href="/passport">Hồ sơ học tập</Link>}
        {signedOut ? null : <Link className="hub__link" href="/live-arena/xem-lai">Xem lại lượt thi của bạn</Link>}
        <Link className="hub__link" href="/live-arena/dong-chay-lich-su">Luyện tập tự do: Dòng Chảy Lịch Sử (không tính điểm)</Link>
      </div>
    </div>
  );
}
