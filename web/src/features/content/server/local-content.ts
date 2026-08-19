import { z } from "zod";

import seed from "@/generated/phase-1-seed.json";

import {
  chapterSchema,
  dossierExperienceSchema,
  postgresUuidSchema,
  type DossierSummary,
  type PublishedDossier,
} from "@/features/content/contracts/dossier";

const sourceRecordSchema = z.object({
  id: postgresUuidSchema,
  title: z.string().min(2),
  authorOrIssuer: z.string().min(2),
  publicationYear: z.number().int(),
  locator: z.string(),
  url: z.url().nullable(),
  sourceType: z.string().min(2),
  rightsNote: z.string(),
  verificationStatus: z.enum(["pending", "verified"]),
});

const dossierSchema = z.object({
  id: postgresUuidSchema,
  versionId: postgresUuidSchema.optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  chapter: chapterSchema,
  orderIndex: z.number().int().min(1).max(15),
  title: z.string().min(2),
  centralQuestion: z.string().min(10),
  status: z.enum(["draft", "reviewed", "published"]),
  experience: dossierExperienceSchema.optional(),
});

const parsedSeed = z
  .object({
    sources: z.array(sourceRecordSchema).min(1),
    dossiers: z.array(dossierSchema).length(15),
  })
  .parse(seed);

function toSummary(item: z.infer<typeof dossierSchema>): DossierSummary {
  return {
    id: item.id,
    slug: item.slug,
    chapter: item.chapter,
    orderIndex: item.orderIndex,
    title: item.title,
    centralQuestion: item.centralQuestion,
    status: item.status,
  };
}

export function getPlannedDossiers(): DossierSummary[] {
  return parsedSeed.dossiers.map(toSummary).sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function listPublishedDossiers(): Promise<DossierSummary[]> {
  return parsedSeed.dossiers
    .filter((item) => item.status === "published" && item.experience)
    .map(toSummary)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function getPublishedDossierBySlug(slug: string): Promise<PublishedDossier | null> {
  const item = parsedSeed.dossiers.find((candidate) => candidate.slug === slug && candidate.status === "published");
  if (!item?.experience) return null;
  return {
    ...toSummary(item),
    status: "published",
    experience: item.experience,
  };
}

export type CauseLane = "context" | "contradiction" | "force" | "decision" | "result" | "lesson";

export type CauseNode = {
  id: string;
  lane: CauseLane;
  label: string;
  explanation: string;
  dossierSlug: string;
  dossierTitle: string;
  period: string;
};

export type CauseEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  relation: "Điều kiện" | "Phản ứng" | "Hệ quả" | "Bài học";
  explanation: string;
};

const shortDecisionLabels: Record<string, string> = {
  "hop-nhat-de-mo-duong": "Hợp nhất các tổ chức cộng sản",
  "giu-chinh-quyen-giua-vong-vay": "Giữ chính quyền bằng quyết sách đồng bộ",
  "doi-moi-hay-tut-hau": "Đổi mới toàn diện từ Đại hội VI",
};

export function getCauseMapData(): { nodes: CauseNode[]; edges: CauseEdge[] } {
  const nodes: CauseNode[] = [];
  const edges: CauseEdge[] = [];

  for (const dossier of parsedSeed.dossiers.filter((item) => item.status === "published" && item.experience)) {
    const experience = dossier.experience!;
    const definitions: Array<[CauseLane, string, string]> = [
      ["context", `Bối cảnh ${experience.briefing.period}`, experience.briefing.context[0]],
      ["contradiction", "Mâu thuẫn trung tâm", experience.briefing.centralContradiction],
      ["force", "Lực lượng và mục tiêu", experience.briefing.objective],
      ["decision", shortDecisionLabels[dossier.slug] ?? dossier.title, experience.historicalComparison.actualDecision],
      ["result", "Kết quả trực tiếp", experience.historicalComparison.results[0]],
      ["lesson", "Bài học quyết sách", experience.lessons[0]],
    ];

    const dossierNodes = definitions.map(([lane, label, explanation]) => ({
      id: `${dossier.slug}:${lane}`,
      lane,
      label,
      explanation,
      dossierSlug: dossier.slug,
      dossierTitle: dossier.title,
      period: experience.briefing.period,
    }));
    nodes.push(...dossierNodes);

    const relations: CauseEdge["relation"][] = ["Điều kiện", "Điều kiện", "Phản ứng", "Hệ quả", "Bài học"];
    for (let index = 0; index < dossierNodes.length - 1; index += 1) {
      edges.push({
        id: `${dossier.slug}:edge:${index}`,
        sourceId: dossierNodes[index].id,
        targetId: dossierNodes[index + 1].id,
        relation: relations[index],
        explanation: `${dossierNodes[index].label} tạo áp lực hoặc điều kiện để chuyển sang ${dossierNodes[index + 1].label.toLowerCase()}.`,
      });
    }
  }

  return { nodes, edges };
}

export type PublicSource = z.infer<typeof sourceRecordSchema>;

export type EvidenceClaim = {
  id: string;
  category: "Bối cảnh" | "Cơ sở" | "Thực thi" | "Kết quả" | "Hạn chế" | "Bài học";
  statement: string;
  dossierSlug: string;
  dossierTitle: string;
  sourceId: string;
  supportScope: string;
};

export function getEvidenceMatrixData(): { sources: PublicSource[]; claims: EvidenceClaim[] } {
  const sources = parsedSeed.sources.filter((source) => source.verificationStatus === "verified");
  const claims: EvidenceClaim[] = [];
  const categories: EvidenceClaim["category"][] = ["Bối cảnh", "Cơ sở", "Thực thi", "Kết quả", "Hạn chế", "Bài học"];

  for (const dossier of parsedSeed.dossiers.filter((item) => item.status === "published" && item.experience)) {
    const experience = dossier.experience!;
    const statements = [
      experience.briefing.context[0],
      experience.briefing.centralContradiction,
      experience.historicalComparison.implementation[0],
      experience.historicalComparison.results[0],
      experience.historicalComparison.limitations[0],
      experience.lessons[0],
    ];
    statements.forEach((statement, index) => {
      const source = experience.sources[index % experience.sources.length];
      claims.push({
        id: `${dossier.slug}:claim:${index}`,
        category: categories[index],
        statement,
        dossierSlug: dossier.slug,
        dossierTitle: dossier.title,
        sourceId: source.id,
        supportScope: `Nguồn hỗ trợ luận điểm ${categories[index].toLowerCase()} trong hồ sơ ${dossier.title}.`,
      });
    });
  }

  return { sources, claims: claims.filter((claim) => sources.some((source) => source.id === claim.sourceId)) };
}
