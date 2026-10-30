"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArenaApiError, request } from "@/features/arena/client/api";
import { groupOfficialAttempts } from "./attempts";
import type { DossierSummary } from "@/features/content/contracts/dossier";
import "./passport.css";

type Profile = { role: string; fullName?: string; displayName?: string; studentId?: string; className?: string | null };
type Attempt = { attemptId: string; game: "minefield" | "race"; state: string; score: number; mainCorrect: number; hardCorrect: number; mainTotal: number; completionDurationMs: number | null; rank: number | null; competition: { id: string; name: string; kind: string; standing: string }; reviewAvailable: boolean };
type ProgressRow = { dossier_id: string; completed_at: string | null; state: { stage: string } };

export function Passport({ dossiers }: { dossiers: DossierSummary[] }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [progress, setProgress] = useState<ProgressRow[] | null>(null);
  const [error, setError] = useState<"login" | "failed" | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([request<Profile>("GET", "/me"), request<Attempt[]>("GET", "/arena/me/attempts"), request<ProgressRow[]>("GET", "/passport/progress")])
      .then(([p, a, rows]) => { if (active) { setProfile(p); setAttempts(a); setProgress(rows); } })
      .catch((e: unknown) => { if (active) setError(e instanceof ArenaApiError && e.status === 401 ? "login" : "failed"); });
    return () => { active = false; };
  }, []);

  if (error === "login") return <p>Hãy <Link href="/dang-nhap">đăng nhập</Link> để xem hồ sơ của bạn.</p>;
  if (error) return <p>Không tải được hồ sơ. Hãy thử tải lại trang.</p>;
  if (!profile || !attempts || !progress) return <p>Đang tải hồ sơ…</p>;
  return <div className="passport">
    <section className="passport__panel">
      <h2>Thông tin của bạn</h2>
      <p>Họ tên: <strong>{profile.fullName ?? "Chưa có thông tin"}</strong></p>
      <p>MSSV: {profile.studentId ?? "Chưa có thông tin"}</p>
      <p>Tên hiển thị lớp: {profile.displayName ?? "Chưa có thông tin"}</p>
      <p>Lớp: {profile.className ?? "Chưa có thông tin"}</p>
    </section>
    <section className="passport__panel">
      <h2>Tiến độ hồ sơ</h2>
      <p>Tiến độ được lưu theo tài khoản và không ảnh hưởng điểm thi.</p>
      <div className="passport__chapters">{["chapter_1", "chapter_2", "chapter_3"].map((chapter, index) => <div key={chapter}>
        <h3>Chương {index + 1}</h3>
        <ul>{dossiers.filter((d) => d.chapter === chapter).map((d) => {
          const row = progress.find((item) => item.dossier_id === d.id);
          const available = d.status === "published";
          return <li key={d.id}>{available ? <Link className="text-link" href={`/ho-so/${d.slug}`}>{d.title}</Link> : d.title} · {!available ? "Chưa sẵn sàng" : row?.completed_at ? "Đã hoàn thành" : row ? "Đang học" : "Chưa bắt đầu"}</li>;
        })}</ul>
      </div>)}</div>
    </section>
    <section className="passport__panel">
      <h2>Kết quả cuộc thi chính thức</h2>
      <p>Kết quả diễn tập và lượt vô hiệu không được tính vào thành tích chính thức.</p>
      {groupOfficialAttempts(attempts).length === 0 ? <p>Chưa có lượt thi chính thức.</p> : null}
      {groupOfficialAttempts(attempts).map((group) => <div key={group.competition.id} className="passport__competition">
        <h3>{group.competition.name} · {group.competition.standing === "official" ? "Chính thức" : "Tạm thời"}</h3>
      <div className="passport__games">{([['minefield', 'Bãi Mìn Tri Thức'], ['race', 'Đường Đua Lịch Sử']] as const).map(([game, label]) => {
        const result = group.attempts.find((attempt) => attempt.game === game);
        const voided = attempts.some((attempt) => attempt.competition.id === group.competition.id && attempt.game === game && attempt.state === "voided");
        return <article key={game}>
          <h3>{label}</h3>
          {!result ? <p>{voided ? "Lượt đã bị vô hiệu, không tính vào thành tích." : "Chưa bắt đầu."}</p> : <>
            <p>{result.state === "active" ? "Đang chơi" : result.state === "timed_out" ? "Hết giờ" : "Đã hoàn thành"} · {result.score} điểm</p>
            <p>{result.rank != null ? `Hạng ${result.rank}` : "Chưa có thứ hạng"} · {result.mainCorrect}/{result.mainTotal} câu đúng · {result.hardCorrect} câu khó đúng{result.completionDurationMs != null ? ` · ${Math.floor(result.completionDurationMs / 1000)} giây` : ""}</p>
            {result.state === "active" ? <Link className="text-link" href={game === "minefield" ? "/live-arena/bai-min" : "/live-arena/duong-dua"}>Tiếp tục lượt chơi</Link> : null}
            {result.reviewAvailable ? <Link className="text-link" href="/live-arena/xem-lai">Xem lại đáp án</Link> : null}
          </>}
        </article>;
      })}</div></div>)}
    </section>
  </div>;
}
