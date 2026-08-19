import Link from "next/link";

import type { DossierSummary } from "@/features/content/contracts/dossier";

const chapterLabels = {
  chapter_1: "Chương 1",
  chapter_2: "Chương 2",
  chapter_3: "Chương 3",
} as const;

export function DossierCard({ dossier }: { dossier: DossierSummary }) {
  return (
    <Link className="dossier-rail" href={`/ho-so/${dossier.slug}`}>
      <span className="dossier-rail__index">#{String(dossier.orderIndex).padStart(2, "0")}</span>
      <span className="dossier-rail__chapter">{chapterLabels[dossier.chapter]}</span>
      <span className="dossier-rail__body">
        <strong>{dossier.title}</strong>
        <span>{dossier.centralQuestion}</span>
      </span>
      <span className="dossier-rail__status">Đã xuất bản</span>
      <span className="dossier-rail__arrow" aria-hidden="true">↗</span>
    </Link>
  );
}
