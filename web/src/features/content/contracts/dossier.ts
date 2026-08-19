import { z } from "zod";

export const chapterSchema = z.enum(["chapter_1", "chapter_2", "chapter_3"]);
export const postgresUuidSchema = z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

const sourceSchema = z.object({
  id: postgresUuidSchema,
  title: z.string().min(2),
  authorOrIssuer: z.string().min(2),
  locator: z.string(),
  url: z.url().nullable(),
});

const evidenceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2),
  kind: z.enum(["document", "event", "data", "map", "quotation", "assessment"]),
  summary: z.string().min(10),
  sourceIds: z.array(postgresUuidSchema).min(1),
  isDistractor: z.boolean().default(false),
});

export const dossierExperienceSchema = z.object({
  briefing: z.object({
    period: z.string().min(2),
    context: z.array(z.string().min(5)).min(2),
    centralContradiction: z.string().min(10),
    objective: z.string().min(10),
    constraints: z.array(z.string().min(5)).min(2),
  }),
  evidence: z.array(evidenceSchema).min(4),
  decision: z.object({
    prompt: z.string().min(10),
    requiredEvidenceCount: z.number().int().min(1).max(6),
    options: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(2), rationale: z.string().min(5) }))
      .min(2),
  }),
  projectedConsequences: z
    .array(z.object({ optionId: z.string().min(1), steps: z.array(z.string().min(5)).min(2) }))
    .min(2),
  historicalComparison: z.object({
    actualDecision: z.string().min(10),
    implementation: z.array(z.string().min(5)).min(1),
    results: z.array(z.string().min(5)).min(1),
    limitations: z.array(z.string().min(5)).min(1),
  }),
  lessons: z.array(z.string().min(5)).min(1),
  sources: z.array(sourceSchema).min(1),
});

export type DossierExperience = z.infer<typeof dossierExperienceSchema>;
export type CourseChapter = z.infer<typeof chapterSchema>;

export type DossierSummary = {
  id: string;
  slug: string;
  chapter: CourseChapter;
  orderIndex: number;
  title: string;
  centralQuestion: string;
  status: "draft" | "reviewed" | "published";
};

export type PublishedDossier = DossierSummary & {
  status: "published";
  experience: DossierExperience;
};
