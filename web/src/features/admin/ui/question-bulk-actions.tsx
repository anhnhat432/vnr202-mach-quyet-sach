"use client";

import { useRef, useState, type FormEvent } from "react";

import { ArenaApiError, request } from "@/features/arena/client/api";
import type { BulkQuestionTarget } from "./question-bank-types";

type Action = "review" | "publish";
type Result = { target: BulkQuestionTarget; state: "success" | "failed" | "uncertain" | "unprocessed"; message: string };
type Props = {
  selected: BulkQuestionTarget[];
  busy: boolean;
  onConfirmingChange: (confirming: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onComplete: () => Promise<void>;
};

// A human submits each group. The existing endpoint still authorizes, validates and audits each
// exact version independently; this is deliberately not a new privileged or atomic batch API.
export function QuestionBulkActions({ selected, busy, onConfirmingChange, onBusyChange, onComplete }: Props) {
  const [pending, setPending] = useState<{ action: Action; targets: BulkQuestionTarget[] } | null>(null);
  const [note, setNote] = useState("");
  const [attested, setAttested] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [stopped, setStopped] = useState(false);
  const submitting = useRef(false);
  const drafts = selected.filter((target) => target.status === "draft");
  const reviewed = selected.filter((target) => target.status === "reviewed");

  function open(action: Action) {
    if (busy || pending || submitting.current) return;
    const targets = action === "review" ? drafts : reviewed;
    if (!targets.length) return;
    setNote("");
    setAttested(false);
    setResults(null);
    setStopped(false);
    setPending({ action, targets: [...targets] });
    onConfirmingChange(true);
  }

  function cancel() {
    if (submitting.current) return;
    setPending(null);
    onConfirmingChange(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanNote = note.trim();
    if (!pending || submitting.current || busy) return;
    if (pending.action === "review" && (!attested || !cleanNote || cleanNote.length > 500)) return;
    submitting.current = true;
    onBusyChange(true);
    const report: Result[] = [];
    let stopQueue = false;
    try {
      for (const [index, target] of pending.targets.entries()) {
        if (stopQueue) {
          report.push({ target, state: "unprocessed", message: "Chưa gửi." });
          continue;
        }
        setProgress(`Đang xử lý ${index + 1}/${pending.targets.length} câu…`);
        try {
          const body = pending.action === "review" ? { action: "review", note: cleanNote } : { action: "publish" };
          const response = await request<{ status: string }>("POST", `/admin/question-versions/${target.versionId}/transitions`, { body });
          const expected = pending.action === "review" ? "reviewed" : "published";
          if (response?.status !== expected) throw new Error("Unconfirmed transition response");
          report.push({ target, state: "success", message: expected === "reviewed" ? "Đã duyệt." : "Đã xuất bản." });
        } catch (error) {
          const uncertain = !(error instanceof ArenaApiError) || error.status === 0 || error.status >= 500;
          const message = error instanceof ArenaApiError ? error.message : "Chưa xác nhận được kết quả từ máy chủ.";
          report.push({ target, state: uncertain ? "uncertain" : "failed", message });
          stopQueue = uncertain || (error instanceof ArenaApiError && [401, 403, 404, 429].includes(error.status));
        }
      }
      setStopped(stopQueue);
      setResults(report);
      await onComplete();
    } finally {
      setProgress(null);
      setPending(null);
      submitting.current = false;
      onConfirmingChange(false);
      onBusyChange(false);
    }
  }

  const count = (state: Result["state"]) => results?.filter((result) => result.state === state).length ?? 0;
  return (
    <section className="adm__bulk" aria-label="Thao tác với câu đã chọn">
      <div className="adm__actions">
        <strong>Đã chọn {selected.length} câu</strong>
        <button type="button" disabled={busy || !!pending || !drafts.length} onClick={() => open("review")}>Duyệt đã chọn ({drafts.length})</button>
        <button type="button" disabled={busy || !!pending || !reviewed.length} onClick={() => open("publish")}>Xuất bản đã chọn ({reviewed.length})</button>
      </div>
      {pending ? (
        <form className="adm__bulk-form" aria-label={pending.action === "review" ? "Xác nhận duyệt nhóm" : "Xác nhận xuất bản nhóm"} onSubmit={(event) => void submit(event)}>
          <h2>{pending.action === "review" ? "Duyệt học thuật" : "Xuất bản"} {pending.targets.length} câu đã chọn</h2>
          {pending.action === "review" ? <>
            <label>Ghi chú học thuật chung<textarea value={note} maxLength={500} required disabled={busy} onChange={(event) => setNote(event.target.value)} /></label>
            <p className="adm__hint">Ghi chú này được lưu riêng cho mỗi câu trong nhóm. Chỉ chọn các câu đã đối chiếu cùng căn cứ.</p>
            <label className="adm__check"><input type="checkbox" checked={attested} disabled={busy} onChange={(event) => setAttested(event.target.checked)} />Tôi đã đối chiếu đáp án, giải thích và nguồn của các câu được chọn.</label>
          </> : <p>Chỉ các câu đã duyệt trong nhóm được xuất bản. Đáp án, giải thích và nguồn vẫn phải đủ điều kiện trên máy chủ.</p>}
          <p className="adm__hint">Các câu được xử lý lần lượt. Nếu một câu bị lỗi, kết quả từng câu được báo riêng.</p>
          <div className="adm__actions">
            <button type="submit" disabled={busy || (pending.action === "review" && (!attested || !note.trim() || note.trim().length > 500))}>
              Xác nhận {pending.action === "review" ? "duyệt" : "xuất bản"} {pending.targets.length} câu
            </button>
            <button type="button" className="is-ghost" disabled={busy} onClick={cancel}>Hủy</button>
          </div>
        </form>
      ) : null}
      {progress ? <p role="status">{progress}</p> : null}
      {results ? <div className="adm__bulk-results">
        <p role="status">Đã xử lý: {count("success")} thành công · {count("failed")} lỗi · {count("uncertain")} chưa rõ · {count("unprocessed")} chưa gửi.</p>
        {stopped ? <p className="adm__warn">Đã dừng nhóm và tải lại trạng thái; không tự động gửi lại. Kiểm tra kết quả và đăng nhập lại nếu cần trước khi chọn nhóm mới.</p> : null}
        <details><summary>Kết quả từng câu ({results.length})</summary><ul>
          {results.map((result) => <li key={result.target.versionId}>{result.target.label} — {result.state === "uncertain" ? "Chưa rõ kết quả. " : ""}{result.message}</li>)}
        </ul></details>
      </div> : null}
    </section>
  );
}
