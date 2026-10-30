import type { Metadata } from "next";
import { Passport } from "@/features/passport/passport";

export const metadata: Metadata = { title: "Hồ sơ học tập" };

export default function PassportPage() {
  return <div className="page-shell"><header className="page-intro"><p className="eyebrow">Của riêng bạn</p><h1>Hồ sơ học tập</h1></header><Passport /></div>;
}
