import type { Metadata } from "next";
import { Passport } from "@/features/passport/passport";
import { getPlannedDossiers } from "@/features/content/server/dossier-repository";

export const metadata: Metadata = { title: "Hồ sơ học tập" };

export default function PassportPage() {
  const dossiers = getPlannedDossiers().map((d) => d.status === "published" ? d : { ...d, title: `Hồ sơ ${String(d.orderIndex).padStart(2, "0")}`, slug: "", centralQuestion: "" });
  return <div className="page-shell"><header className="page-intro passport-header"><p className="eyebrow">Của riêng bạn</p><h1>Hồ sơ học tập</h1></header><Passport dossiers={dossiers} /></div>;
}
