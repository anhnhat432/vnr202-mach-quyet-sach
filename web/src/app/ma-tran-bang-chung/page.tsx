import type { Metadata } from "next";

import { getEvidenceMatrixData } from "@/features/content/server/local-content";
import { EvidenceMatrix } from "@/features/content/ui/evidence-matrix";

export const metadata: Metadata = { title: "Ma trận Bằng chứng" };

export default function EvidenceMatrixPage() {
  const data = getEvidenceMatrixData();
  return (
    <div className="page-shell knowledge-page">
      <header className="page-intro page-intro--wide">
        <p className="eyebrow">Luận điểm × Nguồn</p>
        <h1>Ma trận Bằng chứng</h1>
        <p>Mỗi điểm sáng là một liên kết có thể kiểm tra. Nhấn vào ô để xem nguồn, vị trí và phạm vi hỗ trợ cho luận điểm.</p>
      </header>
      <EvidenceMatrix sources={data.sources} claims={data.claims} />
    </div>
  );
}
