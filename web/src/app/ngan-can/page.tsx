import type { Metadata } from "next";

import { CrisisGame } from "@/features/crisis/crisis-game";

export const metadata: Metadata = {
  title: "Ngàn Cân Treo Sợi Tóc",
  description:
    "Lèo lái chính quyền cách mạng non trẻ qua khủng hoảng 1945–1946. Sáu quyết định có thật, ba thanh trạng thái, đối chiếu với đường lối của Đảng.",
};

export default function NganCanPage() {
  return (
    <div className="page-shell crisis-page">
      <CrisisGame />
    </div>
  );
}
