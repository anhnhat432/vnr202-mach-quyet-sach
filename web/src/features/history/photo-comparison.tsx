"use client";
import { useId, useState } from "react";
import { BA_DINH_IMAGE } from "./data";
import { BA_DINH_2008 } from "./museum-data";
export function PhotoComparison() {
  const [position, setPosition] = useState(50);
  const [failed, setFailed] = useState(false);
  const id = useId();
  return <section className="museum-comparison" aria-labelledby={`${id}-title`}>
    <p className="history-kicker">Thời gian qua khung ảnh</p><h3 id={`${id}-title`}>Một quảng trường, hai thời điểm.</h3>
    <p>Ba Đình · 1945 / 2008. Hai ảnh cùng quảng trường, khác góc máy và bố cục; đây là đối chiếu không gian qua thời gian, không phải ảnh chồng khớp hay phục dựng. Ảnh năm 2008 không đại diện diện mạo hiện tại.</p>
    {failed ? <p role="status">Ảnh so sánh tạm thời không tải được. Bạn vẫn có thể mở hai nguồn gốc bên dưới.</p> : <div className="museum-compare-stage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BA_DINH_2008.src} alt={BA_DINH_2008.alt} width="1280" height="853" loading="lazy" onError={() => setFailed(true)} />
      <div className="museum-compare-before" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BA_DINH_IMAGE.src} alt={BA_DINH_IMAGE.alt} width="1972" height="2208" loading="lazy" onError={() => setFailed(true)} />
      </div>
      <span className="museum-compare-line" style={{ left: `${position}%` }} aria-hidden="true"><b>↔</b></span>
      <span className="museum-compare-label museum-compare-label--before">02.09.1945</span><span className="museum-compare-label museum-compare-label--after">13.03.2008</span>
      <label className="sr-only" htmlFor={`${id}-range`}>Tỷ lệ hiển thị ảnh năm 1945</label><input id={`${id}-range`} type="range" min="0" max="100" value={position} aria-valuetext={`${position}% ảnh năm 1945`} onChange={event => setPosition(Number(event.target.value))} />
    </div>}
    <div className="museum-compare-tools"><p aria-live="polite">{position}% ảnh 1945 · Kéo ngang hoặc dùng phím mũi tên</p><button type="button" className="history-text-button" onClick={() => setPosition(50)}>Đặt lại 50%</button></div>
    <div className="museum-credits">{[BA_DINH_IMAGE, BA_DINH_2008].map(image => <p key={image.src}><a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">{image.caption} ↗</a><br />{image.credit} · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.license}</a>. Hiển thị vừa khung và che một phần theo thanh trượt; ảnh gốc không bị chỉnh sửa.</p>)}</div>
  </section>;
}
