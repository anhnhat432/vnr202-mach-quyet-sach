import type { Metadata } from "next";

import { GioGHost } from "@/features/moments/gio-g";

export const metadata: Metadata = {
  title: "Giờ G — Đấu trường Quyết Sách",
  description: "Chế độ dẫn cho cả lớp: chiếu một khoảnh khắc lịch sử lên màn hình, đếm phiếu giơ tay, rồi lật bài so với lịch sử.",
};

export default function GioGPage() {
  return (
    <div className="page-shell giog-page">
      <header className="page-intro page-intro--wide">
        <p className="eyebrow">Giờ G · chế độ dẫn cả lớp · máy chiếu</p>
        <h1>Đấu trường Quyết Sách</h1>
        <p>Chiếu một khoảnh khắc lên màn hình, cả lớp bỏ phiếu, rồi cùng lật bài — xem lớp có nghĩ giống lịch sử không.</p>
      </header>
      <GioGHost />
    </div>
  );
}
