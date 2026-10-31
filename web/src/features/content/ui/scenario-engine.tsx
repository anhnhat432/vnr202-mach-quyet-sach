"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DossierExperience } from "@/features/content/contracts/dossier";
import { ArenaApiError, request } from "@/features/arena/client/api";
import { clearDraftIfUnchanged, readDraft, saveDraft } from "@/features/passport/offline-progress";

type ScenarioStage = "briefing" | "evidence" | "decision" | "consequences" | "comparison" | "connections";

const stages: Array<{ id: ScenarioStage; label: string }> = [
  { id: "briefing", label: "Nhận lệnh" },
  { id: "evidence", label: "Dữ kiện" },
  { id: "decision", label: "Quyết sách" },
  { id: "consequences", label: "Hệ quả" },
  { id: "comparison", label: "Đối chiếu" },
  { id: "connections", label: "Kết nối" },
];

type SavedScenarioState = {
  stage: ScenarioStage;
  selectedEvidence: string[];
  selectedDecision: string;
};

function readSavedState(storageKey: string): SavedScenarioState {
  if (typeof window === "undefined") {
    return { stage: "briefing", selectedEvidence: [], selectedDecision: "" };
  }
  try {
    const saved = window.localStorage.getItem(storageKey);
    const parsed = saved ? (JSON.parse(saved) as Partial<SavedScenarioState>) : {};
    return {
      stage: parsed.stage && stages.some((item) => item.id === parsed.stage) ? parsed.stage : "briefing",
      selectedEvidence: Array.isArray(parsed.selectedEvidence) ? parsed.selectedEvidence : [],
      selectedDecision: typeof parsed.selectedDecision === "string" ? parsed.selectedDecision : "",
    };
  } catch {
    return { stage: "briefing", selectedEvidence: [], selectedDecision: "" };
  }
}

export function ScenarioEngine({
  dossierId,
  dossierSlug,
  experience,
}: {
  dossierId: string;
  dossierSlug: string;
  experience: DossierExperience;
}) {
  const storageKey = `vnr202:dossier:${dossierId}:v1`;
  const draftKey = `vnr202:dossier:${dossierId}:pending:v1`;
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<ScenarioStage>("briefing");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [selectedDecision, setSelectedDecision] = useState("");
  const [isRestored, setIsRestored] = useState(false);
  const [accountSync, setAccountSync] = useState<"loading" | "guest" | "ready" | "load-error" | "save-error" | "conflict" | "storage-error">("loading");
  const [remoteConflict, setRemoteConflict] = useState<SavedScenarioState | null>(null);
  const [accountChanged, setAccountChanged] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [offlinePageReady, setOfflinePageReady] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const version = useRef<number | null>(null);
  const owner = useRef<string | null>(null);
  const halted = useRef(false);
  const observed = useRef("");
  const accountState = useRef<SavedScenarioState>({ stage: "briefing", selectedEvidence: [], selectedDecision: "" });
  const stageIndex = stages.findIndex((item) => item.id === stage);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    const cachePage = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/dossier-offline.js", { scope: "/ho-so/" });
        const worker = registration.active ?? (await navigator.serviceWorker.ready).active;
        if (!worker || !active) return;
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => { if (active && event.data?.ready === true) setOfflinePageReady(true); channel.port1.close(); };
        const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
        worker.postMessage({ type: "CACHE_PUBLIC_DOSSIER", page: window.location.href, resources }, [channel.port2]);
      } catch { /* progress is still stored locally; offline page availability is not claimed */ }
    };
    if (document.readyState === "complete") void cachePage();
    else window.addEventListener("load", cachePage, { once: true });
    return () => { active = false; window.removeEventListener("load", cachePage); };
  }, []);

  useEffect(() => {
    let alive = true;
    async function restore() {
    let deviceStorage: Storage;
    try { deviceStorage = window.localStorage; setHasBackup(Object.keys(deviceStorage).some((key) => key.startsWith(`${draftKey}:backup:`))); }
    catch { setAccountSync("storage-error"); setIsRestored(true); return; }
    let savedState = readDraft(deviceStorage, draftKey) ?? readSavedState(storageKey);
    let sync: "guest" | "ready" | "load-error" | "conflict" = "guest";
    try {
      const response = await request<{ ownerId: string; items: Array<{ dossier_id: string; state: SavedScenarioState; version: number }> }>("GET", "/passport/progress");
      owner.current = response.ownerId;
      const row = response.items.find((item) => item.dossier_id === dossierId);
      accountState.current = row?.state ?? { stage: "briefing", selectedEvidence: [], selectedDecision: "" };
      version.current = row?.version ?? 0;
      const draft = readDraft(deviceStorage, draftKey);
      savedState = draft ?? accountState.current;
      sync = draft ? "conflict" : "ready";
      if (draft) setRemoteConflict(accountState.current);
      halted.current = Boolean(draft);
    } catch (error) {
      if (!(error instanceof ArenaApiError && error.status === 401)) sync = "load-error";
    }
    if (!alive) return;
    const restoredEvidence = savedState.selectedEvidence.filter((id) =>
      experience.evidence.some((item) => item.id === id),
    );
    const restoredDecision = experience.decision.options.some((item) => item.id === savedState.selectedDecision)
      ? savedState.selectedDecision
      : "";
    let restoredStage = savedState.stage;
    const restoredStageIndex = stages.findIndex((item) => item.id === restoredStage);
    if (restoredStageIndex >= 2 && restoredEvidence.length < experience.decision.requiredEvidenceCount) {
      restoredStage = "evidence";
    } else if (restoredStageIndex >= 3 && !restoredDecision) {
      restoredStage = "decision";
    }

      observed.current = JSON.stringify({ stage: restoredStage, selectedEvidence: restoredEvidence, selectedDecision: restoredDecision });

      setStage(restoredStage);
      setSelectedEvidence(restoredEvidence);
      setSelectedDecision(restoredDecision);
      setAccountSync(sync);
      setIsRestored(true);
    }
    void restore();
    return () => { alive = false; };
  }, [dossierId, draftKey, experience.decision.options, experience.decision.requiredEvidenceCount, experience.evidence, storageKey]);

  useEffect(() => {
    if (!isRestored) return;
    const state = { stage, selectedEvidence, selectedDecision };
    const serialized = JSON.stringify(state);
    if (serialized === observed.current) return;
    observed.current = serialized;
    try {
      if (accountSync === "guest") window.localStorage.setItem(storageKey, serialized);
      else saveDraft(window.localStorage, draftKey, state);
    } catch { halted.current = true; queueMicrotask(() => setAccountSync("storage-error")); return; }
    if (accountSync === "ready") queueSave(state);
  // queueSave reads current version through refs; only actual edits trigger this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountSync, dossierSlug, draftKey, isRestored, selectedDecision, selectedEvidence, stage, storageKey]);

  function queueSave(state: SavedScenarioState) {
    writes.current = writes.current.then(async () => {
      if (halted.current || version.current === null || owner.current === null) return;
      try {
        const result = await request<{ version: number }>("POST", "/passport/progress", { body: { slug: dossierSlug, state, ownerId: owner.current, expectedVersion: version.current } });
        version.current = result.version;
        accountState.current = state;
        clearDraftIfUnchanged(window.localStorage, draftKey, state);
      } catch (error) {
        halted.current = true;
        if (error instanceof ArenaApiError && (error.code === "progress_conflict" || error.code === "session_changed")) {
          setAccountChanged(error.code === "session_changed");
          setRemoteConflict(null);
          setAccountSync("conflict");
          try {
            const response = await request<{ ownerId: string; items: Array<{ dossier_id: string; state: SavedScenarioState; version: number }> }>("GET", "/passport/progress");
            owner.current = response.ownerId;
            const latest = response.items.find((item) => item.dossier_id === dossierId);
            version.current = latest?.version ?? 0;
            setRemoteConflict(latest?.state ?? { stage: "briefing", selectedEvidence: [], selectedDecision: "" });
          } catch { /* keep the local draft; the user can retry when online */ }
        } else setAccountSync("save-error");
      }
    });
  }

  async function resolveDraft(choice: "device" | "account" | "retry") {
    try {
      await writes.current;
      const response = await request<{ ownerId: string; items: Array<{ dossier_id: string; state: SavedScenarioState; version: number }> }>("GET", "/passport/progress");
      const row = response.items.find((item) => item.dossier_id === dossierId);
      const remoteVersion = row?.version ?? 0;
      const remoteState = row?.state ?? { stage: "briefing", selectedEvidence: [], selectedDecision: "" };
      accountState.current = remoteState;
      if ((choice === "device" || choice === "retry") && owner.current !== null && owner.current !== response.ownerId) {
        owner.current = response.ownerId; version.current = remoteVersion; setRemoteConflict(remoteState); setAccountChanged(true); setAccountSync("conflict"); return;
      }
      owner.current = response.ownerId;
      if (choice === "device" && (version.current === null || remoteVersion !== version.current)) {
        version.current = remoteVersion; setRemoteConflict(remoteState); setAccountSync("conflict"); return;
      }
      if (choice === "retry" && !readDraft(window.localStorage, draftKey)) {
        version.current = remoteVersion; observed.current = JSON.stringify(remoteState); halted.current = false;
        setStage(remoteState.stage); setSelectedEvidence(remoteState.selectedEvidence); setSelectedDecision(remoteState.selectedDecision); setAccountSync("ready");
        return;
      }
      if (choice === "retry" && (version.current === null || remoteVersion !== version.current)) { version.current = remoteVersion; accountState.current = remoteState; setRemoteConflict(remoteState); setAccountSync("conflict"); return; }
      version.current = remoteVersion;
      if (choice === "account") {
        const draft = readDraft(window.localStorage, draftKey);
        if (draft) { window.localStorage.setItem(`${draftKey}:backup:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(draft)); setHasBackup(true); }
        window.localStorage.removeItem(draftKey);
        observed.current = JSON.stringify(remoteState);
        setStage(remoteState.stage); setSelectedEvidence(remoteState.selectedEvidence); setSelectedDecision(remoteState.selectedDecision);
      }
      if (choice === "device" && row) {
        window.localStorage.setItem(`${draftKey}:backup:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(remoteState));
        setHasBackup(true);
      }
      halted.current = false;
      setAccountChanged(false);
      setAccountSync("ready");
      if (choice !== "account") {
        const draft = readDraft(window.localStorage, draftKey);
        if (draft) queueSave(draft);
      }
    } catch { halted.current = true; setAccountSync("save-error"); }
  }

  function restoreBackup() {
    try {
      const key = Object.keys(window.localStorage).filter((item) => item.startsWith(`${draftKey}:backup:`)).sort().at(-1);
      const backup = key ? readDraft(window.localStorage, key) : null;
      if (!backup || readDraft(window.localStorage, draftKey)) return;
      saveDraft(window.localStorage, draftKey, backup);
      observed.current = JSON.stringify(backup);
      setStage(backup.stage); setSelectedEvidence(backup.selectedEvidence); setSelectedDecision(backup.selectedDecision);
      halted.current = true;
      setRemoteConflict(accountState.current);
      setAccountSync("conflict");
    } catch { halted.current = true; setAccountSync("storage-error"); }
  }

  const selectedOption = experience.decision.options.find((option) => option.id === selectedDecision);
  const consequence = useMemo(
    () => experience.projectedConsequences.find((item) => item.optionId === selectedDecision),
    [experience.projectedConsequences, selectedDecision],
  );

  function toggleEvidence(id: string) {
    setSelectedEvidence((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <section className="scenario" aria-label="Trình mô phỏng hồ sơ quyết sách">
      {offlinePageReady ? <p role="status">Trang hồ sơ đã sẵn sàng để mở lại khi mất mạng.</p> : null}
      {accountSync === "load-error" || accountSync === "save-error" ? <div role="status"><p>Không đồng bộ được tiến độ. Bản đang học được lưu tạm trên thiết bị; hãy thử lại khi có mạng.</p><button type="button" onClick={() => void resolveDraft("retry")}>Thử đồng bộ lại</button></div> : null}
      {accountSync === "conflict" ? <div role="status"><p>{accountChanged ? "Tài khoản đăng nhập đã thay đổi. " : "Thiết bị có bản chưa đồng bộ hoặc tài khoản đã thay đổi ở thiết bị khác. "}Chọn bản muốn dùng; bản còn lại được lưu dự phòng trên thiết bị. Trên máy dùng chung, kiểm tra bản thiết bị trước khi chọn.</p><p>Bản thiết bị: {stages.find((item) => item.id === stage)?.label}, {selectedEvidence.length} dữ kiện{selectedDecision ? ", đã chọn phương án" : ""}.</p><p>Bản tài khoản: {remoteConflict ? `${stages.find((item) => item.id === remoteConflict.stage)?.label}, ${remoteConflict.selectedEvidence.length} dữ kiện${remoteConflict.selectedDecision ? ", đã chọn phương án" : ""}.` : "Chưa tải được; hãy thử lại khi có mạng."}</p><button type="button" onClick={() => void resolveDraft("device")}>Dùng bản thiết bị và thay bản tài khoản</button><button type="button" onClick={() => void resolveDraft("account")}>Dùng bản tài khoản, giữ bản thiết bị dự phòng</button></div> : null}
      {accountSync === "storage-error" ? <p role="alert">Không lưu được bản tạm trên thiết bị. Hãy kiểm tra bộ nhớ trình duyệt trước khi rời trang.</p> : null}
      {accountSync === "ready" && hasBackup ? <button type="button" onClick={restoreBackup}>Xem bản dự phòng gần nhất trên thiết bị</button> : null}
      <aside className="scenario__rail" aria-label="Sáu chặng">
        <p className="eyebrow">Scenario Engine · 6 chặng</p>
        <ol>
          {stages.map((item, index) => (
            <li
              key={item.id}
              data-state={isRestored ? (index === stageIndex ? "active" : index < stageIndex ? "done" : "pending") : "pending"}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </li>
          ))}
        </ol>
      </aside>

      <div className="scenario__workspace" aria-live="polite">
        {!isRestored && (
          <div className="scenario-panel">
            <p className="scenario-kicker">Đang khôi phục tiến độ</p>
            <h2>Đồng bộ hồ sơ trên thiết bị này</h2>
            <p className="scenario-note">Tiến độ cục bộ đang được kiểm tra trước khi mở lại đúng chặng.</p>
          </div>
        )}

        {isRestored && stage === "briefing" && (
          <div className="scenario-panel">
            <p className="scenario-kicker">Chặng 1 · Briefing · {experience.briefing.period}</p>
            <h2>Nhận diện tình thế</h2>
            <div className="briefing-grid">
              <div>
                <h3>Bối cảnh</h3>
                {experience.briefing.context.map((item) => <p key={item}>{item}</p>)}
              </div>
              <div className="briefing-grid__pressure">
                <h3>Mâu thuẫn trung tâm</h3>
                <p>{experience.briefing.centralContradiction}</p>
                <h3>Mục tiêu</h3>
                <p>{experience.briefing.objective}</p>
              </div>
            </div>
            <button className="scenario-action" type="button" onClick={() => setStage("evidence")}>
              Mở phòng dữ kiện
            </button>
          </div>
        )}

        {isRestored && stage === "evidence" && (
          <div className="scenario-panel">
            <p className="scenario-kicker">Chặng 2 · Phòng Dữ kiện</p>
            <h2>Chọn {experience.decision.requiredEvidenceCount} dữ kiện có giá trị</h2>
            <p className="scenario-note">Không phải thông tin nào xuất hiện trong tình thế cũng có trọng lượng như nhau.</p>
            <div className="evidence-deck">
              {experience.evidence.map((item) => {
                const checked = selectedEvidence.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`Chọn dữ kiện: ${item.label}`}
                    className="evidence-card"
                    data-selected={checked}
                    onClick={() => toggleEvidence(item.id)}
                  >
                    <span>{item.kind}</span>
                    <strong>{item.label}</strong>
                    <small>{item.summary}</small>
                    <b>{checked ? "Đã đưa vào bàn" : "Chạm để chọn"}</b>
                  </button>
                );
              })}
            </div>
            <div className="scenario-bottom-line">
              <span>{selectedEvidence.length}/{experience.decision.requiredEvidenceCount} dữ kiện đã chọn</span>
              <button
                className="scenario-action"
                type="button"
                disabled={selectedEvidence.length < experience.decision.requiredEvidenceCount}
                onClick={() => setStage("decision")}
              >
                Đi tới bàn quyết sách
              </button>
            </div>
          </div>
        )}

        {isRestored && stage === "decision" && (
          <div className="scenario-panel">
            <p className="scenario-kicker">Chặng 3 · Bàn Quyết sách</p>
            <h2>{experience.decision.prompt}</h2>
            <fieldset className="decision-options">
              <legend className="sr-only">Chọn một phương án</legend>
              {experience.decision.options.map((option) => (
                <label key={option.id} data-selected={selectedDecision === option.id}>
                  <input
                    type="radio"
                    name="decision"
                    value={option.id}
                    checked={selectedDecision === option.id}
                    onChange={(event) => setSelectedDecision(event.target.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.rationale}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              className="scenario-action"
              type="button"
              disabled={!selectedDecision}
              onClick={() => setStage("consequences")}
            >
              Phân tích hệ quả
            </button>
          </div>
        )}

        {isRestored && stage === "consequences" && consequence && (
          <motion.div
            className="scenario-panel scenario-panel--night"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="scenario-kicker">Chặng 4 · Mô phỏng Hệ quả</p>
            <h2>Hướng đi dự phóng</h2>
            <p className="scenario-note">Đây là chuỗi hệ quả dùng để học và thảo luận, không khẳng định lịch sử chắc chắn sẽ diễn ra như vậy.</p>
            <div className="consequence-path">
              <strong>{selectedOption?.label}</strong>
              <ol>
                {consequence.steps.map((step, index) => (
                  <li key={step}><span>{index + 1}</span>{step}</li>
                ))}
              </ol>
            </div>
            <button className="scenario-action" type="button" onClick={() => setStage("comparison")}>
              Đối chiếu lịch sử
            </button>
          </motion.div>
        )}

        {isRestored && stage === "comparison" && (
          <div className="scenario-panel">
            <p className="scenario-kicker">Chặng 5 · Đối chiếu</p>
            <h2>Lịch sử thực tế</h2>
            <div className="historical-compare">
              <div>
                <span>Lựa chọn của bạn</span>
                <h3>{selectedOption?.label}</h3>
                <p>{selectedOption?.rationale}</p>
              </div>
              <div>
                <span>Quyết định lịch sử</span>
                <h3>{experience.historicalComparison.actualDecision}</h3>
                <ul>{experience.historicalComparison.results.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
            <div className="source-strip">
              {experience.sources.map((source) => (
                <span key={source.id}><strong>{source.title}</strong>{source.authorOrIssuer} · {source.locator}</span>
              ))}
            </div>
            <button className="scenario-action" type="button" onClick={() => setStage("connections")}>
              Kết nối vào mạch
            </button>
          </div>
        )}

        {isRestored && stage === "connections" && (
          <div className="scenario-panel scenario-complete">
            <p className="scenario-kicker">Chặng 6 · Kết nối Mạch</p>
            <h2>Hồ sơ đã nhập vào bản đồ tư duy lịch sử</h2>
            <p>{experience.lessons.join(" ")}</p>
            <div className="scenario-complete__links">
              <Link className="scenario-action" href={`/mach-nguyen-nhan?ho-so=${dossierSlug}`}>Mở Mạch Nguyên Nhân</Link>
              <Link className="text-link" href="/ho-so">Trở lại Kho Hồ sơ</Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
