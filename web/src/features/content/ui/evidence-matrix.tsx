"use client";

import Link from "next/link";
import { useState } from "react";

import type { EvidenceClaim, PublicSource } from "@/features/content/server/local-content";

export function EvidenceMatrix({ sources, claims }: { sources: PublicSource[]; claims: EvidenceClaim[] }) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId);
  const selectedSource = sources.find((source) => source.id === selectedClaim?.sourceId);
  const verifiedCount = claims.filter((claim) => sources.some((source) => source.id === claim.sourceId)).length;

  return (
    <div className="evidence-board">
      <p className="evidence-board__hint">
        Mỗi thẻ là một luận điểm rút ra từ hồ sơ. Chạm vào nguồn bên dưới để xem nó được tài liệu nào xác minh và phạm
        vi hỗ trợ tới đâu. <strong>{verifiedCount}/{claims.length}</strong> luận điểm đã gắn nguồn đã xác minh.
      </p>

      <ol className="claim-list" aria-label="Danh sách luận điểm và nguồn">
        {claims.map((claim) => {
          const supporting = sources.filter((source) => source.id === claim.sourceId);
          return (
            <li className="claim-card" key={claim.id}>
              <div className="claim-card__head">
                <small>{claim.category} · {claim.dossierTitle}</small>
                <strong>{claim.statement}</strong>
              </div>
              <div className="claim-card__sources">
                <span className="claim-card__label">Nguồn xác minh</span>
                {supporting.length ? (
                  supporting.map((source) => (
                    <button
                      type="button"
                      key={source.id}
                      className="source-chip"
                      aria-pressed={selectedClaimId === claim.id}
                      aria-label={`Xem nguồn ${source.title} hỗ trợ luận điểm: ${claim.statement}`}
                      onClick={() => setSelectedClaimId(selectedClaimId === claim.id ? null : claim.id)}
                    >
                      <span aria-hidden="true" className="source-chip__dot" />
                      <b>{source.title}</b>
                      <small>{source.authorOrIssuer} · {source.publicationYear}</small>
                    </button>
                  ))
                ) : (
                  <span className="source-chip source-chip--empty">Chưa gắn nguồn</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {selectedClaim && selectedSource && (
        <aside className="source-drawer" aria-live="polite">
          <button type="button" className="source-drawer__close" onClick={() => setSelectedClaimId(null)}>
            Đóng ×
          </button>
          <p className="eyebrow">Nguồn đã xác minh</p>
          <h2>{selectedSource.title}</h2>
          <dl>
            <div><dt>Cơ quan / Tác giả</dt><dd>{selectedSource.authorOrIssuer}</dd></div>
            <div><dt>Năm</dt><dd>{selectedSource.publicationYear}</dd></div>
            <div><dt>Vị trí</dt><dd>{selectedSource.locator}</dd></div>
            <div><dt>Phạm vi hỗ trợ</dt><dd>{selectedClaim.supportScope}</dd></div>
          </dl>
          <blockquote>{selectedClaim.statement}</blockquote>
          <Link href={`/ho-so/${selectedClaim.dossierSlug}`}>Mở hồ sơ liên quan →</Link>
        </aside>
      )}
    </div>
  );
}
