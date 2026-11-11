"use client";
import { useState } from "react";
import { HistoryFilm, HistoryPhoto } from "./history-media";
import type { HistoryEvent } from "./types";
const categories = [{ id: "original", title: "Tư liệu gốc" }, { id: "documentary", title: "Phóng sự & phim tài liệu" }, { id: "drama", title: "Phim tái hiện" }] as const;
export function MediaTheater({ events, onEvent }: { events: HistoryEvent[]; onEvent: (id: string, trigger: HTMLButtonElement) => void }) {
  const [category, setCategory] = useState<typeof categories[number]["id"]>("original");
  const [filmId, setFilmId] = useState<string | null>(null);
  const photos = events.flatMap(event => event.images.map(image => ({ event, image })));
  const films = events.flatMap(event => event.videos.map(video => ({ event, video })));
  const film = films.find(item => item.video.youtubeId === filmId);
  return <section id="rap-ky-uc" className="museum-theater" aria-labelledby="museum-theater-title">
    <div className="museum-theater__heading"><p className="history-kicker">Tư liệu / Góc nhìn / Câu chuyện</p><h2 id="museum-theater-title">Rạp chiếu <em>ký ức.</em></h2><p>Xem có nguồn. Hiểu đúng thể loại.<br />Tác phẩm tái hiện không thay thế bằng chứng lịch sử.</p></div>
    <div className="museum-theater__tabs" role="group" aria-label="Loại tư liệu">{categories.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => { setCategory(item.id); setFilmId(null); }}>{item.title}</button>)}</div>
    {category === "original" && (photos.length ? <div className="museum-media-grid">{photos.map(({ event, image }) => <article key={image.src}><HistoryPhoto image={image} year={event.date.slice(0, 4)} /><span className="museum-media-kind">Ảnh tư liệu lịch sử</span><h3>{event.title}</h3><button type="button" onClick={click => onEvent(event.id, click.currentTarget)}>Khám phá sự kiện ↗</button></article>)}</div> : <p className="museum-media-empty">Chưa có ảnh tư liệu được xác minh trong bộ lọc hiện tại.</p>)}
    {category === "documentary" && (films.length ? <><div className="museum-media-grid">{films.map(({ event, video }) => <article key={video.youtubeId}>{event.images[0] && <HistoryPhoto image={event.images[0]} year={event.date.slice(0, 4)} compact />}<span className="museum-media-kind">Phóng sự hồi cố · ảnh minh họa</span><h3>{video.title}</h3><p>{video.publisher} · Đối chiếu {video.checkedAt}</p><button type="button" onClick={() => setFilmId(video.youtubeId)}>Chọn xem phóng sự</button></article>)}</div>{film && <div className="museum-screen"><p>Phóng sự nhìn lại sự kiện, không phải toàn bộ cảnh quay gốc năm 1954. Thời lượng chưa được xác minh.</p><HistoryFilm key={film.video.youtubeId} video={film.video} /></div>}</> : <p className="museum-media-empty">Chưa có phim tài liệu được xác minh trong bộ lọc hiện tại.</p>)}
    {category === "drama" && <div className="museum-media-empty"><h3>Phim tái hiện cần được đọc như tác phẩm.</h3><p>Chưa đưa phim điện ảnh vào bộ sưu tập vì chưa xác minh đủ URL phát hành và quyền nhúng. Không dùng bản tải lại không rõ quyền.</p></div>}
    <p className="museum-map-credit">Chỉ tải trình phát khi bạn yêu cầu · Không tự phát · Nguồn gốc luôn có thể mở trong tab mới.</p>
  </section>;
}
