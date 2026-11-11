"use client";

import { useState } from "react";
import type { HistoryImage, HistoryVideo } from "./types";

export function HistoryPhoto({ image, year, compact = false }: { image?: HistoryImage; year: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={`history-photo${compact ? " history-photo--compact" : ""}`}>
      {image && !failed ? (
        // Local archival assets have checked source and reuse metadata in data.ts.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="history-photo__fallback" data-testid="history-image-fallback">
          <span aria-hidden="true">{year}</span>
          <small>{failed ? "Ảnh tạm thời không tải được" : "Dấu mốc qua tư liệu chữ"}</small>
        </div>
      )}
      {image && (
        <figcaption>
          {image.caption} <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">Nguồn ảnh ↗</a>
          {!compact && <><br />{image.credit} · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.license} ↗</a></>}
        </figcaption>
      )}
    </figure>
  );
}

// Opt-in embeds only; an external link remains visible even when a provider silently
// blocks embedding (cross-origin errors cannot always be detected by the parent).
export function HistoryFilm({ video }: { video: HistoryVideo }) {
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);
  const validId = /^[a-zA-Z0-9_-]{11}$/.test(video.youtubeId);
  return (
    <section className="history-film" aria-label={video.title}>
      <h4>{video.title}</h4>
      <p>{video.publisher}</p>
      {validId && !opened && <button type="button" className="history-button" onClick={() => setOpened(true)}>Tải video tư liệu</button>}
      {opened && !failed && validId && (
        <iframe title={video.title} src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={() => setFailed(true)} />
      )}
      {opened && !failed && <button className="history-text-button" type="button" onClick={() => setFailed(true)}>Video không phát? Dùng nguồn gốc</button>}
      {(failed || !validId) && <p role="status">Video không phát được trong trang.</p>}
      <a href={video.sourceUrl} target="_blank" rel="noopener noreferrer">Mở nguồn gốc nếu video không phát ↗</a>
    </section>
  );
}
