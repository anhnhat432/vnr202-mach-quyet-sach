import { z } from "zod";

export const chapterSchema = z.enum(["chapter_1", "chapter_2", "chapter_3"]);
export const postgresUuidSchema = z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

export const sourceRecordSchema = z.object({
  id: postgresUuidSchema,
  title: z.string().min(2).max(300),
  authorOrIssuer: z.string().min(2).max(200),
  publicationYear: z.number().int().min(1900).max(2100),
  locator: z.string(),
  url: z.url().nullable(),
  sourceType: z.string().min(2),
  rightsNote: z.string().min(5),
  verificationStatus: z.literal("verified"),
});

const sourceSchema = sourceRecordSchema.pick({
  id: true,
  title: true,
  authorOrIssuer: true,
  locator: true,
  url: true,
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

const sourceRefSchema = z.object({
  sourceId: postgresUuidSchema,
  locator: z.string().min(3),
});

const reviewSchema = z.object({
  aiAssistance: z.object({
    used: z.boolean(),
    role: z.string().min(5),
  }),
  reviewedBy: z.string().min(2).optional(),
  reviewedAt: z.iso.date().optional(),
  approvalRef: z.string().min(5).optional(),
});

export const claimSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["context", "basis", "implementation", "result", "limitation", "lesson"]),
  statement: z.string().min(10),
  sourceLinks: z
    .array(
      z.object({
        sourceId: postgresUuidSchema,
        locator: z.string().min(3),
        supportScope: z.string().min(10),
      }),
    )
    .min(1),
});

export const causalNodeSchema = z.object({
  id: z.string().min(1),
  lane: z.enum(["context", "contradiction", "force", "decision", "result", "lesson"]),
  label: z.string().min(2),
  explanation: z.string().min(10),
  claimId: z.string().min(1),
});

export const authoredDossierSchema = z.object({
  id: postgresUuidSchema,
  versionId: postgresUuidSchema.optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  chapter: chapterSchema,
  orderIndex: z.number().int().min(1).max(15),
  title: z.string().min(2),
  centralQuestion: z.string().min(10),
  status: z.enum(["draft", "reviewed", "published"]),
  review: reviewSchema,
  sourceRefs: z.array(sourceRefSchema),
  experience: dossierExperienceSchema.optional(),
  claims: z.array(claimSchema).length(6).optional(),
  causalNodes: z.array(causalNodeSchema).length(6).optional(),
});

export const causalLinkSchema = z.object({
  id: z.string().min(1),
  sourceDossierId: postgresUuidSchema,
  sourceNodeId: z.string().min(1),
  targetDossierId: postgresUuidSchema,
  targetNodeId: z.string().min(1),
  relation: z.enum(["direct_cause", "condition", "response", "outcome", "limitation", "lesson"]),
  explanation: z.string().min(10),
  claimId: z.string().min(1),
  sourceId: postgresUuidSchema,
  locator: z.string().min(3),
});

const humanPublicationSchema = z.object({
  kind: z.literal("human-approval"),
  dossierId: postgresUuidSchema,
  status: z.literal("published"),
  reviewedBy: z.string().min(2),
  reviewedAt: z.iso.date(),
  approvalRef: z.string().min(5),
});

const legacyPublicationSchema = z.object({
  kind: z.literal("legacy-baseline"),
  dossierId: postgresUuidSchema,
  status: z.literal("published"),
  sourceCommit: z.literal("6c918ce432e7fd7c3c1f6c697a180564fb08b935"),
  capturedAt: z.iso.date(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  note: z.string().min(20),
});

export const publicationManifestSchema = z.object({
  schemaVersion: z.literal(1),
  publications: z.array(z.discriminatedUnion("kind", [humanPublicationSchema, legacyPublicationSchema])),
});

export const contentCatalogSchema = z.object({
  schemaVersion: z.literal(2),
  sources: z.array(sourceRecordSchema).min(1),
  dossiers: z.array(authoredDossierSchema).length(15),
  causalLinks: z.array(causalLinkSchema),
  publicationManifest: publicationManifestSchema,
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
