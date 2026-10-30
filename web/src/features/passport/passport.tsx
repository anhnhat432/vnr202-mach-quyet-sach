"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArenaApiError, request } from "@/features/arena/client/api";
import { officialAttempts } from "./attempts";

type Profile = { role: string; fullName?: string; displayName?: string; studentId?: string };
type Attempt = { attemptId: string; game: "minefield" | "race"; state: string; score: number; competition: { name: string; kind: string; standing: string }; reviewAvailable: boolean };

export function Passport() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<"login" | "failed" | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([request<Profile>("GET", "/me"), request<Attempt[]>("GET", "/arena/me/attempts")])
      .then(([p, a]) => { if (active) { setProfile(p); setAttempts(officialAttempts(a)); } })
      .catch((e: unknown) => { if (active) setError(e instanceof ArenaApiError && e.status === 401 ? "login" : "failed"); });
    return () => { active = false; };
  }, []);

  if (error === "login") return <p>Hãy <Link href="/dang-nhap">đăng nhập</Link> để xem hồ sơ của bạn.</p>;
  if (error) return <p>Không tải được hồ sơ. Hãy thử tải lại trang.</p>;
  if (!profile || !attempts) return <p>Đang tải hồ sơ…</p>;
  return <div>
    <section className="scenario-panel">
      <h2>Thông tin của bạn</h2>
      <p>Họ tên: <strong>{profile.fullName ?? "Chưa có thông tin"}</strong></p>
      <p>MSSV: {profile.studentId ?? "Chưa có thông tin"}</p>
      <p>Tên hiển thị lớp: {profile.displayName ?? "Chưa có thông tin"}</p>
    </section>
    <section className="scenario-panel">
      <h2>Tiến độ hồ sơ</h2>
      <p>Chưa đồng bộ tiến độ học tập vào tài khoản. Bạn có thể tiếp tục hồ sơ trên thiết bị đã học.</p>
      <Link className="text-link" href="/ho-so">Mở Kho Hồ sơ</Link>
    </section>
    <section className="scenario-panel">
      <h2>Kết quả cuộc thi chính thức</h2>
      <p>Hiển thị lượt thi chính thức gần nhất của mỗi game. Kết quả diễn tập không được tính vào thành tích chính thức.</p>
      {([['minefield', 'Bãi Mìn Tri Thức'], ['race', 'Đường Đua Lịch Sử']] as const).map(([game, label]) => {
        const result = attempts.find((attempt) => attempt.game === game);
        return <article key={game}>
          <h3>{label}</h3>
          {!result ? <p>Chưa có lượt thi chính thức.</p> : <>
            <p>{result.competition.name} · {result.competition.standing === "official" ? "Chính thức" : "Tạm thời"}</p>
            <p>{result.state === "active" ? "Đang chơi" : result.state === "timed_out" ? "Hết giờ" : "Đã hoàn thành"} · {result.score} điểm</p>
            {result.state === "active" ? <Link className="text-link" href={game === "minefield" ? "/live-arena/bai-min" : "/live-arena/duong-dua"}>Tiếp tục lượt chơi</Link> : null}
            {result.reviewAvailable ? <Link className="text-link" href="/live-arena/xem-lai">Xem lại đáp án</Link> : null}
          </>}
        </article>;
      })}
    </section>
  </div>;
}
