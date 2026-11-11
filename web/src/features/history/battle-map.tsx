"use client";
import { useState } from "react";
import { CAMPAIGN } from "./museum-data";

export function BattleMap() {
  const [step, setStep] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const phase = step === null ? null : CAMPAIGN.phases[step];
  return <section className="museum-campaign" aria-label="Bản đồ chiến dịch Điện Biên Phủ">
    <p className="history-kicker">Không gian chiến dịch / 1954</p><h3>{CAMPAIGN.title}</h3>
    <p>Sơ đồ minh họa vị trí theo bản đồ tham khảo tháng 3/1954. Vùng sáng chỉ địa bàn được nhắc tới ở từng đợt, không phải tuyến hành quân hay ranh giới kiểm soát chính xác.</p>
    <div className="museum-campaign__layout">
      <div className="museum-battle-map">{failed ? <p>Không tải được sơ đồ. Diễn biến từng đợt và nguồn vẫn có ở bên cạnh.</p> : <svg viewBox="0 0 712 1048" role="img" aria-label={`Sơ đồ Điện Biên Phủ: ${phase?.title ?? "toàn cảnh"}`}>
        <image href="/history/dien-bien-map.png" width="712" height="1048" onError={() => setFailed(true)} />
        {(phase ? phase.points : CAMPAIGN.phases.flatMap(p => p.points)).map(point => <g key={point.label}><title>{point.label}</title><circle cx={point.x} cy={point.y} r="35" fill="#921d22" fillOpacity=".15" stroke="#921d22" strokeWidth="4" /><circle cx={point.x} cy={point.y} r="7" fill="#921d22" /></g>)}
      </svg>}</div>
      <div className="museum-campaign__steps"><div role="group" aria-label="Giai đoạn chiến dịch"><button type="button" aria-pressed={step === null} onClick={() => setStep(null)}>Toàn cảnh chiến dịch</button>{CAMPAIGN.phases.map((item, index) => <button type="button" key={item.title} aria-pressed={step === index} onClick={() => setStep(index)}><small>Đợt {index + 1} · {item.date}</small>{item.title}</button>)}</div>
        <div className="museum-phase" aria-live="polite"><h4>{phase ? phase.title : "Ba đợt tiến công"}</h4><p>{phase?.text ?? "Chọn từng đợt để theo dõi quá trình từ phá vỡ vòng ngoài, siết vòng vây đến tổng công kích. Sơ đồ gốc mô tả bố trí ban đầu, không tự thay đổi theo diễn biến."}</p>{phase && <ul>{phase.points.map(point => <li key={point.label}>{point.label}</li>)}</ul>}</div>
        <nav aria-label="Điều khiển diễn biến"><button type="button" disabled={step === null || step === 0} onClick={() => setStep(value => Math.max(0, (value ?? 0) - 1))}>← Đợt trước</button><button type="button" disabled={step === 2} onClick={() => setStep(value => value === null ? 0 : Math.min(2, value + 1))}>Đợt tiếp →</button></nav>
        <p className="history-muted">● Vùng đỏ: địa bàn đang tìm hiểu. Tên trên sơ đồ gốc sử dụng phiên âm Pháp; Eliane bao gồm khu vực A1. Không bổ sung mũi tên tấn công khi thiếu dữ liệu xác minh.</p>
      </div>
    </div>
    <div className="museum-credits"><p>Diễn biến: <a href={CAMPAIGN.sourceUrl} target="_blank" rel="noopener noreferrer">Bảo tàng Điện Biên Phủ / Cục Di sản văn hóa ↗</a> · <a href="https://tapchiqptd.vn/vi/nhung-ngay-ky-niem-lon/mot-so-hoat-dong-cua-bo-chi-huy-chien-dich-dien-bien-phu/5453.html" target="_blank" rel="noopener noreferrer">Tạp chí Quốc phòng toàn dân ↗</a></p><p>Sơ đồ: Raul654 (2005), <a href="https://commons.wikimedia.org/wiki/File:Dien_Bien_Phu_map.png" target="_blank" rel="noopener noreferrer">Wikimedia Commons ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>. Lớp đánh dấu bổ sung của website, chia sẻ theo cùng giấy phép; không thay đổi bản đồ gốc. Đối chiếu 11/11/2026.</p></div>
  </section>;
}
