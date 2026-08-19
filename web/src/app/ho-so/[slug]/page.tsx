import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublishedDossierBySlug } from "@/features/content/server/dossier-repository";
import { ScenarioEngine } from "@/features/content/ui/scenario-engine";

type DossierRouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: DossierRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const dossier = await getPublishedDossierBySlug(slug);
  return dossier ? { title: dossier.title, description: dossier.centralQuestion } : { title: "Không tìm thấy hồ sơ" };
}

export default async function DossierPage({ params }: DossierRouteProps) {
  const { slug } = await params;
  const dossier = await getPublishedDossierBySlug(slug);
  if (!dossier) notFound();

  return (
    <div className="page-shell dossier-detail">
      <header className="dossier-detail__header">
        <p className="eyebrow">Hồ sơ #{String(dossier.orderIndex).padStart(2, "0")} · {dossier.experience.briefing.period}</p>
        <h1>{dossier.title}</h1>
        <p>{dossier.centralQuestion}</p>
      </header>
      <ScenarioEngine dossierId={dossier.id} dossierSlug={dossier.slug} experience={dossier.experience} />
    </div>
  );
}
