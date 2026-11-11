import Link from "next/link";
import { notFound } from "next/navigation";
import { HISTORY_EVENTS } from "@/features/history/data";
import { HistoryQuiz } from "@/features/history/history-quiz";
import { historyUrl, readHistoryState } from "@/features/history/domain";
import "../history.css";

export const metadata = { title: "Thử thách kiến thức · Dấu Ấn Sử Việt" };
export default async function HistoryChallenge({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const event = HISTORY_EVENTS.find(e => e.id === params.event);
  if (!event) notFound();
  // Accept only a museum-relative route, rebuild its query with the same validator.
  const returnPath = typeof params.return === "string" && /^\/kien-thuc(?:\?|$)/.test(params.return) ? params.return : "/kien-thuc";
  const state = readHistoryState(new URLSearchParams(returnPath.split("?")[1] ?? ""));
  const back = historyUrl({ ...state, eventId: event.id });
  return <div className="history-page"><div className="history-container museum-challenge"><p className="history-kicker">Nhiệm vụ kiến thức · Luyện nhớ, không tính điểm</p><h1>{event.title}</h1><p>Thử nhớ lại sự kiện vừa khám phá. Câu hỏi dùng chung với phần kiểm tra nhanh; kết quả không ghi vào cuộc thi hay bảng xếp hạng.</p><HistoryQuiz questions={event.quiz} /><div className="museum-credits"><h2>Đối chiếu đáp án</h2>{event.sources.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a> · {source.publisher}</p>)}</div><Link className="history-button" href={back}>← Quay lại đúng sự kiện vừa học</Link><p><Link href="/live-arena/dong-chay-lich-su">Tiếp tục game Dòng Chảy Lịch Sử →</Link></p></div></div>;
}
