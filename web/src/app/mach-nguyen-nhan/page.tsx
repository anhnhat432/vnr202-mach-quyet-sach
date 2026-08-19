import type { Metadata } from "next";

import { getCauseMapData } from "@/features/content/server/local-content";
import { CauseMap } from "@/features/content/ui/cause-map";

export const metadata: Metadata = { title: "Mạch Nguyên Nhân" };

export default function CauseMapPage() {
  const data = getCauseMapData();
  return (
    <div className="page-shell knowledge-page">
      <header className="page-intro page-intro--wide">
        <p className="eyebrow">Mạch Nguyên Nhân · trước 1930-nay</p>
        <h1>Sáu lớp của một chuyển động lịch sử</h1>
        <p>Chọn một node để đọc điều kiện, phản ứng, hệ quả và bài học nối tiếp nhau. Trên mobile, bản đồ tự chuyển thành lát cắt có thể đọc.</p>
      </header>
      <CauseMap nodes={data.nodes} edges={data.edges} />
    </div>
  );
}
