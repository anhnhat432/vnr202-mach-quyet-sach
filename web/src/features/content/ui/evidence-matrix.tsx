"use client";

import Link from "next/link";
import { useState } from "react";

import type { EvidenceClaim, PublicSource } from "@/features/content/server/local-content";

export function EvidenceMatrix({ sources, claims }: { sources: PublicSource[]; claims: EvidenceClaim[] }) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId);
  const selectedSource = sources.find((source) => source.id === selectedClaim?.sourceId);

  return (
    <div className="matrix-wrap">
      <div className="evidence-matrix" role="table" aria-label="Ma trận luận điểm và nguồn">
        <div className="matrix-row matrix-row--header" role="row">
          <span role="columnheader">Luận điểm</span>
          {sources.map((source, index) => <span role="columnheader" key={source.id}>N{index + 1}</span>)}
        </div>
        {claims.map((claim) => (
          <div className="matrix-row" role="row" key={claim.id}>
            <span role="rowheader">
              <small>{claim.category} · {claim.dossierTitle}</small>
              <strong>{claim.statement}</strong>
            </span>
            {sources.map((source) =>
              source.id === claim.sourceId ? (
                <button
                  type="button"
                  key={source.id}
                  aria-pressed={selectedClaimId === claim.id}
                  aria-label={`Xem nguồn: ${source.title} hỗ trợ luận điểm ${claim.statement}`}
                  onClick={() => setSelectedClaimId(claim.id)}
                >
                  <span aria-hidden="true">●</span>
                </button>
              ) : <span className="matrix-empty" aria-label="Không gắn nguồn" key={source.id}>·</span>,
            )}
          </div>
        ))}
      </div>

      <ol className="source-legend" aria-label="Danh sách nguồn">
        {sources.map((source, index) => (
          <li key={source.id}><span>N{index + 1}</span><strong>{source.title}</strong><small>{source.locator}</small></li>
        ))}
      </ol>

      {selectedClaim && selectedSource && (
        <aside className="source-drawer" aria-live="polite">
          <button type="button" onClick={() => setSelectedClaimId(null)}>Đóng ×</button>
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
