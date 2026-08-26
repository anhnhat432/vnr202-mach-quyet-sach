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
        <p>Mỗi quyết định lịch sử là một chuỗi sáu lớp: bối cảnh → mâu thuẫn → lực lượng → quyết sách → kết quả → bài học. Chọn một trường hợp để đọc trọn mạch.</p>
      </header>
      <CauseMap nodes={data.nodes} edges={data.edges} />
    </div>
  );
}
