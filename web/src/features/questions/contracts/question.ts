import { z } from "zod";

// Shape of a question submitted through the admin API or an authoring file. Deep rules (sources
// verified, reviewer is a human admin, immutability) are enforced by the database; this schema
// only rejects malformed input early and keeps unknown keys out (security-spec §6).
export const POOLS = ["minefield_main", "minefield_defuse", "race"] as const;
export const CHAPTERS = ["chapter_1", "chapter_2", "chapter_3"] as const;
export const TYPES = ["single_choice", "before_after", "pair_choice", "defuse_ab"] as const;
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const questionInputSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,80}$/),
    game: z.enum(["minefield", "race"]),
    pool: z.enum(POOLS),
    chapter: z.enum(CHAPTERS),
    topic: z.string().trim().min(2).max(120),
    type: z.enum(TYPES),
    difficulty: z.enum(DIFFICULTIES),
    prompt: z.string().trim().min(1).max(300),
    options: z.array(z.object({ id: z.string().regex(/^[a-z0-9]{1,8}$/), label: z.string().trim().min(1).max(200) }).strict()).min(2).max(3),
    correctOptionId: z.string().min(1).max(8),
    explanation: z.string().trim().min(1).max(1000),
    // guid, not uuid: the source registry uses sequential ids (10000000-0000-0000-0000-00000000000x) that are not RFC 4122 versioned.
    sources: z.array(z.object({ sourceId: z.guid(), locator: z.string().trim().min(1).max(200), usageNote: z.string().trim().max(300).optional() }).strict()).min(1).max(8),
    aiAssisted: z.boolean().optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if ((q.game === "minefield") !== (q.pool !== "race")) add("pool", "pool_game_mismatch");
    if ((q.pool === "minefield_defuse") !== (q.type === "defuse_ab")) add("type", "defuse_type_pool");
    if (q.pool === "minefield_defuse" && q.difficulty !== "easy") add("difficulty", "defuse_difficulty");
    if ((q.type === "defuse_ab" || q.type === "before_after") && q.options.length !== 2) add("options", "two_option_type");
    if (!q.options.some((o) => o.id === q.correctOptionId)) add("correctOptionId", "correct_option_missing");
    if (new Set(q.options.map((o) => o.id)).size !== q.options.length) add("options", "option_id_duplicate");
  });

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const transitionSchema = z
  .object({ action: z.enum(["review", "publish", "reject", "retire"]), note: z.string().trim().max(500).optional() })
  .strict();

export const listFilterSchema = z.object({
  game: z.enum(["minefield", "race"]).optional(),
  origin: z.enum(["bank", "fixture"]).optional(),
  status: z.enum(["draft", "reviewed", "published"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const readinessQuerySchema = z.object({
  kind: z.enum(["official", "rehearsal"]),
  competitionId: z.uuid().optional(),
  expectedAttempts: z.coerce.number().int().min(1).max(500).default(60),
});

export function toDraftArguments(q: QuestionInput) {
  return {
    p_external_key: q.key,
    p_question: { game_type: q.game, pool: q.pool, chapter: q.chapter, topic: q.topic, question_type: q.type, option_count: q.options.length, difficulty: q.difficulty },
    p_public: { prompt: q.prompt, options: q.options },
    p_private: { correctOptionId: q.correctOptionId, explanation: q.explanation },
    p_sources: q.sources.map((s) => ({ sourceId: s.sourceId, locator: s.locator, usageNote: s.usageNote ?? "" })),
    p_ai_assisted: q.aiAssisted ?? false,
  };
}
