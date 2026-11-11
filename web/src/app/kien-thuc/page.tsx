import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { HISTORY_EVENTS } from "@/features/history/data";
import { readHistoryState } from "@/features/history/domain";
import { HistoryExplorer } from "@/features/history/history-explorer";
import "./history.css";

export const metadata: Metadata = {
  title: "Dấu Ấn Sử Việt – Hành trình qua những mốc son lịch sử",
  description: "Khám phá 20 dấu mốc lịch sử Việt Nam qua sáu giai đoạn, tư liệu có nguồn và câu hỏi ghi nhớ. Từ năm 1911 đến 2021.",
};

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["period", "q", "event", "from", "to", "place", "topic"]) if (typeof params[key] === "string") query.set(key, params[key]);
  return (
    <div className="history-page">
      <div className="history-container">
        <nav className="history-breadcrumb" aria-label="Đường dẫn kiến thức"><Link href="/live-arena"><ArrowLeft size={16} aria-hidden="true" /> Quay lại trò chơi</Link><span>Mạch Quyết Sách / Kiến thức</span></nav>
        <HistoryExplorer events={HISTORY_EVENTS} initialState={readHistoryState(query)} />
        <section className="history-editorial" aria-labelledby="history-editorial-title"><p className="history-kicker">02 / Về bộ tư liệu</p><h2 id="history-editorial-title">Lịch sử cần <em>căn cứ.</em></h2><div><p>Bộ mốc được biên soạn có AI hỗ trợ, đối chiếu bản scan Giáo trình Lịch sử Đảng Cộng sản Việt Nam (2021) do người xây dựng cung cấp cùng nguồn của bảo tàng, Quốc hội, cơ quan thông tin chính thức, ASEAN và WTO. Mỗi sự kiện ghi rõ trang và phạm vi nguồn hỗ trợ. Đây là tài liệu ôn tập bổ sung, chưa thay thế giáo trình và sự thẩm định học thuật của giảng viên.</p><p>Phạm vi dừng ở năm 2021. Số trang giáo trình được xác nhận trực tiếp trên ảnh scan; điểm khác biệt giữa các nguồn được chú thích riêng. Ảnh chỉ xuất hiện khi có hồ sơ nguồn và điều kiện sử dụng; các mốc khác dùng tư liệu chữ.</p></div><Link href="/nguon-va-ai">Nguyên tắc nguồn & AI <ArrowRight size={16} aria-hidden="true" /></Link></section>
        <section className="history-return"><div><p className="history-kicker">Tiếp nối hành trình</p><h2>Đã hiểu mạch chuyện?<br />Thử một quyết định.</h2></div><Link href="/khoanh-khac" className="history-button">Quay lại trò chơi <ArrowRight size={18} aria-hidden="true" /></Link></section>
      </div>
    </div>
  );
}
