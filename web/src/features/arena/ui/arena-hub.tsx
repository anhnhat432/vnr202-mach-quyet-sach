"use client";

import { Bomb, Flag, LogIn, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisibleRefresh } from "@/features/arena/client/use-visible-refresh";

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
  const [forbidden, setForbidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const next = await arenaApi.lobby();
      if (!mounted.current) return;
      setLobby(next);
      setSignedOut(false);
      setForbidden(false);
      setFailed(false);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ArenaApiError && error.status === 401) setSignedOut(true);
      else if (error instanceof ArenaApiError && error.status === 403) setForbidden(true);
      else setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const first = window.setTimeout(() => void load(), 0);
    return () => { mounted.current = false; window.clearTimeout(first); };
  }, [load]);
  useVisibleRefresh(load, !signedOut && !forbidden);

  const comp = lobby?.competition ?? null;
  return (
    <div className="hub">
      <section className="hub__status" aria-live="polite">
        {signedOut ? (
          <p>Đăng nhập bằng mã số sinh viên để vào thi. <Link className="hub__link" href="/dang-nhap"><LogIn aria-hidden size={16} /> Đăng nhập</Link></p>
        ) : forbidden ? (
          <p>Tài khoản này không có quyền chơi lượt sinh viên. <Link href="/quan-tri/cuoc-thi">Vào quản trị</Link> hoặc đăng xuất để dùng tài khoản sinh viên.</p>
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
          <p>Đang chờ giảng viên mở cuộc thi. Trang tự cập nhật sau tối đa 10 giây khi đang hiển thị.</p>
        )}
        {!signedOut && !forbidden ? <button className="hub__refresh" type="button" disabled={refreshing} onClick={() => void load()}>{refreshing ? "Đang kiểm tra…" : "Kiểm tra lại"}</button> : null}
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
              {forbidden ? <p>Đăng nhập tài khoản sinh viên để chơi trò này.</p> : <Link className="hub__cta" href={meta.href}>{signedOut ? "Xem luật chơi" : label} →</Link>}
            </article>
          );
        })}
      </div>
      <div className="hub__links">
        <Link className="hub__link" href="/live-arena/bang-xep-hang"><Trophy aria-hidden size={16} /> Hai bảng xếp hạng trực tiếp</Link>
        {signedOut || forbidden ? null : <Link className="hub__link" href="/passport">Hồ sơ học tập</Link>}
        {signedOut || forbidden ? null : <Link className="hub__link" href="/live-arena/xem-lai">Xem lại lượt thi của bạn</Link>}
        <Link className="hub__link" href="/live-arena/dong-chay-lich-su">Luyện tập tự do: Dòng Chảy Lịch Sử (không tính điểm)</Link>
      </div>
    </div>
  );
}
