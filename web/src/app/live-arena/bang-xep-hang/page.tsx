import type { Metadata } from "next";

import { LiveBoardsPage } from "@/features/arena/ui/live-boards";

export const metadata: Metadata = { title: "Bảng xếp hạng Live Arena" };

export default function LeaderboardsPage() {
  return (
    <div className="page-shell arena-page">
      <header className="page-intro">
        <p className="eyebrow">Live Arena · Trực tiếp</p>
        <h1>Hai bảng xếp hạng</h1>
        <p>Top 10 của từng game, cập nhật sau mỗi câu. Đồng hạng khi bằng nhau mọi tiêu chí.</p>
      </header>
      <LiveBoardsPage />
    </div>
  );
}
