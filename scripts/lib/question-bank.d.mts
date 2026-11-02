export type QuestionOption = { id: string; label: string };
export type QuestionSourceLink = { sourceId: string; locator: string; usageNote?: string };
export type AuthoredQuestion = {
  key: string;
  pool: "minefield_main" | "minefield_defuse" | "race";
  chapter: "chapter_1" | "chapter_2" | "chapter_3";
  topic: string;
  type: "single_choice" | "before_after" | "pair_choice" | "defuse_ab";
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  sources: QuestionSourceLink[];
  aiAssisted?: boolean;
};
export type FixtureQuestion = AuthoredQuestion & { game: "minefield" | "race" };
export type QuestionDocument = { schemaVersion: 1; game: "minefield" | "race"; questions: AuthoredQuestion[] };

export declare const TRIAL_LIMITS: { prompt: number; option: number };
export declare const HARD_LIMITS: { prompt: number; option: number; explanation: number };
export declare const BLUEPRINT: Record<"minefield" | "race", Array<{ pool: string; difficulty: string; n: number }>>;
export declare const PROFILES: Record<"dev87" | "official168", Record<string, Record<string, number>>>;
export declare const FIXTURE_MARKER: string;

export declare function validateQuestionDocument(
  doc: unknown,
  options?: { sources?: Map<string, string>; knownKeys?: Set<string> },
): { errors: string[]; warnings: string[] };
export declare function toDraftArguments(game: "minefield" | "race", question: AuthoredQuestion): {
  p_external_key: string;
  p_question: Record<string, unknown>;
  p_public: { prompt: string; options: QuestionOption[] };
  p_private: { correctOptionId: string; explanation: string };
  p_sources: QuestionSourceLink[];
  p_ai_assisted: boolean;
};
export declare function analyzeBank(questions: AuthoredQuestion[]): {
  total: number;
  bySlot: Record<string, number>;
  twoOption: number;
  answerPosition: Record<string, number>;
  progress: Record<string, Record<string, { have: number; target: number }>>;
  coverage: { dev87: string; official168: string };
};
export declare function generateFixtures(profile?: "dev87" | "official168", options?: { seed?: number; keyPrefix?: string }): FixtureQuestion[];
export declare function buildReviewPack(questions: AuthoredQuestion[], sources?: Map<string, { title: string }>, options?: { title?: string }): string;
