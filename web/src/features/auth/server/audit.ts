import type { SupabaseClient } from "@supabase/supabase-js";

import { hashIdentifier } from "@/features/auth/domain/provider-password";

export type AuthEventType = "sign_in_success" | "sign_in_failure" | "sign_out" | "session_revoked" | "password_reset" | "session_transfer";

// Sign-in/session events (LA-ACC-009). MSSV, IP and device are stored only as keyed hashes.
export async function recordAuthEvent(
  admin: SupabaseClient,
  pepper: string,
  event: AuthEventType,
  details: { profileId?: string | null; studentId?: string; ip?: string; device?: string },
) {
  await admin.from("auth_events").insert({
    event,
    profile_id: details.profileId ?? null,
    student_id_hash: details.studentId ? hashIdentifier(pepper, "audit:student", details.studentId) : null,
    ip_hash: details.ip ? hashIdentifier(pepper, "audit:ip", details.ip) : null,
    device_label_hash: details.device ? hashIdentifier(pepper, "audit:device", details.device) : null,
  });
}

// Administrative audit trail (security-spec §13). Callers pass redacted before/after values only.
export async function recordAudit(
  admin: SupabaseClient,
  entry: { actorId: string; action: string; targetType: string; targetId?: string; requestId?: string; before?: unknown; after?: unknown },
) {
  const { error } = await admin.from("audit_logs").insert({
    actor_profile_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    request_id: entry.requestId ?? null,
    before_redacted: entry.before ?? null,
    after_redacted: entry.after ?? null,
  });
  if (error) throw new Error(`audit write failed: ${error.message}`);
}
