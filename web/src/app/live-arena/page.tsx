import type { Metadata } from "next";

import { ArenaHub } from "@/features/arena/ui/arena-hub";

export const metadata: Metadata = { title: "Live Arena" };

export default function LiveArenaPage() {
  return (
    <div className="page-shell arena-page">
      <header className="page-intro">
        <p className="eyebrow">Live Arena</p>
        <h1>Hai game. Hai bảng xếp hạng.</h1>
        <p>Mỗi bạn có một lượt cho mỗi game trong một cuộc thi. Máy chủ chấm điểm và tính giờ; đáp án chỉ mở sau khi cuộc thi kết thúc.</p>
      </header>
      <ArenaHub />
    </div>
  );
}
