"use client";

import { ArrowLeft, ArrowRight, BookOpen, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterHistory, HISTORY_PERIODS, historyUrl, readHistoryState, type HistoryState } from "./domain";
import { HistoryPhoto, HistoryFilm } from "./history-media";
import { HistoryQuiz } from "./history-quiz";
import type { HistoryEvent } from "./types";
import { TEXTBOOK, TEXTBOOK_REFERENCES } from "./textbook";
import { MuseumWorld } from "./museum-world";
import { MediaTheater } from "./media-theater";
import { BattleMap } from "./battle-map";
import { PhotoComparison } from "./photo-comparison";
import { EVENT_GEOGRAPHY, LOCATIONS, TOPICS } from "./museum-data";
import { filterMuseum } from "./museum-domain";

export function HistoryExplorer({ events, initialState }: { events: HistoryEvent[]; initialState: HistoryState }) {
  const [state, setState] = useState(initialState);
  const [targetId, setTargetId] = useState<string | null>(initialState.eventId ? EVENT_GEOGRAPHY[initialState.eventId]?.locationIds[0] ?? null : null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const periodsRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const filtered = useMemo(() => filterMuseum(filterHistory(events, state.period, state.query), state), [events, state]);
  const activeIndex = filtered.findIndex(event => event.id === state.eventId);
  const active = filtered[activeIndex];
  const textbookReference = active ? TEXTBOOK_REFERENCES[active.id] : undefined;
  const selectedPeriod = HISTORY_PERIODS.find(period => period.id === state.period);

  function update(next: HistoryState, push = false) {
    setState(next);
    window.history[push ? "pushState" : "replaceState"](null, "", historyUrl(next));
  }

  useEffect(() => {
    const onPop = () => {
      const next = readHistoryState(new URLSearchParams(window.location.search));
      setState(next);
      if (next.eventId) setTargetId(EVENT_GEOGRAPHY[next.eventId]?.locationIds[0] ?? null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const strip = periodsRef.current;
    const selected = strip?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (strip && selected && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft += selected.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - selected.clientWidth) / 2;
    }
  }, [state.period]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && !dialog.open) dialog.showModal();
    if (!active && dialog.open) {
      dialog.close();
      returnFocus.current?.focus();
    }
    if (active) dialog.scrollTop = 0;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [active]);

  const close = () => update({ ...state, eventId: null });
  function openEvent(id: string, trigger: HTMLButtonElement) {
    returnFocus.current = trigger;
    selectEvent(id, true);
  }
  function selectEvent(id: string, push = false) {
    setTargetId(EVENT_GEOGRAPHY[id]?.locationIds[0] ?? null);
    update({ ...state, eventId: id }, push);
  }
  function year(key: "from" | "to", value: string) {
    const number = Number(value);
    if (value && (!Number.isInteger(number) || number < 1800 || number > 2100)) return;
    const next = { ...state, [key]: value ? number : undefined, eventId: null };
    if (next.from && next.to && next.from > next.to) {
      if (key === "from") next.to = next.from; else next.from = next.to;
    }
    update(next);
  }

  return (
    <>
      <MuseumWorld events={filtered} targetId={targetId} onTarget={setTargetId} onEvent={openEvent} />
      <nav className="museum-room-nav" aria-label="Các phòng khám phá"><a href="#dong-thoi-gian">01 / Dòng thời gian</a><a href="#rap-ky-uc">02 / Rạp ký ức</a><a href="#khung-anh">03 / Xưa & sau này</a></nav>
      <section id="dong-thoi-gian" className="history-explorer" aria-labelledby="history-timeline-title">
        <div className="history-section-heading">
          <div><p className="history-kicker">01 / Theo dòng lịch sử</p><h2 id="history-timeline-title">Đi qua những <em>bước ngoặt.</em></h2></div>
          <p>Không chỉ nhớ một ngày tháng.<br />Hiểu điều gì dẫn tới một quyết định.</p>
        </div>
        <div className="history-explorer__layout">
          <aside className="history-filter" aria-label="Bộ lọc lịch sử">
            <p className="history-kicker">Chọn giai đoạn</p>
            <div ref={periodsRef} className="history-periods" role="group" aria-label="Lọc theo giai đoạn">
              <button type="button" aria-pressed={state.period === "all"} onClick={() => update({ ...state, period: "all", eventId: null })}><span>Toàn bộ hành trình</span><small>{events.length} dấu mốc · 1911–2021</small></button>
              {HISTORY_PERIODS.map((period, index) => (
                <button key={period.id} type="button" aria-pressed={state.period === period.id} onClick={() => update({ ...state, period: period.id, eventId: null })}>
                  <span><b>{String(index + 1).padStart(2, "0")}</b> {period.years}</span><small>{period.title}</small>
                </button>
              ))}
            </div>
            <div className="history-filter__note"><BookOpen size={22} aria-hidden="true" /><p>Mỗi mốc gồm bối cảnh, diễn biến, ý nghĩa và một câu hỏi để tự nhớ lại.</p></div>
          </aside>
          <div className="history-results">
            <label className="history-search"><Search size={20} aria-hidden="true" /><span className="sr-only">Tìm kiếm lịch sử</span><input type="search" value={state.query} maxLength={160} placeholder="Tìm năm, nhân vật, chiến dịch…" onChange={event => update({ ...state, query: event.target.value, eventId: null })} /></label>
            <div className="museum-filters"><label>Địa điểm<select aria-label="Địa điểm" value={state.locationId ?? ""} onChange={event => update({ ...state, locationId: event.target.value || undefined, eventId: null })}><option value="">Mọi địa điểm</option>{LOCATIONS.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label>Chủ đề<select aria-label="Chủ đề" value={state.topic ?? ""} onChange={event => update({ ...state, topic: event.target.value || undefined, eventId: null })}><option value="">Mọi chủ đề</option>{TOPICS.map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label><label>Từ năm<select aria-label="Từ năm" value={state.from ?? ""} onChange={event => year("from", event.target.value)}><option value="">Không giới hạn</option>{Array.from({ length: 111 }, (_, i) => 1911 + i).map(n => <option key={n}>{n}</option>)}</select></label><label>Đến năm<select aria-label="Đến năm" value={state.to ?? ""} onChange={event => year("to", event.target.value)}><option value="">Không giới hạn</option>{Array.from({ length: 111 }, (_, i) => 1911 + i).map(n => <option key={n}>{n}</option>)}</select></label></div>
            <label className="museum-year-scrubber">Đi tới năm <output>{state.from !== undefined && state.from === state.to ? state.from : "1911—2021"}</output><input aria-label="Chọn năm trên thanh thời gian" type="range" min="1911" max="2021" value={state.from ?? 1911} onChange={event => update({ ...state, from: Number(event.target.value), to: Number(event.target.value), eventId: null })} /></label>
            <div className="history-result-bar"><p role="status">{filtered.length} / {events.length} dấu mốc{selectedPeriod ? ` · ${selectedPeriod.years}` : " · Toàn bộ hành trình"}</p>{(state.query || state.period !== "all" || state.from || state.to || state.locationId || state.topic) && <button className="history-text-button" type="button" onClick={() => update({ period: "all", query: "", eventId: null })}>Xóa bộ lọc</button>}</div>
            {state.eventId && !active && <p className="history-empty" role="status">Sự kiện không có trong kết quả hiện tại. Hãy xóa bộ lọc để khám phá tiếp.</p>}
            {filtered.length === 0 ? (
              <div className="history-empty"><Search size={32} aria-hidden="true" /><h3>Chưa tìm thấy dấu mốc</h3><p>Thử một năm, tên nhân vật hoặc từ khóa khác. Bạn có thể gõ không dấu.</p><button className="history-button" type="button" onClick={() => update({ period: "all", query: "", eventId: null })}>Xóa bộ lọc và xem tất cả</button></div>
            ) : (
              <ol className="history-timeline" aria-label="Các sự kiện theo thời gian">
                {filtered.map((event, index) => (
                  <li key={event.id} className="history-timeline__item">
                    <span className="history-timeline__year" aria-hidden="true">{event.date.slice(0, 4)}<i /></span>
                    <article className="history-event-card">
                      {event.images[0] && <HistoryPhoto image={event.images[0]} year={event.date.slice(0, 4)} compact />}
                      <div className="history-event-card__body">
                        <div className="history-event-card__meta"><time dateTime={event.date}>{event.dateLabel}</time><span>{String(index + 1).padStart(2, "0")} / {String(filtered.length).padStart(2, "0")}</span></div>
                        <h3>{event.title}</h3><p>{event.summary}</p>
                        <div className="history-event-card__foot"><button type="button" className="history-discover" aria-label={`Khám phá sự kiện: ${event.title}`} onClick={click => openEvent(event.id, click.currentTarget)}>Khám phá sự kiện<ArrowRight size={17} aria-hidden="true" /></button><span>{event.images.length ? "Ảnh & tư liệu" : "Tư liệu chữ"} · ~2 phút</span></div>
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>
      <MediaTheater events={filtered} onEvent={openEvent} />
      <div id="khung-anh"><PhotoComparison /></div>
      <dialog ref={dialogRef} className="history-dialog" aria-labelledby="history-event-title" onCancel={event => { event.preventDefault(); close(); }}>
        {active && <>
          <div className="history-dialog__bar"><p className="history-kicker">Dấu mốc {active.dateLabel}</p><button type="button" className="history-icon-button" autoFocus onClick={close} aria-label="Đóng chi tiết sự kiện"><X size={23} aria-hidden="true" /></button></div>
          <div className="history-dialog__content" key={active.id}>
            <h2 id="history-event-title">{active.title}</h2>
            <p className="history-dialog__summary">{active.summary}</p>
            <div className="museum-event-actions"><button type="button" onClick={() => { setTargetId(EVENT_GEOGRAPHY[active.id]?.locationIds[0] ?? null); close(); requestAnimationFrame(() => document.getElementById("ban-do-ky-uc")?.scrollIntoView({ behavior: "instant" })); }}>Xem trên địa cầu</button>{active.id === "1954-dien-bien" && <button type="button" onClick={() => dialogRef.current?.querySelector(".museum-campaign")?.scrollIntoView({ behavior: "instant" })}>Xem diễn biến trên bản đồ</button>}<button type="button" onClick={() => { close(); requestAnimationFrame(() => document.getElementById("rap-ky-uc")?.scrollIntoView({ behavior: "instant" })); }}>Mở rạp tư liệu</button><Link href={`/kien-thuc/thu-thach?event=${active.id}&return=${encodeURIComponent(historyUrl(state))}`}>Thử thách kiến thức ↗</Link></div>
            <dl className="history-facts"><div><dt>Thời gian</dt><dd>{active.dateLabel}</dd></div><div><dt>Địa điểm</dt><dd>{active.location || "Chưa có thông tin địa điểm"}</dd></div>{active.people.length > 0 && <div><dt>Nhân vật liên quan</dt><dd>{active.people.join(" · ")}</dd></div>}</dl>
            <div className="history-knowledge-grid">{([
              ["01", "Bối cảnh / nguyên nhân", active.context], ["02", "Diễn biến / nội dung chính", active.keyDevelopments], ["03", "Kết quả và ý nghĩa", active.significance],
            ] as const).map(([number, title, bullets]) => <section key={number}><span className="history-kicker">{number}</span><h3>{title}</h3><ul>{bullets.length ? bullets.map(bullet => <li key={bullet}>{bullet}</li>) : <li>Nội dung đang được bổ sung.</li>}</ul></section>)}</div>
            <section className="history-memory"><p className="history-kicker">Góc ghi nhớ</p><h3>{active.takeaway}</h3><ul className="history-tags" aria-label="Từ khóa quan trọng">{active.keywords.map(word => <li key={word}>{word}</li>)}</ul><p>{active.remember}</p></section>
            {active.id === "1954-dien-bien" && <BattleMap />}
            <section className="history-materials" aria-labelledby="history-materials-title"><p className="history-kicker">Đọc có căn cứ</p><h3 id="history-materials-title">Tư liệu & nguồn tham khảo</h3><HistoryPhoto image={active.images[0]} year={active.date.slice(0, 4)} />
              {active.videos.length ? active.videos.map(video => <HistoryFilm key={video.youtubeId} video={video} />) : <p className="history-muted">Chưa có video được xác minh quyền nhúng cho mốc này. Bạn có thể đọc tư liệu gốc bên dưới.</p>}
              <div className="history-textbook" aria-label="Nguồn giáo trình">
                <p className="history-kicker">Giáo trình chính · Bản scan đã đối chiếu</p>
                <h4>{TEXTBOOK.title} ({TEXTBOOK.year})</h4>
                <p className="history-muted">{TEXTBOOK.author} · {TEXTBOOK.publisher} · ISBN {TEXTBOOK.isbn} · Chương {active.textbookChapter}.</p>
                {textbookReference ? <>
                  <p><strong>Trang in: {textbookReference.pages[0]}{textbookReference.pages.length > 1 ? `–${textbookReference.pages.at(-1)}` : ""}</strong> · Thứ tự trang PDF tương ứng: {textbookReference.pdfPages[0]}{textbookReference.pdfPages.length > 1 ? `–${textbookReference.pdfPages.at(-1)}` : ""}.</p>
                  <p className="history-muted">Phạm vi đối chiếu: {textbookReference.scope}</p>
                  {textbookReference.note && <p className="history-textbook__note">{textbookReference.note} <a href="https://www.wto.org/english/thewto_e/acc_e/a1_vietnam_e.htm" target="_blank" rel="noopener noreferrer">Xem hồ sơ WTO ↗</a></p>}
                </> : <p className="history-muted">Mốc này chưa được đối chiếu trang cụ thể trong bản scan; dùng các nguồn bổ sung bên dưới để kiểm tra.</p>}
              </div>
              <ul className="history-sources">{active.sources.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a><span>{item.publisher} · Đối chiếu {item.checkedAt}</span><p>{item.scope}</p></li>)}</ul>
              {!active.sources.length && <p>Nguồn đang được bổ sung; chưa dùng nội dung này để ôn tập.</p>}
              <p className="history-muted">Bản tóm tắt được diễn giải từ giáo trình và các nguồn bổ sung. Số trang chỉ hỗ trợ phạm vi ghi rõ ở trên; việc đối chiếu bản scan không thay thế thẩm định học thuật của giảng viên.</p>
            </section>
            <HistoryQuiz key={active.id} questions={active.quiz} />
            <div className="history-dialog__practice"><div><p className="history-kicker">Từ hiểu đến nhớ</p><h3>Mang kiến thức vào trò chơi.</h3><p>Luyện sắp xếp sự kiện trong chế độ tự do hiện có.</p></div><Link className="history-button" href="/live-arena/dong-chay-lich-su">Luyện tập kiến thức <ArrowRight size={18} aria-hidden="true" /></Link></div>
          </div>
          <nav className="history-dialog__nav" aria-label="Chuyển sự kiện"><button type="button" disabled={activeIndex <= 0} onClick={() => selectEvent(filtered[activeIndex - 1].id)}><ArrowLeft size={17} aria-hidden="true" /> Sự kiện trước</button><span>{activeIndex + 1} / {filtered.length}</span><button type="button" disabled={activeIndex >= filtered.length - 1} onClick={() => selectEvent(filtered[activeIndex + 1].id)}>Sự kiện tiếp theo <ArrowRight size={17} aria-hidden="true" /></button></nav>
        </>}
      </dialog>
    </>
  );
}
