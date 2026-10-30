import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";

// Thin, typed access to the gameplay RPCs. The service-role client is only ever used after the route
// verified the caller; the profile id passed here comes from Supabase Auth, never from the client.
type RpcError = { code?: string; message?: string; details?: string | null };

const STATUS_BY_SQLSTATE: Record<string, number> = { QA404: 404, QA409: 409, QA410: 410, QA422: 422, QA425: 425, "42501": 403, "55P03": 503, QB001: 503, QB002: 503 };

const MESSAGES: Record<string, string> = {
  stale_session: "Phiên chơi này không còn quyền điều khiển lượt thi. Hãy tiếp tục trên thiết bị đang dùng.",
  another_attempt_active: "Bạn đang chơi một game khác. Hãy hoàn thành lượt đó trước.",
  interaction_pending: "Hãy xử lý câu hỏi đang mở trước.",
  start_closed: "Cuộc thi đã đóng nhận lượt mới.",
  too_early: "Câu hỏi chưa sẵn sàng.",
  content_not_fetched: "Hãy mở nội dung câu hỏi trước khi trả lời.",
  attempt_terminal: "Lượt thi đã kết thúc.",
  attempt_time_over: "Đã hết thời gian lượt thi.",
  review_not_available: "Chỉ xem lại được sau khi cuộc thi kết thúc.",
  readiness_blocked: "Ngân hàng câu hỏi chưa đủ điều kiện để mở cuộc thi.",
  bank_acknowledgement_required: "Ngân hàng chưa đạt mục tiêu; quản trị viên cần xác nhận rủi ro và nhập lý do.",
  bank_assessment_required: "Cuộc thi cần được đánh giá ngân hàng trước khi mở.",
  already_voided: "Lượt thi này đã bị vô hiệu.",
  competition_finalized: "Cuộc thi đã công bố kết quả; chỉ có thể ghi chú sự cố.",
  reason_required: "Cần nhập lý do (ít nhất 3 ký tự).",
  confirmation_closed: "Chỉ xác nhận được khi cuộc thi còn ở trạng thái Nháp.",
  not_needed_for_rehearsal: "Cuộc thi diễn tập không cần xác nhận câu đã công bố.",
  not_disclosed: "Có câu được chọn chưa từng bị công bố đáp án.",
  nothing_selected: "Chưa chọn câu hỏi nào.",
};

// Maps a database error token to an API error. Raw SQL text is never forwarded.
export function mapRpcError(error: RpcError): ApiError {
  const sqlstate = error.code ?? "";
  const token = (error.message ?? "").trim();
  const status = STATUS_BY_SQLSTATE[sqlstate];
  if (!status) {
    console.error("arena rpc failure", { code: sqlstate });
    return new ApiError(500, "internal_error", "Đã xảy ra lỗi.");
  }
  if (sqlstate === "55P03") return new ApiError(503, "temporarily_unavailable", "Hệ thống đang bận, hãy thử lại ngay.");
  if (sqlstate === "QB001" || sqlstate === "QB002") return new ApiError(503, "competition_not_ready", "Ngân hàng câu hỏi chưa đủ cho cuộc thi này.");
  if (sqlstate === "42501") return new ApiError(403, "forbidden", "Bạn không có quyền thực hiện thao tác này.");
  const code = /^[a-z_]{3,48}$/.test(token) ? token : "conflict";
  const message = MESSAGES[code] ?? "Yêu cầu không thực hiện được.";
  const details: ApiError["details"] = [];
  if (sqlstate === "QA425" || sqlstate === "QA409" || sqlstate === "QA422") {
    try {
      const parsed = error.details ? (JSON.parse(error.details) as Record<string, unknown>) : null;
      if (parsed && typeof parsed.availableInMs === "number") details.push({ field: "availableInMs", code: "wait", message: String(parsed.availableInMs) });
      if (parsed && typeof parsed.attemptId === "string") details.push({ field: "attemptId", code: "active_attempt", message: parsed.attemptId });
      if (parsed && typeof parsed.game === "string") details.push({ field: "game", code: "active_game", message: parsed.game });
    } catch {
      /* details are optional */
    }
  }
  return new ApiError(status, code, message, details.length ? details : undefined);
}

export async function rpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw mapRpcError(error as RpcError);
  return data as T;
}

// The caller must control the attempt (or take control when resuming on a new device); returns the
// session_version the gameplay RPCs need. Re-checked inside every RPC, so a transfer that happens
// between these two calls is still refused.
export function bindSession(admin: SupabaseClient, profileId: string, attemptId: string, authSessionId: string, takeControl = false) {
  return rpc<number>(admin, "arena_bind_session", { p_profile_id: profileId, p_attempt_id: attemptId, p_auth_session_id: authSessionId, p_take_control: takeControl });
}
