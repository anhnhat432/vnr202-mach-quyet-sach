import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveProviderPassword } from "@/features/auth/domain/provider-password";
import { recordAudit, recordAuthEvent } from "@/features/auth/server/audit";
import { normalizeDisplayName } from "@/features/roster/domain/display-name";
import type { ServerEnv } from "@/lib/config/server-env";
import { ApiError } from "@/lib/api/errors";

// Admin account actions (T033, LA-ADMIN-003, LA-PRV-003). Every action is audited.
type Deps = { admin: SupabaseClient; env: Pick<ServerEnv, "AUTH_PASSWORD_PEPPER" | "ROSTER_DEFAULT_PASSWORD"> };
type Action = { actorId: string; profileId: string; reason: string; requestId?: string };

async function loadStudent(admin: SupabaseClient, profileId: string) {
  const { data } = await admin.from("profiles").select("id, student_id, display_name, display_name_suffix, class_id, status").eq("id", profileId).eq("role", "student").maybeSingle();
  if (!data) throw new ApiError(404, "not_found", "Không tìm thấy.");
  return data;
}

export async function listStudents(admin: SupabaseClient) {
  const { data } = await admin
    .from("profiles")
    .select("id, student_id, full_name, display_name, display_name_suffix, status, created_at")
    .eq("role", "student")
    .order("student_id");
  return data ?? [];
}

export async function revokeSessions({ admin, env }: Deps, action: Action) {
  await loadStudent(admin, action.profileId);
  const { data, error } = await admin.rpc("revoke_user_sessions", { p_user_id: action.profileId });
  if (error) throw new ApiError(500, "internal_error", "Không thu hồi được phiên.");
  await recordAuthEvent(admin, env.AUTH_PASSWORD_PEPPER, "session_revoked", { profileId: action.profileId });
  await recordAudit(admin, { actorId: action.actorId, action: "account.revoke_sessions", targetType: "profile", targetId: action.profileId, requestId: action.requestId, after: { revokedSessions: data, reason: action.reason } });
  return { revokedSessions: data as number };
}

export async function resetPasswordToDefault({ admin, env }: Deps, action: Action) {
  const student = await loadStudent(admin, action.profileId);
  const password = deriveProviderPassword(env.AUTH_PASSWORD_PEPPER, student.student_id, env.ROSTER_DEFAULT_PASSWORD);
  const { error } = await admin.auth.admin.updateUserById(action.profileId, { password });
  if (error) throw new ApiError(503, "temporarily_unavailable", "Không đặt lại được mật khẩu.");
  await admin.rpc("revoke_user_sessions", { p_user_id: action.profileId });
  await recordAuthEvent(admin, env.AUTH_PASSWORD_PEPPER, "password_reset", { profileId: action.profileId });
  await recordAudit(admin, { actorId: action.actorId, action: "account.password_reset_to_default", targetType: "profile", targetId: action.profileId, requestId: action.requestId, after: { reason: action.reason } });
}

export async function setAccountStatus(deps: Deps, action: Action & { status: "active" | "locked" }) {
  const student = await loadStudent(deps.admin, action.profileId);
  const { error } = await deps.admin.from("profiles").update({ status: action.status, updated_at: new Date().toISOString() }).eq("id", action.profileId);
  if (error) throw new ApiError(500, "internal_error", "Không cập nhật được trạng thái.");
  if (action.status === "locked") await deps.admin.rpc("revoke_user_sessions", { p_user_id: action.profileId });
  await recordAudit(deps.admin, { actorId: action.actorId, action: "account.set_status", targetType: "profile", targetId: action.profileId, requestId: action.requestId, before: { status: student.status }, after: { status: action.status, reason: action.reason } });
}

export async function updateDisplayName({ admin }: Deps, action: Action & { displayName: string }) {
  const student = await loadStudent(admin, action.profileId);
  const name = normalizeDisplayName(action.displayName);
  if (!name) throw new ApiError(422, "validation_error", "Tên hiển thị không hợp lệ.", [{ field: "displayName", code: "invalid_display_name", message: "1–40 ký tự, không ký tự điều khiển." }]);
  const { data: same } = await admin.from("profiles").select("id, display_name_suffix").eq("role", "student").eq("class_id", student.class_id).eq("display_name", name).neq("id", action.profileId);
  const used = (same ?? []).map((s) => (s.display_name_suffix as number | null) ?? 1);
  const suffix = used.length === 0 ? null : Math.max(...used) + 1;
  const { error } = await admin.from("profiles").update({ display_name: name, display_name_suffix: suffix, updated_at: new Date().toISOString() }).eq("id", action.profileId);
  if (error) throw new ApiError(409, "duplicate_resource", "Tên hiển thị bị trùng, thử lại.");
  await recordAudit(admin, {
    actorId: action.actorId,
    action: "account.update_display_name",
    targetType: "profile",
    targetId: action.profileId,
    requestId: action.requestId,
    before: { displayName: student.display_name, suffix: student.display_name_suffix },
    after: { displayName: name, suffix, reason: action.reason },
  });
  return { displayName: name, displayNameSuffix: suffix };
}
