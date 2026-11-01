"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { readCsrfCookie } from "@/lib/security/csrf-client";

export type RehearsalAccount = {
  id: string;
  studentId: string;
  fullName: string;
  displayName: string;
  status: string;
  updatedAt: string;
};

export type RehearsalCompetitionSummary = {
  id: string;
  publicId: string;
  name: string;
  kind: "official" | "rehearsal";
  state: string;
  standing: string;
  opensAt: string;
  startDeadlineAt: string;
  finalizedAt: string | null;
  attempts: number;
  active: number;
  completed?: number;
  participants?: number;
};

type LeaderboardEntry = {
  rank: number;
  entryId: string;
  displayName: string;
  score: number;
  correctCount: number;
  hardCorrect: number;
  completionDurationMs: number | null;
  progress: number;
  state: string;
};

type LeaderboardSnapshot = {
  totalParticipants?: number;
  entries?: LeaderboardEntry[];
};

export type RehearsalStudioState = {
  fixtureCount: number;
  fixturesReady: boolean;
  officialOpen: boolean;
  activeRehearsal: RehearsalCompetitionSummary | null;
  rehearsalHistory: RehearsalCompetitionSummary[];
  accounts: RehearsalAccount[];
  leaderboards: {
    minefield: LeaderboardSnapshot | null;
    race: LeaderboardSnapshot | null;
  } | null;
};

const STATE_LABELS: Record<string, string> = {
  draft: "Nháp",
  scheduled: "Đã chuẩn bị",
  open: "Đang mở nhận lượt",
  start_closed: "Đã đóng nhận lượt",
  settling: "Đang chốt lượt",
  finalized: "Đã công bố",
  archived: "Lưu trữ",
};

export function RehearsalStudio({
  onCompetitionChanged,
}: {
  onCompetitionChanged?: () => void;
}) {
  const [data, setData] = useState<RehearsalStudioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [accountCount, setAccountCount] = useState(6);
  const [roundName, setRoundName] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(180);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "teal" | "amber" | "red"; text: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadStudio = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/rehearsal", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as {
        data?: RehearsalStudioState;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.data) {
        setFeedback({ tone: "red", text: body?.error?.message ?? "Không tải được trạng thái phòng thi thử." });
        return;
      }
      setData(body.data);
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch {
      setFeedback({ tone: "red", text: "Mất kết nối tới máy chủ khi tải phòng thi thử." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void loadStudio(), 0);
    const timer = setInterval(() => void loadStudio(), 6000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [loadStudio]);

  async function handleProvisionAccounts() {
    setBusyAction("accounts");
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/rehearsal/accounts", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfCookie() },
        body: JSON.stringify({ count: accountCount }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { accounts: RehearsalAccount[]; createdCount: number; refreshedCount: number };
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.data) {
        setFeedback({ tone: "red", text: body?.error?.message ?? "Không tạo được tài khoản thử." });
        return;
      }
      setFeedback({
        tone: "teal",
        text: `Đã chuẩn bị ${body.data.accounts.length} tài khoản thử (${body.data.createdCount} tạo mới · ${body.data.refreshedCount} làm mới mật khẩu mặc định).`,
      });
      await loadStudio();
    } catch {
      setFeedback({ tone: "red", text: "Lỗi kết nối khi tạo tài khoản thử." });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenOrResetRound() {
    setBusyAction("round");
    setConfirmResetOpen(false);
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/rehearsal/rounds", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfCookie() },
        body: JSON.stringify({
          action: "open_or_reset",
          name: roundName.trim() || undefined,
          startWindowMinutes: windowMinutes,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { name?: string; publicId?: string; closedRehearsalIds?: string[] };
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.data) {
        setFeedback({ tone: "red", text: body?.error?.message ?? "Không mở được vòng thi thử." });
        return;
      }
      const closedCount = body.data.closedRehearsalIds?.length ?? 0;
      setRoundName("");
      setFeedback({
        tone: "teal",
        text:
          closedCount > 0
            ? `Đã đóng vòng thử cũ (bảo toàn lịch sử điểm & audit) và mở vòng mới "${body.data.name}" với bảng xếp hạng trống!`
            : `Đã mở buổi thi thử "${body.data.name}"! Sẵn sàng đăng nhập và chơi thử cả 2 game.`,
      });
      await loadStudio();
      onCompetitionChanged?.();
    } catch {
      setFeedback({ tone: "red", text: "Lỗi kết nối khi mở vòng thi thử." });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCloseRehearsal() {
    setBusyAction("close");
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/admin/rehearsal/rounds", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfCookie() },
        body: JSON.stringify({ action: "close" }),
      });
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setFeedback({ tone: "red", text: body?.error?.message ?? "Không đóng được phòng thi thử." });
        return;
      }
      setFeedback({ tone: "amber", text: "Đã đóng nhận lượt cho buổi thi thử hiện tại." });
      await loadStudio();
      onCompetitionChanged?.();
    } catch {
      setFeedback({ tone: "red", text: "Lỗi kết nối khi đóng phòng thi thử." });
    } finally {
      setBusyAction(null);
    }
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedToken(key);
      setTimeout(() => setCopiedToken((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      setFeedback({ tone: "amber", text: `Hãy sao chép thủ công: ${value}` });
    }
  }

  const active = data?.activeRehearsal ?? null;
  const isRehearsalOpen = active?.state === "open";
  const hasPlayedInActive = (active?.attempts ?? 0) > 0;
  const accounts = data?.accounts ?? [];

  const credentialSummaryText = accounts.length
    ? [
        `=== THÔNG TIN ĐĂNG NHẬP PHÒNG THI THỬ VNR202 ===`,
        `Trang đăng nhập: ${typeof window !== "undefined" ? window.location.origin : ""}/dang-nhap`,
        `Mật khẩu chung: Dùng mật khẩu mặc định của lớp (ROSTER_DEFAULT_PASSWORD trên server)`,
        `Danh sách MSSV thử nghiệm (${accounts.length} tài khoản):`,
        ...accounts.map((a) => `- ${a.studentId} (${a.displayName})`),
      ].join("\n")
    : "";

  return (
    <section aria-label="Phòng thi thử khép kín">
      {/* Safety Isolation Banner */}
      <div className="acc-banner" data-tone="teal">
        <div>
          <strong>Chế độ Cách ly An toàn (Sandbox Isolation):</strong> Phòng thi thử chỉ lấy bộ 87 câu{" "}
          <code>[GIẢ LẬP]</code>, tách biệt hoàn toàn với câu hỏi <code>Published</code> chính thức. Tài khoản thử (
          <code>THU001...</code>) bị chặn khỏi cuộc thi chính thức và không làm tăng sĩ số lớp.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="acc-badge" data-tone={data?.fixturesReady ? "teal" : "amber"}>
            Bộ đề giả lập: {data?.fixtureCount ?? 0}/87 câu
          </span>
          {lastUpdated && <span className="acc-badge">Cập nhật: {lastUpdated}</span>}
        </div>
      </div>

      {data?.officialOpen && (
        <div className="acc-banner" data-tone="red" role="alert">
          <strong>Đang có cuộc thi chính thức mở!</strong> Hệ thống tạm khóa thao tác mở/đặt lại phòng thi thử để bảo vệ
          tuyệt đối buổi thi thật của lớp.
        </div>
      )}

      {feedback && (
        <div className="acc-banner" data-tone={feedback.tone} role="status">
          <span>{feedback.text}</span>
          <button type="button" className="acc-btn" onClick={() => setFeedback(null)}>
            Đóng
          </button>
        </div>
      )}

      {/* 3-Step Self-Service Workflow */}
      <div className="acc-rehearsal-steps">
        {/* STEP 1: Create / Open / Reset Rehearsal */}
        <article className="acc-panel" style={{ marginBottom: 0 }}>
          <div className="acc-panel-header">
            <h3 className="acc-panel-title">
              <span className="acc-step-number">1</span>
              Buổi thi thử & Vòng chơi
            </h3>
            {active ? (
              <span className="acc-badge" data-tone={isRehearsalOpen ? "teal" : "amber"}>
                {STATE_LABELS[active.state] ?? active.state}
              </span>
            ) : (
              <span className="acc-badge">Chưa mở</span>
            )}
          </div>

          {active ? (
            <div className="acc-panel-alt" style={{ marginBottom: "0.85rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>{active.name}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--acc-muted)", marginBottom: "0.5rem" }}>
                Mã công khai: <code>{active.publicId.slice(0, 8)}</code> · Nhận lượt tới:{" "}
                {new Date(active.startDeadlineAt).toLocaleString("vi-VN")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <span className="acc-badge" data-tone="blue">
                  Người tham gia: {active.participants ?? 0}
                </span>
                <span className="acc-badge" data-tone="teal">
                  Tổng lượt: {active.attempts}
                </span>
                <span className="acc-badge" data-tone="amber">
                  Đang chơi: {active.active}
                </span>
                <span className="acc-badge">Hoàn thành: {active.completed ?? 0}</span>
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--acc-muted)", fontSize: "0.88rem", marginTop: 0 }}>
              Chưa có phòng thi thử nào đang mở. Bấm nút bên dưới để hệ thống tự động nạp 87 câu giả lập và mở ngay
              phòng thi thử.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 7.5rem", gap: "0.6rem", marginBottom: "0.8rem" }}>
            <label className="acc-field">
              <span>Tên vòng diễn tập (tùy chọn)</span>
              <input
                className="acc-input"
                placeholder="Để trống sẽ tự đặt Phòng thi thử #..."
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
              />
            </label>
            <label className="acc-field">
              <span>Phút mở lượt</span>
              <input
                type="number"
                min={5}
                max={1440}
                className="acc-input"
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(Math.max(5, Number(e.target.value) || 180))}
              />
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
            {!isRehearsalOpen && !hasPlayedInActive ? (
              <button
                type="button"
                className="acc-btn acc-btn-primary"
                disabled={busyAction !== null || Boolean(data?.officialOpen)}
                onClick={() => void handleOpenOrResetRound()}
              >
                {busyAction === "round" ? "Đang mở phòng thi thử..." : "Mở buổi thi thử ngay"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="acc-btn acc-btn-amber"
                  disabled={busyAction !== null || Boolean(data?.officialOpen)}
                  onClick={() => setConfirmResetOpen(true)}
                >
                  {busyAction === "round" ? "Đang tạo vòng mới..." : "Chơi thử lại (Vòng diễn tập mới)"}
                </button>
                {isRehearsalOpen && (
                  <button
                    type="button"
                    className="acc-btn"
                    disabled={busyAction !== null}
                    onClick={() => void handleCloseRehearsal()}
                  >
                    Đóng nhận lượt thử
                  </button>
                )}
              </>
            )}
          </div>
        </article>

        {/* STEP 2: Provision & Copy Test Accounts */}
        <article className="acc-panel" style={{ marginBottom: 0 }}>
          <div className="acc-panel-header">
            <h3 className="acc-panel-title">
              <span className="acc-step-number">2</span>
              Tài khoản thử nghiệm ({accounts.length})
            </h3>
            <span className="acc-badge" data-tone="amber">
               Tiền tố THU001..THU030
            </span>
          </div>

          <p style={{ color: "var(--acc-muted)", fontSize: "0.86rem", marginTop: 0 }}>
            Tạo sẵn các tài khoản thử không trùng MSSV thật. Tất cả đăng nhập bằng{" "}
            <strong>mật khẩu mặc định của lớp</strong> (biến môi trường <code>ROSTER_DEFAULT_PASSWORD</code>, không lưu
            log).
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "0.6rem", marginBottom: "0.85rem" }}>
            <label className="acc-field" style={{ flex: "1 1 8rem" }}>
              <span>Số lượng tài khoản thử (1–30)</span>
              <input
                type="number"
                min={1}
                max={30}
                className="acc-input"
                value={accountCount}
                onChange={(e) => setAccountCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
            <button
              type="button"
              className="acc-btn acc-btn-primary"
              disabled={busyAction !== null}
              onClick={() => void handleProvisionAccounts()}
            >
              {busyAction === "accounts" ? "Đang cấp phát..." : `Tạo / Làm mới ${accountCount} tài khoản thử`}
            </button>
            {accounts.length > 0 && (
              <button
                type="button"
                className="acc-btn"
                onClick={() => void copyText("all-creds", credentialSummaryText)}
              >
                {copiedToken === "all-creds" ? "Đã sao chép!" : "Sao chép thông tin đăng nhập"}
              </button>
            )}
          </div>

          {accounts.length === 0 ? (
            <div className="acc-panel-alt" style={{ fontSize: "0.86rem", color: "var(--acc-muted)" }}>
              Chưa có tài khoản thử nào. Chọn số lượng và bấm <strong>Tạo / Làm mới tài khoản thử</strong>.
            </div>
          ) : (
            <div className="acc-table-wrap" style={{ maxHeight: "13.5rem", overflowY: "auto" }}>
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>MSSV thử</th>
                    <th>Tên hiển thị</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td>
                        <code style={{ fontWeight: 700, color: "var(--acc-amber)" }}>{acc.studentId}</code>
                      </td>
                      <td>{acc.displayName}</td>
                      <td>
                        <span className="acc-badge" data-tone={acc.status === "active" ? "teal" : "red"}>
                          {acc.status === "active" ? "Sẵn sàng" : acc.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="acc-btn"
                          style={{ minHeight: "1.9rem", padding: "0.2rem 0.6rem", fontSize: "0.78rem" }}
                          onClick={() => void copyText(acc.studentId, acc.studentId)}
                        >
                          {copiedToken === acc.studentId ? "Đã chép" : "Chép MSSV"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {/* STEP 3: Play & Verify Flow */}
        <article className="acc-panel" style={{ marginBottom: 0 }}>
          <div className="acc-panel-header">
            <h3 className="acc-panel-title">
              <span className="acc-step-number">3</span>
              Đăng nhập & Chơi thử 2 Game
            </h3>
            <span className="acc-badge" data-tone="teal">
              API Thật 100%
            </span>
          </div>

          <ol
            style={{
              margin: "0 0 0.9rem",
              paddingLeft: "1.2rem",
              color: "var(--acc-text-Soft)",
              fontSize: "0.87rem",
              display: "grid",
              gap: "0.35rem",
            }}
          >
            <li>Mở cửa sổ ẩn danh (Incognito) hoặc thiết bị phụ và vào trang Đăng nhập.</li>
            <li>
              Nhập mã <code>{accounts[0]?.studentId ?? "THU001"}</code> và mật khẩu mặc định của lớp.
            </li>
            <li>
              Chơi <strong>Bãi Mìn Quyết Sách</strong> và <strong>Đường Đua Mốc Quá Độ</strong>.
            </li>
            <li>
              Đối chiếu kết quả trên 2 bảng xếp hạng bên dưới, hoặc bấm <strong>Chơi thử lại</strong> để mở vòng mới!
            </li>
          </ol>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.55rem" }}>
            <Link href="/dang-nhap" target="_blank" className="acc-btn acc-btn-primary">
              1. Trang Đăng nhập ↗
            </Link>
            <Link href="/live-arena" target="_blank" className="acc-btn">
              2. Sảnh Live Arena ↗
            </Link>
            <Link href="/live-arena/bai-min" target="_blank" className="acc-btn">
              3. Chơi Bãi Mìn ↗
            </Link>
            <Link href="/live-arena/duong-dua" target="_blank" className="acc-btn">
              4. Chơi Đường Đua ↗
            </Link>
            <Link href="/live-arena/bang-xep-hang" target="_blank" className="acc-btn">
              5. Bảng xếp hạng ↗
            </Link>
            <Link href="/trinh-chieu" target="_blank" className="acc-btn">
              6. Màn hình trình chiếu ↗
            </Link>
          </div>
        </article>
      </div>

      {/* Live Dual Leaderboard Preview inside Rehearsal Studio */}
      <div className="acc-panel">
        <div className="acc-panel-header">
          <div>
            <h3 className="acc-panel-title">
              Bảng xếp hạng Phòng thi thử trực tiếp {active ? `— ${active.name}` : ""}
            </h3>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.84rem", color: "var(--acc-muted)" }}>
              Tự động đồng bộ mỗi 6 giây. Khi bấm &ldquo;Chơi thử lại&rdquo;, vòng diễn tập mới sẽ khởi tạo bảng điểm
              trống hoàn toàn.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="acc-btn" disabled={loading} onClick={() => void loadStudio()}>
              Làm mới bảng điểm
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))", gap: "1rem" }}>
          {(
            [
              { key: "minefield", title: "Game 1 · Bãi Mìn Quyết Sách", maxProgress: 10 },
              { key: "race", title: "Game 2 · Đường Đua Mốc Quá Độ", maxProgress: 15 },
            ] as const
          ).map((g) => {
            const board = data?.leaderboards?.[g.key];
            const entries = board?.entries ?? [];
            return (
              <div key={g.key} className="acc-panel-alt">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.65rem",
                  }}
                >
                  <strong>{g.title}</strong>
                  <span className="acc-badge" data-tone="teal">
                    {board?.totalParticipants ?? entries.length} người chơi
                  </span>
                </div>

                {entries.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--acc-muted)" }}>
                    Bảng xếp hạng đang trống — chưa có lượt chơi nào trong vòng thi thử này.
                  </p>
                ) : (
                  <div className="acc-table-wrap">
                    <table className="acc-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Thí sinh</th>
                          <th>Điểm</th>
                          <th>Đúng</th>
                          <th>Tiến độ</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.slice(0, 10).map((e) => (
                          <tr key={e.entryId}>
                            <td>
                              <strong>#{e.rank}</strong>
                            </td>
                            <td>{e.displayName}</td>
                            <td>
                              <strong style={{ color: "var(--acc-amber)" }}>{e.score}</strong>
                            </td>
                            <td>{e.correctCount}</td>
                            <td>
                              {e.progress}/{g.maxProgress}
                            </td>
                            <td>
                              <span
                                className="acc-badge"
                                data-tone={e.state === "completed" ? "teal" : e.state === "playing" ? "amber" : undefined}
                              >
                                {e.state === "completed"
                                  ? "Hoàn thành"
                                  : e.state === "playing"
                                    ? "Đang chơi"
                                    : "Hết giờ"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal for "Chơi thử lại" (New Rehearsal Round) */}
      {confirmResetOpen && (
        <div className="acc-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rehearsal-reset-title">
          <div className="acc-modal">
            <p className="acc-kicker">Xác nhận vòng diễn tập mới</p>
            <h3 id="rehearsal-reset-title" style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
              Bắt đầu vòng &ldquo;Chơi thử lại&rdquo; mới?
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--acc-text-Soft)" }}>
              Hệ thống sẽ đóng vòng diễn tập hiện tại (giữ nguyên toàn bộ lịch sử điểm và nhật ký kiểm toán) và mở ngay
              một vòng thi thử mới với <strong>2 bảng xếp hạng trống</strong> để các tài khoản thử chơi lại từ đầu.
            </p>
            <div className="acc-modal-summary">
              <div className="acc-modal-row">
                <span>Vòng hiện tại:</span>
                <strong>{active?.name ?? "Chưa có"}</strong>
              </div>
              <div className="acc-modal-row">
                <span>Số lượt đã chơi ở vòng cũ:</span>
                <strong>{active?.attempts ?? 0} lượt (được bảo toàn lịch sử)</strong>
              </div>
              <div className="acc-modal-row">
                <span>Thời gian nhận lượt vòng mới:</span>
                <strong>{windowMinutes} phút</strong>
              </div>
              <div className="acc-modal-row">
                <span>Tác động tới cuộc thi chính thức:</span>
                <strong style={{ color: "#5eead4" }}>Không tác động (Cách ly 100%)</strong>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button type="button" className="acc-btn" onClick={() => setConfirmResetOpen(false)}>
                Hủy
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-amber"
                disabled={busyAction !== null}
                onClick={() => void handleOpenOrResetRound()}
              >
                Xác nhận mở vòng diễn tập mới
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
