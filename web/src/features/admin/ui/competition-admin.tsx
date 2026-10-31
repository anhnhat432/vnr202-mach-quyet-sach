"use client";

import { Activity, ExternalLink, FileClock, Play, RefreshCw, ShieldAlert, Square, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ArenaApiError, newKey, request } from "@/features/arena/client/api";
import type { Standing } from "@/features/arena/client/types";
import { STANDING_LABEL, formatClock } from "@/features/arena/ui/arena-ui";

type Competition = { id: string; publicId: string; name: string; kind: "official" | "rehearsal"; state: string; opensAt: string; startDeadlineAt: string; standing: Standing; attempts: number; active: number };
type Incident = { action: IncidentAction; reason: string; at: string };
type MonitorRow = { attemptId: string; profileId: string; accountStatus: string; incidents: Incident[]; game: "minefield" | "race"; state: string; studentId: string; displayName: string; score: number; mainAnswered: number; mainTotal: number; mainCorrect: number; remainingMs: number; completionDurationMs: number | null; heartbeatAgoMs: number | null; deviceTransfers: number; timeouts: number; pendingQuestion: boolean };
type AuditRow = { at: string; action: string; targetType: string; actor: string; after: { reason?: string } | null };
type Disclosed = { kind: string; competitionState: string; questions: Array<{ versionId: string; game: string; pool: string; difficulty: string; chapter: string; prompt: string; confirmed: boolean; disclosedBy: Array<{ competition: string; at: string }> | null }> };
type IncidentAction = "note" | "void_attempt" | "revoke_sessions" | "lock_account" | "unlock_account";
type Readiness = { ready: boolean; blockers: string[]; classSize: number | null; target: { meetsTarget: boolean; expectedAttempts: number; maxPerQuestion: number }; games: Record<string, { slots: Array<{ pool: string; difficulty: string; needed: number; available: number; expectedAllocationsPerQuestion: number | null }> }> };

const STATE_LABEL: Record<string, string> = { draft: "Nháp", scheduled: "Đã lên lịch", open: "Đang mở", start_closed: "Đóng nhận lượt", settling: "Chốt kết quả", finalized: "Đã kết thúc", archived: "Lưu trữ" };
const NEXT_ACTIONS: Record<string, Array<{ target: string; label: string }>> = {
  draft: [{ target: "scheduled", label: "Kiểm tra & lên lịch (chụp ngân hàng câu)" }],
  scheduled: [{ target: "open", label: "Mở cuộc thi" }],
  open: [{ target: "start_closed", label: "Đóng nhận lượt mới" }],
  start_closed: [{ target: "settling", label: "Chuyển sang chốt kết quả" }],
  settling: [{ target: "finalize", label: "Kết thúc & công bố (Finalized)" }],
  finalized: [{ target: "archived", label: "Lưu trữ" }],
};

const INCIDENT_LABEL: Record<IncidentAction, string> = {
  note: "Ghi chú sự cố",
  revoke_sessions: "Thu hồi mọi phiên đăng nhập",
  lock_account: "Khóa tài khoản",
  unlock_account: "Mở khóa tài khoản",
  void_attempt: "Vô hiệu lượt thi",
};
// Actions that change who can play or what the board shows need an explicit second confirmation.
const INCIDENT_WARNING: Partial<Record<IncidentAction, string>> = {
  void_attempt: "Lượt bị loại khỏi bảng xếp hạng. Điểm, lịch sử câu trả lời và sự cố vẫn được giữ; không thể hoàn tác và không tạo lượt thay thế.",
  lock_account: "Sinh viên bị đăng xuất khỏi mọi thiết bị và không đăng nhập được. Đồng hồ lượt đang chơi vẫn chạy.",
  revoke_sessions: "Sinh viên bị đăng xuất khỏi mọi thiết bị. Đồng hồ lượt đang chơi vẫn chạy.",
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
  const [form, setForm] = useState<{ name: string; minutes: number; kind: "rehearsal" | "official" }>({ name: "Diễn tập Live Arena", minutes: 60, kind: "rehearsal" });
  const [incidentFor, setIncidentFor] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [expectedAttempts, setExpectedAttempts] = useState(60);
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);
  const [bankReason, setBankReason] = useState("");

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
    request<Readiness>("GET", `/admin/competitions/${selected}/readiness?expectedAttempts=${expectedAttempts}`).then((r) => alive && setReadiness(r)).catch(() => undefined);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [selected, auditTick, expectedAttempts]);

  function incidentDone(text: string) {
    setIncidentFor(null);
    setMessage(text);
    setAuditTick((t) => t + 1);
    void load();
  }

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const c = await request<{ id: string }>("POST", "/admin/competitions", {
        body: { name: form.name, kind: form.kind, opensAt: new Date(Date.now() - 60_000).toISOString(), startDeadlineAt: new Date(Date.now() + form.minutes * 60_000).toISOString() },
        key: newKey("create"),
      });
      setSelected(c.id);
      await load();
      setMessage(form.kind === "official" ? "Đã tạo cuộc thi chính thức (Nháp)." : "Đã tạo cuộc thi diễn tập (Nháp).");
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
      else {
        const belowTarget = current.kind === "official" && target === "scheduled" && readiness && !readiness.target.meetsTarget;
        await request("POST", `/admin/competitions/${current.id}/transitions`, { body: { target, ...(target === "scheduled" ? { expectedAttempts } : {}), ...(belowTarget ? { bankAcknowledgement: { expectedAttempts, confirmed: acknowledgeRisk, reason: bankReason } } : {}) } });
      }
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
                <button type="button" aria-pressed={c.id === selected} onClick={() => { setSelected(c.id); setAcknowledgeRisk(false); setBankReason(""); setReadiness(null); }}>
                  <strong>{c.name}</strong>
                  <span>{c.kind === "rehearsal" ? "Diễn tập" : "Chính thức"} · {STATE_LABEL[c.state] ?? c.state} · {c.attempts} lượt ({c.active} đang chơi)</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="adm__create" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <h3>Tạo cuộc thi</h3>
          <label>Loại cuộc thi<select value={form.kind} onChange={(e) => { const kind = e.target.value as "rehearsal" | "official"; setForm({ ...form, kind, name: form.name === "Diễn tập Live Arena" || form.name === "Cuộc thi Live Arena" ? (kind === "official" ? "Cuộc thi Live Arena" : "Diễn tập Live Arena") : form.name }); }}><option value="rehearsal">Diễn tập</option><option value="official">Chính thức</option></select></label>
          <label>Tên<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={3} maxLength={120} required /></label>
          <label>Nhận lượt mới trong (phút)<input type="number" min={5} max={720} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} /></label>
          <p className="adm__hint">Diễn tập dùng câu giả lập [GIẢ LẬP]; không bao giờ có nhãn Chính thức. Cuộc thi chính thức chỉ lên lịch được khi đủ câu Published do người duyệt học thuật duyệt.</p>
          <p className="adm__hint adm__warn" role="note"><ShieldAlert aria-hidden size={14} /> Mật khẩu mặc định chung <b>không bảo đảm danh tính</b>: ai biết MSSV có thể đăng nhập thay. Chỉ dùng cho thi đua lớp học giá trị thấp, không dùng để tính điểm học phần hay trao giải giá trị cao (LA-ACC-006).</p>
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
            {current.state === "draft" && current.kind === "official" ? <label>Sĩ số dự kiến <input type="number" min={1} max={500} value={expectedAttempts} onChange={(e) => { setExpectedAttempts(Number(e.target.value)); setAcknowledgeRisk(false); setReadiness(null); }} /></label> : null}
            {readiness && current.state === "draft" ? <div className={`adm__ready ${readiness.ready ? "is-ok" : "is-bad"}`}>
              <p>{readiness.ready ? "Ngân hàng câu đủ điều kiện bắt buộc." : `Chưa đủ điều kiện: ${readiness.blockers.join(", ")}`}</p>
              {current.kind === "official" && readiness.classSize != null ? <p role={readiness.classSize !== readiness.target.expectedAttempts ? "alert" : undefined}>Danh sách lớp hiện có {readiness.classSize} sinh viên{readiness.classSize !== readiness.target.expectedAttempts ? `, khác sĩ số dự kiến ${readiness.target.expectedAttempts}. Hãy kiểm tra trước khi xác nhận.` : "."}</p> : null}
              {current.kind === "official" && !readiness.target.meetsTarget ? <>
                <p>Sĩ số dự kiến {readiness.target.expectedAttempts}: chưa đạt mục tiêu tối đa {readiness.target.maxPerQuestion} lượt phân bổ mỗi câu. Một câu có thể được nhiều sinh viên nhận, tăng rủi ro chia sẻ đáp án.</p>
                <p>Tổng còn thiếu {Object.values(readiness.games).flatMap((game) => game.slots).reduce((sum, slot) => sum + Math.max(0, Math.ceil(readiness.target.expectedAttempts * slot.needed / readiness.target.maxPerQuestion) - slot.available), 0)} câu theo cơ cấu mục tiêu.</p>
                <ul>{Object.entries(readiness.games).flatMap(([game, info]) => info.slots.map((slot) => {
                  const missing = Math.max(0, Math.ceil(readiness.target.expectedAttempts * slot.needed / readiness.target.maxPerQuestion) - slot.available);
                  return missing ? <li key={`${game}-${slot.pool}-${slot.difficulty}`}>{game} · {slot.pool} · {slot.difficulty}: thiếu {missing} câu so với mục tiêu; dự kiến {slot.expectedAllocationsPerQuestion ?? "—"} lượt/câu.</li> : null;
                }))}</ul>
                {readiness.ready ? <><label><input type="checkbox" checked={acknowledgeRisk} onChange={(e) => setAcknowledgeRisk(e.target.checked)} /> Tôi đã xem và chấp nhận rủi ro phân bổ lặp.</label><label>Lý do xác nhận <textarea value={bankReason} minLength={3} maxLength={300} onChange={(e) => setBankReason(e.target.value)} /></label></> : null}
              </> : null}
            </div> : null}
            <div className="adm__actions">
              {(NEXT_ACTIONS[current.state] ?? []).map((a) => (
                <button key={a.target} type="button" disabled={busy || (a.target === "scheduled" && current.kind === "official" && (!readiness || !readiness.ready || (!readiness.target.meetsTarget && (!acknowledgeRisk || bankReason.trim().length < 3))))} onClick={() => void act(a.target)}>
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
                    <thead><tr><th>MSSV</th><th>Tên hiển thị</th><th>Trạng thái</th><th>Tiến độ</th><th>Điểm</th><th>Thời gian</th><th>Kết nối</th><th>Ghi nhận</th><th>Sự cố</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
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
                          <td>
                            {m.accountStatus === "locked" ? <span className="adm__tag is-bad">TK bị khóa</span> : null}
                            {m.incidents.length ? <span title={m.incidents.map((i) => `${INCIDENT_LABEL[i.action]}: ${i.reason}`).join("\n")}>{m.incidents.length} ghi nhận · {INCIDENT_LABEL[m.incidents.at(-1)!.action]}</span> : m.accountStatus === "locked" ? null : "—"}
                          </td>
                          <td><button type="button" className="adm__small" aria-expanded={incidentFor === m.attemptId} onClick={() => setIncidentFor(incidentFor === m.attemptId ? null : m.attemptId)}>Xử lý</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            {incidentFor && monitor.find((m) => m.attemptId === incidentFor) ? (
              <IncidentPanel key={incidentFor} row={monitor.find((m) => m.attemptId === incidentFor)!} onDone={incidentDone} onClose={() => setIncidentFor(null)} />
            ) : null}
            {current.kind === "official" ? <DisclosedQuestions key={current.id} competitionId={current.id} onDone={incidentDone} /> : null}
            <AuditLog competitionId={current.id} refresh={auditTick} />
          </>
        ) : <p>Chọn hoặc tạo một cuộc thi.</p>}
      </section>
    </div>
  );
}

function IncidentPanel({ row, onDone, onClose }: { row: MonitorRow; onDone: (text: string) => void; onClose: () => void }) {
  const [action, setAction] = useState<IncidentAction>("note");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warning = INCIDENT_WARNING[action];
  const actions = (Object.keys(INCIDENT_LABEL) as IncidentAction[]).filter((a) =>
    a === "lock_account" ? row.accountStatus !== "locked" : a === "unlock_account" ? row.accountStatus === "locked" : a === "void_attempt" ? row.state !== "voided" : true);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await request("POST", `/admin/attempts/${row.attemptId}/incidents`, { body: { action, reason } });
      onDone(`${INCIDENT_LABEL[action]}: ${row.displayName}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="adm__incident" aria-label={`Xử lý sự cố: ${row.displayName}`} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <h3><ShieldAlert aria-hidden size={16} /> Xử lý sự cố · {row.studentId} · {row.displayName}</h3>
      <p className="adm__hint">Không thể sửa điểm, sửa đồng hồ, tạo lượt thay thế hay xóa lịch sử. Mọi thao tác được ghi nhật ký kèm lý do.</p>
      <fieldset>
        <legend>Thao tác</legend>
        {actions.map((a) => (
          <label key={a} className="adm__radio">
            <input type="radio" name="incident-action" value={a} checked={action === a} onChange={() => { setAction(a); setAck(false); }} /> {INCIDENT_LABEL[a]}
          </label>
        ))}
      </fieldset>
      <label>Lý do (bắt buộc)<textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required rows={2} /></label>
      {warning ? (
        <label className="adm__confirm">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> <span><b>Xác nhận:</b> {warning}</span>
        </label>
      ) : null}
      {error ? <p className="adm__message is-bad" role="alert">{error}</p> : null}
      <div className="adm__actions">
        <button type="submit" disabled={busy || reason.trim().length < 3 || (Boolean(warning) && !ack)} className={action === "void_attempt" || action === "lock_account" ? "is-danger" : ""}>
          {busy ? "Đang ghi…" : INCIDENT_LABEL[action]}
        </button>
        <button type="button" className="is-ghost" onClick={onClose}>Đóng</button>
      </div>
    </form>
  );
}

function AuditLog({ competitionId, refresh }: { competitionId: string; refresh: number }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    request<AuditRow[]>("GET", `/admin/competitions/${competitionId}/audit`).then((r) => alive && setRows(r)).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [competitionId, refresh]);
  return (
    <details className="adm__audit">
      <summary><FileClock aria-hidden size={16} /> Nhật ký thao tác {rows ? `(${rows.length})` : ""}</summary>
      {rows && rows.length ? (
        <ol>
          {rows.map((r, i) => (
            <li key={`${r.at}-${i}`}>
              <time dateTime={r.at}>{new Date(r.at).toLocaleString("vi-VN")}</time> · <b>{r.actor}</b> · <code>{r.action}</code>
              {r.after?.reason ? <> · {r.after.reason}</> : null}
            </li>
          ))}
        </ol>
      ) : <p>Chưa có thao tác nào.</p>}
    </details>
  );
}

// LA-CONTENT-009: a disclosed question stays excluded from an official competition unless the admin ticks it
// here, gives a reason, and confirms while the competition is still a Draft. Nothing is pre-selected.
function DisclosedQuestions({ competitionId, onDone }: { competitionId: string; onDone: (text: string) => void }) {
  const [data, setData] = useState<Disclosed | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    request<Disclosed>("GET", `/admin/competitions/${competitionId}/disclosed-questions`).then((d) => alive && setData(d)).catch((e) => alive && setError(errorText(e)));
    return () => { alive = false; };
  }, [competitionId, version]);
  if (!data) return error ? <p className="adm__message is-bad">{error}</p> : null;
  const editable = data.competitionState === "draft";
  async function confirm() {
    if (!window.confirm(`Cho phép dùng lại ${picked.length} câu đã công bố đáp án trong cuộc thi chính thức này? Thao tác được ghi nhật ký.`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await request<{ confirmed: number }>("POST", `/admin/competitions/${competitionId}/disclosed-question-confirmations`, { body: { questionVersionIds: picked, reason } });
      setPicked([]);
      setReason("");
      setVersion((v) => v + 1);
      onDone(`Đã xác nhận dùng lại ${r.confirmed} câu đã công bố.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="adm__disclosed" aria-labelledby="disclosed-title">
      <h3 id="disclosed-title">Câu đã công bố đáp án ({data.questions.length})</h3>
      <p className="adm__hint">Mặc định các câu này bị loại khỏi cuộc thi chính thức. Chỉ chọn khi thật cần, kèm lý do; {editable ? "chỉ làm được khi cuộc thi còn Nháp." : "cuộc thi đã qua Nháp nên không thể thay đổi."}</p>
      {data.questions.length === 0 ? <p>Không có câu nào đã công bố đáp án trong nguồn câu của cuộc thi này.</p> : (
        <ul className="adm__qlist">
          {data.questions.map((q) => (
            <li key={q.versionId}>
              <label>
                <input type="checkbox" disabled={!editable || q.confirmed} checked={q.confirmed || picked.includes(q.versionId)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, q.versionId] : p.filter((x) => x !== q.versionId)))} />
                <span>
                  <b>{q.game === "race" ? "Đường Đua" : "Bãi Mìn"} · {q.pool} · {q.difficulty} · {q.chapter}</b>{q.confirmed ? " · đã xác nhận" : ""}<br />
                  {q.prompt}<br />
                  <small>Đã công bố ở: {(q.disclosedBy ?? []).map((d) => `${d.competition} (${new Date(d.at).toLocaleDateString("vi-VN")})`).join(", ")}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {editable && data.questions.length ? (
        <form onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
          <label>Lý do dùng lại (bắt buộc)<textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} rows={2} required /></label>
          {error ? <p className="adm__message is-bad" role="alert">{error}</p> : null}
          <button type="submit" disabled={busy || picked.length === 0 || reason.trim().length < 3}>Xác nhận dùng lại {picked.length} câu</button>
        </form>
      ) : null}
    </section>
  );
}
