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

const laneOrder: CauseLane[] = ["context", "contradiction", "force", "decision", "result", "lesson"];

type CauseCase = { slug: string; title: string; period: string; nodes: CauseNode[] };

export function CauseMap({ nodes, edges }: { nodes: CauseNode[]; edges: CauseEdge[] }) {
  const cases = useMemo<CauseCase[]>(() => {
    const map = new Map<string, CauseCase>();
    for (const node of nodes) {
      const existing = map.get(node.dossierSlug);
      if (existing) {
        existing.nodes.push(node);
      } else {
        map.set(node.dossierSlug, { slug: node.dossierSlug, title: node.dossierTitle, period: node.period, nodes: [node] });
      }
    }
    for (const item of map.values()) {
      item.nodes.sort((a, b) => laneOrder.indexOf(a.lane) - laneOrder.indexOf(b.lane));
    }
    return [...map.values()];
  }, [nodes]);

  const relationInto = useMemo(() => {
    const map = new Map<string, string>();
    for (const edge of edges) map.set(edge.targetId, edge.relation);
    return map;
  }, [edges]);

  const [activeSlug, setActiveSlug] = useState(cases[0]?.slug ?? "");
  const active = cases.find((item) => item.slug === activeSlug) ?? cases[0];

  if (!active) return null;

  return (
    <div className="cause-map">
      <p className="cause-map__hint">
        Chọn một <strong>trường hợp</strong> bên dưới, rồi đọc chuỗi nhân – quả sáu lớp từ bối cảnh đến bài học. Mỗi mũi
        tên là một quan hệ dẫn tới lớp tiếp theo.
      </p>

      <div className="cause-cases" role="tablist" aria-label="Chọn trường hợp lịch sử">
        {cases.map((item, index) => (
          <button
            key={item.slug}
            type="button"
            role="tab"
            aria-selected={item.slug === active.slug}
            className="cause-case"
            data-active={item.slug === active.slug}
            onClick={() => setActiveSlug(item.slug)}
          >
            <span className="cause-case__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span className="cause-case__body">
              <span className="cause-case__period">{item.period}</span>
              <strong>{item.title}</strong>
            </span>
          </button>
        ))}
      </div>

      <ol className="cause-chain" aria-label={`Chuỗi nhân quả: ${active.title}`}>
        {active.nodes.map((node, index) => {
          const relation = index > 0 ? relationInto.get(node.id) : null;
          return (
            <li key={node.id} className="cause-step" data-lane={node.lane}>
              {relation && (
                <span className="cause-step__rel" aria-hidden="true">
                  {relation}
                  <span className="cause-step__arrow">↓</span>
                </span>
              )}
              <div className="cause-step__card">
                <p className="cause-step__head">
                  <span className="cause-step__num">{String(index + 1).padStart(2, "0")}</span>
                  <span className="cause-step__lane">{laneLabels[node.lane]}</span>
                </p>
                <p className="cause-step__text">{node.explanation}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="cause-chain__foot">
        <Link className="cause-chain__open" href={`/ho-so/${active.slug}`}>
          Mở hồ sơ đầy đủ <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
