import type { Metadata } from "next";
import Link from "next/link";

import { TimelineGame } from "@/features/arena/timeline-game";

export const metadata: Metadata = {
  title: "Dòng Chảy Lịch Sử · Luyện tập",
  description: "Xếp các mốc lịch sử Việt Nam theo đúng dòng thời gian trong chế độ luyện tập của Live Arena.",
};

export default function TimelineGamePage() {
  return (
    <div className="page-shell game-page">
      <header className="page-intro page-intro--wide">
        <p className="eyebrow">Live Arena · Game 01 · Chế độ luyện tập</p>
        <h1>Dòng Chảy Lịch Sử</h1>
        <p>
          Sắp xếp các sự kiện theo đúng thứ tự thời gian. Chế độ luyện tập chạy ngay trên trình duyệt, không tính vào
          cuộc thi chính thức và không cần đăng nhập.
        </p>
        <Link className="text-link" href="/live-arena">
          ← Trở lại Live Arena
        </Link>
      </header>
      <TimelineGame />
    </div>
  );
}
