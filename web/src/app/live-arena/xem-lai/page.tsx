import type { Metadata } from "next";

import { MyReview } from "@/features/arena/ui/my-review";

export const metadata: Metadata = { title: "Xem lại lượt thi" };

export default function ReviewPage() {
  return (
    <div className="page-shell arena-page">
      <header className="page-intro">
        <p className="eyebrow">Live Arena · Của riêng bạn</p>
        <h1>Xem lại lượt thi</h1>
        <p>Đáp án, giải thích và nguồn mở sau khi giảng viên kết thúc cuộc thi, chỉ cho những câu bạn đã thấy.</p>
      </header>
      <MyReview />
    </div>
  );
}
