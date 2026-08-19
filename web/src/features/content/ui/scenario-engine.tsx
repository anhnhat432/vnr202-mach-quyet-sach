"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { DossierExperience } from "@/features/content/contracts/dossier";

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
  const [stage, setStage] = useState<ScenarioStage>("briefing");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [selectedDecision, setSelectedDecision] = useState("");
  const [isRestored, setIsRestored] = useState(false);
  const stageIndex = stages.findIndex((item) => item.id === stage);

  useEffect(() => {
    const savedState = readSavedState(storageKey);
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

    const restoreFrame = window.requestAnimationFrame(() => {
      setStage(restoredStage);
      setSelectedEvidence(restoredEvidence);
      setSelectedDecision(restoredDecision);
      setIsRestored(true);
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, [experience.decision.options, experience.decision.requiredEvidenceCount, experience.evidence, storageKey]);

  useEffect(() => {
    if (!isRestored) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ stage, selectedEvidence, selectedDecision }));
  }, [isRestored, selectedDecision, selectedEvidence, stage, storageKey]);

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
          <div className="scenario-panel scenario-panel--night">
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
          </div>
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
