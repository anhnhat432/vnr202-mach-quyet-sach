// @vitest-environment node
import { describe, expect, it } from "vitest";

import { PROFILES, analyzeBank, buildReviewPack, generateFixtures, toDraftArguments, validateQuestionDocument, type AuthoredQuestion } from "../../../scripts/lib/question-bank.mjs";
import { questionInputSchema } from "@/features/questions/contracts/question";

const SRC = "10000000-0000-4000-8000-000000000001";
const sources = new Map([[SRC, "verified"], ["10000000-0000-4000-8000-000000000002", "pending"]]);
const good = (over: Partial<AuthoredQuestion> = {}): AuthoredQuestion => ({
  key: "race-0001", pool: "race", chapter: "chapter_1", topic: "Chủ đề", type: "single_choice", difficulty: "easy",
  prompt: "Câu hỏi ngắn?", options: [{ id: "a", label: "Một" }, { id: "b", label: "Hai" }, { id: "c", label: "Ba" }],
  correctOptionId: "b", explanation: "Giải thích.", sources: [{ sourceId: SRC, locator: "tr. 1" }], ...over,
});
const doc = (questions: AuthoredQuestion[], game: "race" | "minefield" = "race") => ({ schemaVersion: 1 as const, game, questions });
const codes = (r: { errors: string[] }) => r.errors.map((e) => e.split(":")[0]);

describe("authoring file validation", () => {
  it("accepts a well-formed Draft without errors", () => {
    expect(validateQuestionDocument(doc([good()]), { sources })).toEqual({ errors: [], warnings: [] });
  });

  it("rejects what the database rejects", () => {
    const bad = (over: Partial<AuthoredQuestion>) => codes(validateQuestionDocument(doc([good(over)]), { sources }));
    expect(bad({ pool: "minefield_main" })).toContain("POOL_GAME_MISMATCH");
    expect(bad({ options: [{ id: "a", label: "x" }] })).toContain("OPTION_COUNT");
    expect(bad({ correctOptionId: "z" })).toContain("CORRECT_OPTION");
    expect(bad({ options: [{ id: "a", label: "x" }, { id: "a", label: "y" }, { id: "c", label: "z" }] })).toContain("OPTION_ID_DUPLICATE");
    expect(bad({ type: "before_after" })).toContain("TWO_OPTION_TYPE");
    expect(bad({ explanation: "  " })).toContain("EXPLANATION");
    expect(bad({ prompt: "x".repeat(301) })).toContain("PROMPT");
    expect(bad({ sources: [] })).toContain("SOURCES_REQUIRED");
  });

  it("requires a known, verified source with a locator", () => {
    const bad = (sourcesList: AuthoredQuestion["sources"]) => codes(validateQuestionDocument(doc([good({ sources: sourcesList })]), { sources }));
    expect(bad([{ sourceId: "10000000-0000-4000-8000-0000000000ff", locator: "x" }])).toContain("UNKNOWN_SOURCE");
    expect(bad([{ sourceId: "10000000-0000-4000-8000-000000000002", locator: "x" }])).toContain("SOURCE_NOT_VERIFIED");
    expect(bad([{ sourceId: SRC, locator: " " }])).toContain("SOURCE_LOCATOR");
  });

  it("a file can never carry a status or an origin: only humans review, only the generator makes fixtures", () => {
    const withStatus = { ...good(), status: "published" } as unknown as AuthoredQuestion;
    const withOrigin = { ...good(), origin: "fixture" } as unknown as AuthoredQuestion;
    expect(codes(validateQuestionDocument(doc([withStatus]), { sources }))).toContain("STATUS_FORBIDDEN");
    expect(codes(validateQuestionDocument(doc([withOrigin]), { sources }))).toContain("ORIGIN_FORBIDDEN");
  });

  it("defuse questions: defuse pool only, two options, easy", () => {
    const defuse = (over: Partial<AuthoredQuestion>) => codes(validateQuestionDocument(doc([good({ pool: "minefield_defuse", type: "defuse_ab", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: "a", ...over })], "minefield"), { sources }));
    expect(defuse({})).toEqual([]);
    expect(defuse({ difficulty: "hard" })).toContain("DEFUSE_DIFFICULTY");
    expect(defuse({ type: "single_choice" })).toContain("DEFUSE_TYPE_POOL");
  });

  it("flags duplicate keys and duplicate prompts, and warns (not errors) above the trial length limits", () => {
    const dup = validateQuestionDocument(doc([good(), good({ key: "race-0002" })]), { sources });
    expect(codes(dup)).toContain("DUPLICATE_PROMPT");
    expect(codes(validateQuestionDocument(doc([good(), good()]), { sources }))).toContain("DUPLICATE_KEY");
    const long = validateQuestionDocument(doc([good({ prompt: "x".repeat(81), options: [{ id: "a", label: "y".repeat(41) }, { id: "b", label: "B" }, { id: "c", label: "C" }] })]), { sources });
    expect(long.errors).toEqual([]);
    expect(long.warnings.map((w) => w.split(":")[0])).toEqual(expect.arrayContaining(["PROMPT_OVER_TRIAL_LIMIT", "OPTION_OVER_TRIAL_LIMIT"]));
  });

  it("builds the database call for a Draft (never a status)", () => {
    const args = toDraftArguments("race", good({ aiAssisted: true }));
    expect(args.p_ai_assisted).toBe(true);
    expect(args.p_question).toMatchObject({ game_type: "race", pool: "race", option_count: 3 });
    expect(JSON.stringify(args)).not.toMatch(/status|published|reviewed/i);
    expect(args.p_public).not.toHaveProperty("correctOptionId"); // the public payload never carries the answer
  });
});

describe("the admin API schema mirrors the same rules", () => {
  const input = { ...good(), game: "race" as const, sources: [{ sourceId: SRC, locator: "tr. 1" }] };
  it("accepts a good question and rejects status, origin and unknown keys", () => {
    expect(questionInputSchema.safeParse(input).success).toBe(true);
    expect(questionInputSchema.safeParse({ ...input, status: "published" }).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...input, origin: "fixture" }).success).toBe(false);
  });
  it("accepts the registry's real source ids, which are sequential and not RFC 4122 versioned", () => {
    const registryId = "10000000-0000-0000-0000-000000000001";
    expect(questionInputSchema.safeParse({ ...input, sources: [{ sourceId: registryId, locator: "tr. 1" }] }).success).toBe(true);
    expect(questionInputSchema.safeParse({ ...input, sources: [{ sourceId: "not-an-id", locator: "tr. 1" }] }).success).toBe(false);
  });
  it("rejects pool/game mismatch, defuse misuse and a missing correct option", () => {
    expect(questionInputSchema.safeParse({ ...input, game: "minefield" }).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...input, pool: "minefield_defuse", game: "minefield", type: "single_choice" }).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...input, correctOptionId: "z" }).success).toBe(false);
  });
});

describe("synthetic fixtures", () => {
  it("dev87 has exactly the 87-question mix and official168 the 168-question mix", () => {
    expect(generateFixtures("dev87")).toHaveLength(87);
    expect(generateFixtures("official168")).toHaveLength(168);
    const counts = (profile: "dev87" | "official168") => Object.fromEntries(Object.entries(analyzeBank(generateFixtures(profile)).bySlot));
    expect(counts("dev87")).toEqual({ "minefield_main/easy": 9, "minefield_main/medium": 12, "minefield_main/hard": 9, "minefield_defuse/easy": 12, "race/easy": 15, "race/medium": 21, "race/hard": 9 });
    expect(Object.values(PROFILES.official168).flatMap((x) => Object.values(x)).reduce((a, b) => a + b, 0)).toBe(168);
  });

  it("is deterministic, obviously fake, valid by the same rules, and has varied answer positions", () => {
    const a = generateFixtures("dev87");
    expect(JSON.stringify(a)).toBe(JSON.stringify(generateFixtures("dev87")));
    expect(a.every((q) => q.prompt.startsWith("[GIẢ LẬP]") && q.explanation.includes("[GIẢ LẬP]"))).toBe(true);
    const stats = analyzeBank(a);
    expect(Object.keys(stats.answerPosition).length).toBeGreaterThanOrEqual(2);
    // Fixtures have no sources by design, so only the source rule may fail.
    const result = validateQuestionDocument({ schemaVersion: 1, game: "race", questions: a.filter((q) => q.game === "race") }, { sources });
    expect([...new Set(codes(result))]).toEqual(["SOURCES_REQUIRED"]);
    expect(analyzeBank(a).coverage.dev87).toBe("87/87");
  });

  it("two-option share per Game 2 slot stays within a third, so the cap of 5 is reachable but not forced", () => {
    const race = generateFixtures("dev87").filter((q) => q.game === "race");
    for (const d of ["easy", "medium", "hard"]) {
      const slot = race.filter((q) => q.difficulty === d);
      expect(slot.filter((q) => q.options.length === 2).length / slot.length).toBeLessThanOrEqual(1 / 3);
    }
  });
});

describe("review pack", () => {
  it("states that nothing is reviewed or published, flags AI drafts and marks the answer for the reviewer", () => {
    const md = buildReviewPack([good({ aiAssisted: true })], new Map([[SRC, { title: "Giáo trình thử" }]]));
    expect(md).toContain("Draft");
    expect(md).toContain("chưa được Published");
    expect(md).toContain("AI soạn nháp");
    expect(md).toContain("Giáo trình thử — tr. 1");
    expect(md).toContain("← đáp án đúng");
  });
});
