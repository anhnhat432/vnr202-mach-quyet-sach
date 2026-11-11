"use client";
import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_GEOGRAPHY, LOCATIONS } from "./museum-data";
import type { HistoryEvent } from "./types";

const Globe = dynamic(() => import("./history-globe"), { ssr: false, loading: () => <div className="museum-globe-loading" role="status">Đang tải không gian 3D…</div> });
class GlobeBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
export function MuseumWorld({ events, targetId, onTarget, onEvent }: { events: HistoryEvent[]; targetId: string | null; onTarget: (id: string) => void; onEvent: (id: string, trigger: HTMLButtonElement) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const section = useRef<HTMLElement>(null);
  const locations = useMemo(() => LOCATIONS.filter(l => events.some(e => EVENT_GEOGRAPHY[e.id]?.locationIds.includes(l.id))), [events]);
  const place = locations.find(l => l.id === targetId);
  const localEvents = place ? events.filter(e => EVENT_GEOGRAPHY[e.id]?.locationIds.includes(place.id)) : [];
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setEnabled(true); observer.disconnect(); } }, { rootMargin: "100px" });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);
  return <section ref={section} id="ban-do-ky-uc" className="museum-world" aria-labelledby="museum-world-title">
    <div className="museum-world__heading"><p className="history-kicker">Bảo tàng số / 1911—2021 / 06 giai đoạn</p><h1 id="museum-world-title">Dấu ấn <em>Sử Việt.</em></h1><p className="museum-tagline">Hành trình qua những mốc son lịch sử</p><p>Từ Việt Nam đến những điểm hẹn trên thế giới. Chọn một địa điểm để bắt đầu.<br /><a href="#dong-thoi-gian">Khám phá dòng thời gian ↓</a> <a href="#rap-ky-uc">Bước vào rạp ký ức ↗</a></p></div>
    <div className="museum-world__layout">
      <div className="museum-world__stage">{enabled && !failed ? <GlobeBoundary onFailure={() => setFailed(true)}><Globe locations={locations} targetId={targetId} onPick={onTarget} onFailure={() => setFailed(true)} /></GlobeBoundary> : <div className="museum-globe-loading" role="status">{failed ? "Không gian 3D không khả dụng. Khám phá bằng danh sách địa điểm bên cạnh." : "Địa cầu sẽ tải khi bạn đến khu vực này."}</div>}<button type="button" className="museum-fallback-toggle" onClick={() => { setFailed(value => !value); setEnabled(true); }}>{failed ? "Thử tải địa cầu 3D" : "Dùng danh sách thay 3D"}</button></div>
      <aside className="museum-place-panel" aria-label="Địa điểm và sự kiện"><p className="history-kicker">{locations.length} địa điểm · {events.length} dấu mốc</p><div className="museum-place-list">{locations.map(location => <button type="button" key={location.id} aria-pressed={location.id === targetId} onClick={() => onTarget(location.id)}>{location.name}<span>{events.filter(e => EVENT_GEOGRAPHY[e.id]?.locationIds.includes(location.id)).length}</span></button>)}</div>{!locations.length && <p>Không có địa điểm trong bộ lọc này.</p>}
        {place ? <div className="museum-place-detail"><h3>{place.name}</h3><p>{place.country} · {place.latitude.toFixed(3)}°, {place.longitude.toFixed(3)}°</p><p>{place.precision}. <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">Nguồn tọa độ ↗</a></p><ul>{localEvents.map(event => <li key={event.id}><button type="button" onClick={click => onEvent(event.id, click.currentTarget)}><time>{event.dateLabel}</time>{event.title} <span aria-hidden="true">↗</span></button>{EVENT_GEOGRAPHY[event.id]?.note && <small>{EVENT_GEOGRAPHY[event.id].note}</small>}</li>)}</ul></div> : <p className="museum-place-hint">Chọn điểm sáng trên địa cầu hoặc tên địa điểm để xem các sự kiện liên quan.</p>}
      </aside>
    </div><p className="museum-map-credit">Made with Natural Earth · Public domain · Bề mặt lục địa giản lược, không thể hiện ranh giới chính trị. <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Nguồn bản đồ ↗</a></p>
  </section>;
}
