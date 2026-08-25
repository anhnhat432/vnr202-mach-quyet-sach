import type { Metadata } from "next";

import { GioGVote } from "@/features/moments/gio-g-vote";

export const metadata: Metadata = {
  title: "Bỏ phiếu Giờ G",
  description: "Bỏ phiếu trực tiếp cho khoảnh khắc đang chiếu trên màn hình lớp.",
};

export default function GioGVotePage() {
  return (
    <div className="page-shell vote-page">
      <GioGVote />
    </div>
  );
}
