"use client";

import { Activity, ExternalLink, Play, RefreshCw, Square, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ArenaApiError, newKey, request } from "@/features/arena/client/api";
import type { Standing } from "@/features/arena/client/types";
import { STANDING_LABEL, formatClock } from "@/features/arena/ui/arena-ui";

type Competition = { id: string; publicId: string; name: string; kind: "official" | "rehearsal"; state: string; opensAt: string; startDeadlineAt: string; standing: Standing; attempts: number; active: number };
type MonitorRow = { attemptId: string; game: "minefield" | "race"; state: string; studentId: string; displayName: string; score: number; mainAnswered: number; mainTotal: number; mainCorrect: number; remainingMs: number; completionDurationMs: number | null; heartbeatAgoMs: number | null; deviceTransfers: number; timeouts: number; pendingQuestion: boolean };
type Readiness = { ready: boolean; blockers: string[]; target: { meetsTarget: boolean } };

const STATE_LABEL: Record<string, string> = { draft: "Nháp", scheduled: "Đã lên lịch", open: "Đang mở", start_closed: "Đóng nhận lượt", settling: "Chốt kết quả", finalized: "Đã kết thúc", archived: "Lưu trữ" };
const NEXT_ACTIONS: Record<string, Array<{ target: string; label: string }>> = {
  draft: [{ target: "scheduled", label: "Kiểm tra & lên lịch (chụp ngân hàng câu)" }],
  scheduled: [{ target: "open", label: "Mở cuộc thi" }],
  open: [{ target: "start_closed", label: "Đóng nhận lượt mới" }],
  start_closed: [{ target: "settling", label: "Chuyển sang chốt kết quả" }],
  settling: [{ target: "finalize", label: "Kết thúc & công bố (Finalized)" }],
  finalized: [{ target: "archived", label: "Lưu trữ" }],
};

function errorText(error: unknown) {
  if (error instanceof ArenaApiError) return `${error.message} (${error.code})`;
  return "Đã xảy ra lỗi.";
}

// Competition control room: create a rehearsal, walk it through its states, watch every attempt live.
// The admin never edits a score, a clock or an attempt (LA-ADMIN-002); no new or replacement attempts.
export function CompetitionAdmin() {
  const [list, setList] = useState<Competition[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<MonitorRow[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "Diễn tập Live Arena", minutes: 60 });

  const load = useCallback(async () => {
    try {
      const l = await request<Competition[]>("GET", "/admin/competitions");
      setList(l);
      setSelected((s) => s ?? l.find((c) => c.state === "open")?.id ?? l[0]?.id ?? null);
    } catch (e) {
      setMessage(errorText(e));
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const current = list?.find((c) => c.id === selected) ?? null;

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const pull = async () => {
      try {
        const m = await request<{ attempts: MonitorRow[] }>("GET", `/admin/competitions/${selected}/monitor`);
        if (alive) setMonitor(m.attempts);
      } catch {
        /* keep the last view */
      }
    };
    const first = window.setTimeout(() => void pull(), 0);
    const timer = window.setInterval(() => void pull(), 4000);
    request<Readiness>("GET", `/admin/competitions/${selected}/readiness`).then((r) => alive && setReadiness(r)).catch(() => undefined);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [selected]);

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const c = await request<{ id: string }>("POST", "/admin/competitions", {
        body: { name: form.name, kind: "rehearsal", opensAt: new Date(Date.now() - 60_000).toISOString(), startDeadlineAt: new Date(Date.now() + form.minutes * 60_000).toISOString() },
        key: newKey("create"),
      });
      setSelected(c.id);
      await load();
      setMessage("Đã tạo cuộc thi diễn tập (Nháp).");
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function act(target: string) {
    if (!current) return;
    if (target === "finalize" && !window.confirm("Kết thúc cuộc thi? Đáp án sẽ mở cho người đã chơi và bảng được gắn nhãn chính thức (với cuộc thi chính thức).")) return;
    setBusy(true);
    setMessage(null);
    try {
      if (target === "finalize") await request("POST", `/admin/competitions/${current.id}/finalize`);
      else await request("POST", `/admin/competitions/${current.id}/transitions`, { body: { target } });
      await load();
      setMessage(`Đã chuyển: ${STATE_LABEL[target === "finalize" ? "finalized" : target]}.`);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function reconcile() {
    if (!current) return;
    setBusy(true);
    try {
      const r = await request<{ reconciled: number; activeAttempts: number; startClosed: boolean }>("POST", `/admin/competitions/${current.id}/reconcile`);
      setMessage(`Đã đối soát ${r.reconciled} lượt; còn ${r.activeAttempts} lượt đang chơi${r.startClosed ? "; đã tự đóng nhận lượt mới" : ""}.`);
      await load();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const byGame = (game: "minefield" | "race") => monitor.filter((m) => m.game === game);
  return (
    <div className="adm">
      <section className="adm__panel">
        <h2>Cuộc thi</h2>
        {list === null ? <p>Đang tải…</p> : list.length === 0 ? <p>Chưa có cuộc thi nào.</p> : (
          <ul className="adm__list">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={c.id === selected} onClick={() => setSelected(c.id)}>
                  <strong>{c.name}</strong>
                  <span>{c.kind === "rehearsal" ? "Diễn tập" : "Chính thức"} · {STATE_LABEL[c.state] ?? c.state} · {c.attempts} lượt ({c.active} đang chơi)</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="adm__create" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <h3>Tạo cuộc thi diễn tập</h3>
          <label>Tên<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={3} maxLength={120} required /></label>
          <label>Nhận lượt mới trong (phút)<input type="number" min={5} max={720} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} /></label>
          <p className="adm__hint">Diễn tập dùng câu giả lập [GIẢ LẬP]; không bao giờ có nhãn Chính thức. Cuộc thi chính thức chỉ lên lịch được khi đủ câu Published do người duyệt học thuật duyệt.</p>
          <button type="submit" disabled={busy}>Tạo (Nháp)</button>
        </form>
      </section>

      <section className="adm__panel adm__panel--wide">
        {current ? (
          <>
            <header className="adm__head">
              <div>
                <h2>{current.name}</h2>
                <p>{STATE_LABEL[current.state]} · nhãn bảng: <b>{STANDING_LABEL[current.standing]}</b> · nhận lượt tới {new Date(current.startDeadlineAt).toLocaleString("vi-VN")}</p>
              </div>
              <div className="adm__links">
                <Link href="/trinh-chieu" target="_blank"><Trophy aria-hidden size={16} /> Trình chiếu <ExternalLink aria-hidden size={12} /></Link>
                <Link href="/live-arena/bang-xep-hang" target="_blank">Bảng xếp hạng <ExternalLink aria-hidden size={12} /></Link>
              </div>
            </header>
            {readiness && current.state === "draft" ? (
              <p className={`adm__ready ${readiness.ready ? "is-ok" : "is-bad"}`}>
                {readiness.ready ? "Ngân hàng câu đủ điều kiện." : `Chưa đủ điều kiện: ${readiness.blockers.join(", ")}`}
                {readiness.target && !readiness.target.meetsTarget ? " · Chưa đạt mục tiêu 168 câu (chỉ cảnh báo)." : ""}
              </p>
            ) : null}
            <div className="adm__actions">
              {(NEXT_ACTIONS[current.state] ?? []).map((a) => (
                <button key={a.target} type="button" disabled={busy} onClick={() => void act(a.target)}>
                  {a.target === "open" ? <Play aria-hidden size={16} /> : a.target === "start_closed" ? <Square aria-hidden size={16} /> : null} {a.label}
                </button>
              ))}
              <button type="button" className="is-ghost" disabled={busy} onClick={() => void reconcile()}><RefreshCw aria-hidden size={16} /> Đối soát các lượt</button>
            </div>
            {message ? <p className="adm__message" role="status">{message}</p> : null}
            <div className="adm__monitor">
              {(["minefield", "race"] as const).map((game) => (
                <div key={game}>
                  <h3><Activity aria-hidden size={16} /> {game === "minefield" ? "Bãi Mìn Tri Thức" : "Đường Đua Lịch Sử"} · {byGame(game).length} lượt</h3>
                  <table>
                    <thead><tr><th>MSSV</th><th>Tên hiển thị</th><th>Trạng thái</th><th>Tiến độ</th><th>Điểm</th><th>Thời gian</th><th>Kết nối</th><th>Sự cố</th></tr></thead>
                    <tbody>
                      {byGame(game).map((m) => (
                        <tr key={m.attemptId}>
                          <td>{m.studentId}</td>
                          <td>{m.displayName}</td>
                          <td>{m.state === "active" ? "Đang chơi" : m.state === "completed" ? "Hoàn thành" : m.state === "timed_out" ? "Hết giờ" : "Vô hiệu"}</td>
                          <td>{m.mainAnswered}/{m.mainTotal} ({m.mainCorrect} đúng)</td>
                          <td><b>{m.score}</b></td>
                          <td>{m.state === "active" ? `còn ${formatClock(m.remainingMs)}` : m.completionDurationMs !== null ? formatClock(m.completionDurationMs) : "—"}</td>
                          <td>{m.state !== "active" ? "—" : m.heartbeatAgoMs === null ? "chưa có" : m.heartbeatAgoMs < 12000 ? "tốt" : `mất ${Math.round(m.heartbeatAgoMs / 1000)} s`}</td>
                          <td>{[m.deviceTransfers ? `${m.deviceTransfers} lần đổi thiết bị` : null, m.timeouts ? `${m.timeouts} câu hết giờ` : null].filter(Boolean).join(" · ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        ) : <p>Chọn hoặc tạo một cuộc thi.</p>}
      </section>
    </div>
  );
}
