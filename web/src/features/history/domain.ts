import { z } from "zod";

export const HISTORY_PERIODS = [
  { id: "before-1930", years: "Trước 1930", title: "Tìm đường & chuẩn bị", note: "Bối cảnh và quá trình chuẩn bị thành lập Đảng" },
  { id: "1930-1945", years: "1930–1945", title: "Đấu tranh giành chính quyền", note: "Thành lập Đảng và Cách mạng Tháng Tám" },
  { id: "1945-1954", years: "1945–1954", title: "Giữ vững nền độc lập", note: "Kháng chiến chống thực dân Pháp" },
  { id: "1954-1975", years: "1954–1975", title: "Đường tới thống nhất", note: "Kháng chiến chống Mỹ, cứu nước" },
  { id: "1975-1986", years: "1975–1986", title: "Kiến thiết sau chiến tranh", note: "Xây dựng, bảo vệ Tổ quốc và trước Đổi mới" },
  { id: "1986-2021", years: "1986–2021", title: "Đổi mới & hội nhập", note: "Phát triển đất nước và mở rộng hợp tác" },
] as const;

export type HistoryPeriod = typeof HISTORY_PERIODS[number]["id"];
export type HistoryState = { period: HistoryPeriod | "all"; query: string; eventId: string | null };

const historyStateSchema = z.object({
  period: z.enum(["all", ...HISTORY_PERIODS.map(period => period.id)]).catch("all"),
  query: z.string().transform(value => value.slice(0, 160)),
  eventId: z.string().regex(/^[a-z0-9-]{1,80}$/).nullable().catch(null),
});

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
}

type SearchableEvent = { id: string; date: string; dateLabel?: string; period: string; title: string; summary: string; people: readonly string[]; location: string; keywords: readonly string[] };

export function filterHistory<T extends SearchableEvent>(events: readonly T[], period: string, query: string): T[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return events.filter(event => {
    if (period !== "all" && event.period !== period) return false;
    const text = normalizeSearch([event.date, event.dateLabel, event.title, event.summary, event.location, ...event.people, ...event.keywords].join(" "));
    return terms.every(term => text.includes(term));
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function readHistoryState(params: URLSearchParams): HistoryState {
  return historyStateSchema.parse({ period: params.get("period"), query: params.get("q") ?? "", eventId: params.get("event") });
}

export function historyUrl(state: HistoryState): string {
  const params = new URLSearchParams();
  if (state.period !== "all") params.set("period", state.period);
  if (state.query) params.set("q", state.query);
  if (state.eventId) params.set("event", state.eventId);
  return `/kien-thuc${params.size ? `?${params}` : ""}`;
}
