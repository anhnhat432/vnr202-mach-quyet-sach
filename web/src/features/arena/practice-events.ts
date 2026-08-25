// Practice dataset for Game 01 "Dòng Chảy Lịch Sử" (client-only practice mode).
// These are factual, uncontroversial calendar milestones taught in VNR202,
// not academic interpretation, so they carry no publication/review gate.
// The official Live Arena competition (server-authoritative, one attempt,
// real leaderboards) remains a separate Phase 4-5 concern.

export type TimelineEvent = {
  id: string;
  /** Sort key: year plus month fraction, so same-year events still order correctly. */
  sortKey: number;
  /** Short date shown on the card and in the reveal. */
  dateLabel: string;
  title: string;
  chapter: 1 | 2 | 3;
};

export const timelineEvents: readonly TimelineEvent[] = [
  // Chương 1 · Tìm đường và giành chính quyền
  { id: "ev-1911", sortKey: 1911.42, dateLabel: "5/6/1911", title: "Nguyễn Tất Thành ra đi tìm đường cứu nước", chapter: 1 },
  { id: "ev-1920", sortKey: 1920.99, dateLabel: "1920", title: "Nguyễn Ái Quốc đọc Sơ thảo Luận cương của Lê-nin", chapter: 1 },
  { id: "ev-1925", sortKey: 1925.5, dateLabel: "6/1925", title: "Thành lập Hội Việt Nam Cách mạng Thanh niên", chapter: 1 },
  { id: "ev-1930", sortKey: 1930.09, dateLabel: "3/2/1930", title: "Đảng Cộng sản Việt Nam ra đời", chapter: 1 },
  { id: "ev-1941", sortKey: 1941.42, dateLabel: "5/1941", title: "Hội nghị Trung ương 8, thành lập Mặt trận Việt Minh", chapter: 1 },
  { id: "ev-1945", sortKey: 1945.67, dateLabel: "2/9/1945", title: "Tuyên ngôn Độc lập, khai sinh nước Việt Nam DCCH", chapter: 1 },

  // Chương 2 · Giữ nước và thống nhất
  { id: "ev-1946", sortKey: 1946.96, dateLabel: "19/12/1946", title: "Lời kêu gọi Toàn quốc kháng chiến", chapter: 2 },
  { id: "ev-1954-dbp", sortKey: 1954.35, dateLabel: "7/5/1954", title: "Chiến thắng Điện Biên Phủ", chapter: 2 },
  { id: "ev-1954-geneve", sortKey: 1954.55, dateLabel: "21/7/1954", title: "Ký kết Hiệp định Genève", chapter: 2 },
  { id: "ev-1968", sortKey: 1968.08, dateLabel: "Xuân 1968", title: "Tổng tiến công và nổi dậy Tết Mậu Thân", chapter: 2 },
  { id: "ev-1973", sortKey: 1973.07, dateLabel: "27/1/1973", title: "Ký kết Hiệp định Paris", chapter: 2 },
  { id: "ev-1975", sortKey: 1975.33, dateLabel: "30/4/1975", title: "Giải phóng miền Nam, thống nhất đất nước", chapter: 2 },

  // Chương 3 · Đổi mới và phát triển
  { id: "ev-1976", sortKey: 1976.5, dateLabel: "1976", title: "Tổng tuyển cử thống nhất, đổi tên nước CHXHCN Việt Nam", chapter: 3 },
  { id: "ev-1986", sortKey: 1986.96, dateLabel: "12/1986", title: "Đại hội VI khởi xướng công cuộc Đổi mới", chapter: 3 },
  { id: "ev-1995", sortKey: 1995.58, dateLabel: "1995", title: "Gia nhập ASEAN, bình thường hóa quan hệ Việt - Mỹ", chapter: 3 },
  { id: "ev-2007", sortKey: 2007.01, dateLabel: "1/2007", title: "Việt Nam gia nhập Tổ chức Thương mại Thế giới (WTO)", chapter: 3 },
];

/** Pick `count` distinct events at random and return them in a shuffled order. */
export function sampleRound(count: number): TimelineEvent[] {
  const pool = [...timelineEvents];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
