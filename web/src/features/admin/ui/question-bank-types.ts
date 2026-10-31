export type QuestionVersion = {
  id: string;
  version: number;
  status: "draft" | "reviewed" | "published";
  ai_assisted: boolean;
  retired_at: string | null;
  content_public: { prompt: string; options: Array<{ id: string; label: string }> };
  content_private: { correctOptionId: string; explanation: string };
  question_source_links: Array<{ source_id: string; locator: string }>;
};

export type BankQuestion = {
  id: string;
  external_key: string | null;
  current_version_id?: string;
  game_type: "minefield" | "race";
  pool: string;
  chapter: string;
  topic: string;
  question_type: string;
  difficulty: string;
  origin: "bank" | "fixture";
  question_versions: QuestionVersion[];
};

export type BulkQuestionTarget = { versionId: string; label: string; status: "draft" | "reviewed" };
