"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { CauseEdge, CauseLane, CauseNode } from "@/features/content/server/local-content";

const laneLabels: Record<CauseLane, string> = {
  context: "Bối cảnh",
  contradiction: "Mâu thuẫn",
  force: "Lực lượng",
  decision: "Quyết sách",
  result: "Kết quả",
  lesson: "Bài học",
};

export function CauseMap({ nodes, edges }: { nodes: CauseNode[]; edges: CauseEdge[] }) {
  const [selectedId, setSelectedId] = useState(nodes[0]?.id ?? "");
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const relations = useMemo(
    () => edges.filter((edge) => edge.sourceId === selectedId || edge.targetId === selectedId),
    [edges, selectedId],
  );

  return (
    <div className="cause-map">
      <p className="cause-map__hint">
        Đọc từ trên xuống: mỗi cột là một giai đoạn, sáu hàng là sáu lớp quan hệ (bối cảnh → mâu thuẫn → lực lượng →
        quyết sách → kết quả → bài học). <strong>Chạm vào một ô</strong> để xem giải thích và các quan hệ nối tới nó.
      </p>
      <div className="cause-map__desktop" aria-label="Sáu lớp mạch nguyên nhân">
        {(Object.keys(laneLabels) as CauseLane[]).map((lane, laneIndex) => (
          <section className="cause-lane" data-lane={lane} key={lane}>
            <h2>
              <span className="cause-lane__num" aria-hidden="true">{String(laneIndex + 1).padStart(2, "0")}</span>
              {laneLabels[lane]}
            </h2>
            <div>
              {nodes.filter((node) => node.lane === lane).map((node) => (
                <button
                  key={node.id}
                  type="button"
                  aria-pressed={selectedId === node.id}
                  onClick={() => setSelectedId(node.id)}
                >
                  <span className="cause-cell__period">{node.period}</span>
                  <span className="cause-cell__text">{node.explanation}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="cause-map__mobile">
        <label>
          Chọn lát cắt
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {nodes.map((node) => <option key={node.id} value={node.id}>{node.period} · {node.label}</option>)}
          </select>
        </label>
      </div>

      {selected && (
        <aside className="relation-panel">
          <div>
            <p className="eyebrow">Quan hệ đang chọn</p>
            <h2>{selected.label}</h2>
            <p>{selected.explanation}</p>
            <Link href={`/ho-so/${selected.dossierSlug}`}>Mở hồ sơ</Link>
          </div>
          <div className="relation-panel__links">
            <h3>Quan hệ</h3>
            {relations.length ? relations.map((edge) => {
              const otherId = edge.sourceId === selected.id ? edge.targetId : edge.sourceId;
              const other = nodes.find((node) => node.id === otherId);
              return (
                <button type="button" key={edge.id} onClick={() => other && setSelectedId(other.id)}>
                  <span>{edge.relation}</span>
                  <strong>{other?.label}</strong>
                  <small>{edge.explanation}</small>
                </button>
              );
            }) : <p>Đây là điểm đầu hoặc cuối của lát cắt hiện tại.</p>}
          </div>
        </aside>
      )}
    </div>
  );
}
