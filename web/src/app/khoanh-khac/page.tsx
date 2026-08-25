import type { Metadata } from "next";

import { DecisionMomentPlayer } from "@/features/moments/decision-moment";

export const metadata: Metadata = {
  title: "Khoảnh khắc Quyết Sách",
  description: "Chạm chọn một quyết định lịch sử, xem bạn có nghĩ giống lịch sử không. Vui, nhẹ, không cần đăng nhập.",
};

export default function KhoanhKhacPage() {
  return (
    <div className="page-shell moment-page">
      <header className="page-intro">
        <p className="eyebrow">Chơi ngay · không cần đăng nhập</p>
        <h1>Bạn sẽ quyết sao?</h1>
        <p>
          Ngồi vào ghế người ra quyết định ở những khúc ngoặt của Lịch sử Đảng. Chạm một lựa chọn, rồi xem bạn có
          nghĩ giống lịch sử không — và vì sao.
        </p>
      </header>
      <DecisionMomentPlayer />
    </div>
  );
}
