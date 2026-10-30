"use client";

import { Bomb, Flag, Flame, Gem, Keyboard, Lock, Shield, Timer, Trophy, Zap } from "lucide-react";
import Link from "next/link";

import type { Game, Lobby, PlayerStanding, Projection } from "@/features/arena/client/types";
import { CenterCard, STANDING_LABEL, StandingChip, formatClock } from "@/features/arena/ui/arena-ui";

const RULES: Record<Game, { title: string; tagline: string; bullets: Array<{ icon: React.ReactNode; text: string }> }> = {
  minefield: {
    title: "Bãi Mìn Tri Thức",
    tagline: "Mở ô bí ẩn, trả lời nhanh, gỡ bom và gom vật phẩm.",
    bullets: [
      { icon: <Flag aria-hidden size={18} />, text: "Bàn cờ 4 × 5: 10 câu hỏi, 3 bom, 1 x2, 2 khiên, 4 rương. Ô đầu tiên bạn mở không bao giờ là bom." },
      { icon: <Timer aria-hidden size={18} />, text: "Câu Dễ +100 (6 s), Trung bình +200 (8 s), Khó +300 (10 s). Sai hoặc hết giờ: 0 điểm." },
      { icon: <Bomb aria-hidden size={18} />, text: "Bom: câu A/B trong 5 s. Gỡ sai hoặc hết giờ sẽ mất một khiên, không có khiên thì −100 (không dưới 0)." },
      { icon: <Zap aria-hidden size={18} />, text: "x2 nhân đôi câu chính kế tiếp (sai vẫn mất x2). Rương +40. Giữ tối đa 2 khiên." },
    ],
  },
  race: {
    title: "Đường Đua Lịch Sử",
    tagline: "15 câu liên tiếp, tích combo, bứt tốc ở ba câu cuối.",
    bullets: [
      { icon: <Flag aria-hidden size={18} />, text: "5 câu Dễ (+100, 5 s) → 7 câu Trung bình (+150, 7 s) → 3 câu Khó nước rút (+200, 9 s)." },
      { icon: <Flame aria-hidden size={18} />, text: "Mỗi 3 câu đúng liên tiếp: combo +30. Sai hoặc hết giờ: chuỗi về 0." },
      { icon: <Timer aria-hidden size={18} />, text: "Câu tiếp theo tự đến sau mỗi câu. Không có vật phẩm hay may rủi." },
      { icon: <Trophy aria-hidden size={18} />, text: "Đường đua thể hiện tiến độ của chính bạn; bảng xếp hạng cập nhật sau mỗi câu." },
    ],
  },
};

export function GameIntro({ game, lobby, busy, notice, onStart }: { game: Game; lobby: Lobby | null; busy: boolean; notice: string | null; onStart: () => void }) {
  const rules = RULES[game];
  const info = lobby?.games.find((g) => g.game === game);
  const other = lobby?.games.find((g) => g.game !== game && g.state === "active");
  const closed = lobby?.competition?.state !== "open";
  return (
    <CenterCard>
      <p className="ax-kicker">{lobby?.competition ? lobby.competition.name : "Live Arena"}</p>
      <h1 className="ax-title">{rules.title}</h1>
      <p className="ax-lead">{rules.tagline}</p>
      <ul className="ax-rules">
        {rules.bullets.map((b) => (
          <li key={b.text}>{b.icon}<span>{b.text}</span></li>
        ))}
      </ul>
      <div className="ax-warning">
        <Lock aria-hidden size={18} />
        <span>
          Mỗi bạn chỉ có <strong>một lượt</strong> cho game này. Đồng hồ {info ? formatClock(info.durationMs) : ""} bắt đầu ngay khi bấm và <strong>không dừng</strong> khi mất mạng, tải lại trang hay đổi thiết bị.
          Đáp án đúng chỉ hiện sau khi cuộc thi kết thúc.
        </span>
      </div>
      <p className="ax-hint"><Keyboard aria-hidden size={14} /> Chơi được bằng bàn phím: phím mũi tên + Enter, A/B/C để trả lời.</p>
      {other || notice === "another_attempt_active" ? (
        <p className="ax-notice" role="alert">
          Bạn đang có lượt <strong>{other?.game === "race" ? "Đường Đua" : "Bãi Mìn"}</strong> chưa kết thúc. Hoàn thành lượt đó trước.{" "}
          <Link href={other?.game === "race" ? "/live-arena/duong-dua" : "/live-arena/bai-min"}>Tiếp tục lượt đó →</Link>
        </p>
      ) : notice ? (
        <p className="ax-notice" role="alert">{notice}</p>
      ) : null}
      <button type="button" className="ax-btn ax-btn--primary ax-btn--xl" onClick={onStart} disabled={busy || closed || Boolean(other)}>
        {closed ? "Đã đóng nhận lượt mới" : busy ? "Đang bắt đầu…" : "Bắt đầu lượt thi"}
      </button>
    </CenterCard>
  );
}

export function FinishedScreen({ game, projection, standing }: { game: Game; projection: Projection; standing: PlayerStanding | null }) {
  const a = projection.attempt;
  const timedOut = a.state === "timed_out";
  return (
    <CenterCard>
      <p className="ax-kicker">{RULES[game].title} · {STANDING_LABEL[projection.competition.standing]}</p>
      <h1 className="ax-title">{timedOut ? "Hết giờ!" : "Hoàn thành!"}</h1>
      <div className="ax-final">
        <div><span>Điểm</span><strong>{a.score.toLocaleString("vi-VN")}</strong></div>
        <div><span>Câu đúng</span><strong>{a.mainCorrect}/{a.mainTotal}</strong></div>
        <div><span>Thời gian</span><strong>{a.completionDurationMs !== null ? formatClock(a.completionDurationMs) : "—"}</strong></div>
      </div>
      <StandingChip standing={standing} />
      <p className="ax-lead">Đáp án và giải thích sẽ mở khi giảng viên kết thúc cuộc thi.</p>
      <div className="ax-row">
        <Link className="ax-btn ax-btn--ghost" href="/live-arena">Về sảnh</Link>
        <Link className="ax-btn ax-btn--primary" href="/live-arena/bang-xep-hang">Xem bảng xếp hạng</Link>
      </div>
    </CenterCard>
  );
}

export function StatusScreen({ phase, onRetry }: { phase: "loading" | "signed_out" | "no_competition" | "error"; onRetry: () => void }) {
  if (phase === "loading") {
    return <CenterCard><div className="ax-spinner" aria-label="Đang tải" /><p className="ax-lead">Đang đồng bộ với máy chủ…</p></CenterCard>;
  }
  if (phase === "signed_out") {
    return (
      <CenterCard>
        <h1 className="ax-title">Cần đăng nhập</h1>
        <p className="ax-lead">Đăng nhập bằng mã số sinh viên để vào thi.</p>
        <Link className="ax-btn ax-btn--primary" href="/dang-nhap">Đăng nhập</Link>
      </CenterCard>
    );
  }
  if (phase === "no_competition") {
    return (
      <CenterCard>
        <h1 className="ax-title">Chưa có cuộc thi đang mở</h1>
        <p className="ax-lead">Cuộc thi mở theo lịch của giảng viên. Trong lúc chờ, bạn có thể chơi luyện tập.</p>
        <div className="ax-row">
          <Link className="ax-btn ax-btn--ghost" href="/live-arena">Về sảnh</Link>
          <Link className="ax-btn ax-btn--primary" href="/live-arena/dong-chay-lich-su">Luyện tập</Link>
        </div>
      </CenterCard>
    );
  }
  return (
    <CenterCard>
      <h1 className="ax-title">Không tải được lượt thi</h1>
      <p className="ax-lead">Kiểm tra kết nối rồi thử lại. Lượt thi của bạn vẫn được giữ trên máy chủ.</p>
      <button type="button" className="ax-btn ax-btn--primary" onClick={onRetry}>Thử lại</button>
    </CenterCard>
  );
}

export const ITEM_ICON = {
  bomb: <Bomb aria-hidden />,
  shield: <Shield aria-hidden />,
  chest: <Gem aria-hidden />,
  double: <Zap aria-hidden />,
};
