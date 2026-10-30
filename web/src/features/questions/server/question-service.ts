import type { SupabaseClient } from "@supabase/supabase-js";

import { toDraftArguments, type QuestionInput } from "@/features/questions/contracts/question";
import { ApiError } from "@/lib/api/errors";

// Maps database exceptions to the stable API codes of api-contracts §9. Raw database messages never
// reach the client; only a whitelisted token does.
const PUBLICATION_RULES = new Set(["human_reviewer_required", "human_publisher_required", "verified_sources_required", "ai_review_note_required", "retire_reason_required"]);
const TRANSITION_RULES = new Set(["invalid_status_transition", "published_version_immutable", "content_locked_after_draft", "only_published_can_retire", "retirement_is_permanent", "new_version_must_be_draft", "question_shape_immutable", "published_question_placement_immutable", "version_identity_immutable"]);

export function mapQuestionError(error: { code?: string; message?: string }): ApiError {
  const token = /^([a-z_]+)/.exec(error.message ?? "")?.[1] ?? "";
  if (token === "actor_not_admin") return new ApiError(403, "forbidden", "Không đủ quyền.");
  if (token === "invalid_question_content") {
    const codes = (error.message ?? "").split(":")[1]?.split(",").map((c) => c.trim()).filter((c) => /^[a-z_]+$/.test(c)) ?? [];
    return new ApiError(422, "validation_error", "Nội dung câu hỏi không hợp lệ.", codes.map((code) => ({ field: "content", code, message: "Không hợp lệ." })));
  }
  if (PUBLICATION_RULES.has(token)) return new ApiError(422, "publication_requirements_failed", "Chưa đủ điều kiện để duyệt hoặc xuất bản.", [{ field: "version", code: token, message: "Chưa đủ điều kiện." }]);
  if (TRANSITION_RULES.has(token)) return new ApiError(409, "invalid_content_transition", "Chuyển trạng thái không hợp lệ.", [{ field: "version", code: token, message: "Không được phép." }]);
  if (token === "version_not_found") return new ApiError(404, "not_found", "Không tìm thấy.");
  if (error.code === "23503") return new ApiError(422, "validation_error", "Nguồn không tồn tại.", [{ field: "sources", code: "unknown_source", message: "Không tìm thấy nguồn." }]);
  if (error.code === "23514" || error.code === "22023") return new ApiError(422, "validation_error", "Yêu cầu không hợp lệ.");
  console.error("question service error", { code: error.code });
  return new ApiError(500, "internal_error", "Đã xảy ra lỗi.");
}

export async function upsertQuestionDraft(admin: SupabaseClient, actorId: string, input: QuestionInput) {
  const { data, error } = await admin.rpc("upsert_question_draft", { p_actor: actorId, ...toDraftArguments(input) });
  if (error) throw mapQuestionError(error);
  const row = (data as Array<{ question_id: string; version_id: string; version: number; outcome: string }>)[0];
  return { questionId: row.question_id, versionId: row.version_id, version: row.version, outcome: row.outcome };
}

export async function transitionQuestionVersion(admin: SupabaseClient, actorId: string, versionId: string, action: "review" | "publish" | "reject" | "retire", note?: string) {
  const { data, error } = await admin.rpc("transition_question_version", { p_version_id: versionId, p_actor: actorId, p_action: action, p_note: note ?? null });
  if (error) throw mapQuestionError(error);
  return { status: data as string, retired: action === "retire" };
}

export async function questionBankReadiness(admin: SupabaseClient, query: { kind: "official" | "rehearsal"; competitionId?: string; expectedAttempts: number }) {
  const { data, error } = await admin.rpc("question_bank_readiness", { p_kind: query.kind, p_competition_id: query.competitionId ?? null, p_expected_attempts: query.expectedAttempts });
  if (error) throw mapQuestionError(error);
  return data;
}

// Administrators see correct answers and explanations here (security-spec §4); players never do.
export async function listQuestions(admin: SupabaseClient, filter: { game?: string; origin?: string; status?: string; limit: number }) {
  let query = admin
    .from("questions")
    .select("id, external_key, game_type, pool, chapter, topic, question_type, option_count, difficulty, origin, current_version_id, published_version_id, question_versions!question_versions_question_id_fkey(id, version, status, ai_assisted, reviewed_at, published_at, retired_at, content_public, content_private, question_source_links(source_id, locator))")
    .order("created_at", { ascending: false })
    .limit(filter.limit);
  if (filter.game) query = query.eq("game_type", filter.game);
  if (filter.origin) query = query.eq("origin", filter.origin);
  if (filter.status) query = query.eq("question_versions.status", filter.status);
  const { data, error } = await query;
  if (error) throw mapQuestionError(error);
  return filter.status ? (data ?? []).filter((q) => (q.question_versions as unknown[]).length > 0) : data ?? [];
}
