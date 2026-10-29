import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveProviderPassword } from "@/features/auth/domain/provider-password";
import { recordAudit } from "@/features/auth/server/audit";
import { assignDisplayNameSuffixes, normalizeDisplayName } from "@/features/roster/domain/display-name";
import { buildRosterPreview, readRosterFile, type RosterRow } from "@/features/roster/domain/roster-table";
import type { ServerEnv } from "@/lib/config/server-env";
import { ApiError } from "@/lib/api/errors";

// Roster import: preview first, nothing written to Auth or profiles until apply (LA-ACC-001/002).
export type RosterDeps = {
  admin: SupabaseClient; // service role, used only after requireAdmin
  env: Pick<ServerEnv, "AUTH_PASSWORD_PEPPER" | "ROSTER_DEFAULT_PASSWORD" | "INTERNAL_AUTH_EMAIL_DOMAIN" | "ROSTER_STUDENT_ID_PATTERN" | "ROSTER_MAX_ROWS">;
  // Test seam for compensation (provider failure mid-batch).
  createAuthUser?: (attributes: { email: string; password: string }) => Promise<{ id: string }>;
};

async function ensureActiveClass(admin: SupabaseClient, code: string, name: string): Promise<string> {
  const { data: active } = await admin.from("classes").select("id, code").eq("is_active", true).maybeSingle();
  if (active) {
    if (active.code !== code) throw new ApiError(409, "another_class_active", "Đang có một lớp khác hoạt động.");
    return active.id;
  }
  const { data, error } = await admin.from("classes").insert({ code, name }).select("id").single();
  if (error || !data) throw new ApiError(500, "internal_error", "Không tạo được lớp.");
  return data.id;
}

async function classContext(admin: SupabaseClient, classId: string) {
  const { data: students } = await admin.from("profiles").select("student_id, display_name, display_name_suffix, class_id").eq("role", "student");
  const existingStudentIds = new Set((students ?? []).map((s) => s.student_id as string));
  const takenDisplayNames = new Map<string, number>();
  for (const s of students ?? []) {
    if (s.class_id !== classId) continue;
    const suffix = (s.display_name_suffix as number | null) ?? 1;
    takenDisplayNames.set(s.display_name, Math.max(takenDisplayNames.get(s.display_name) ?? 0, suffix));
  }
  return { existingStudentIds, takenDisplayNames };
}

export async function createRosterPreview(
  deps: RosterDeps,
  input: { actorId: string; classCode: string; className: string; fileName: string; bytes: Uint8Array; requestId?: string },
) {
  const { admin, env } = deps;
  const table = readRosterFile(input.fileName, input.bytes);
  const classId = await ensureActiveClass(admin, input.classCode, input.className);
  const context = await classContext(admin, classId);
  const preview = buildRosterPreview(table, {
    ...context,
    studentIdPattern: env.ROSTER_STUDENT_ID_PATTERN ? new RegExp(env.ROSTER_STUDENT_ID_PATTERN) : undefined,
    maxRows: env.ROSTER_MAX_ROWS,
  });
  const { data: importRow, error } = await admin
    .from("roster_imports")
    .insert({
      file_name: input.fileName.slice(0, 255),
      file_sha256: createHash("sha256").update(input.bytes).digest("hex"),
      file_format: input.fileName.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
      class_id: classId,
      row_count: preview.rows.length,
      valid_count: preview.validCount,
      warning_count: preview.warningCount,
      error_count: preview.errorCount,
      created_by: input.actorId,
    })
    .select("id")
    .single();
  if (error || !importRow) throw new ApiError(500, "internal_error", "Không lưu được bản xem trước.");
  if (preview.rows.length > 0) {
    const { error: rowsError } = await admin.from("roster_import_rows").insert(
      preview.rows.map((row) => ({
        import_id: importRow.id,
        row_number: row.rowNumber,
        student_id: row.studentId,
        full_name: row.fullName,
        display_name: row.displayName,
        student_id_cell_type: row.studentIdCellType,
        row_status: row.status,
        issues: row.issues,
      })),
    );
    if (rowsError) throw new ApiError(500, "internal_error", "Không lưu được bản xem trước.");
  }
  await recordAudit(admin, {
    actorId: input.actorId,
    action: "roster.preview",
    targetType: "roster_import",
    targetId: importRow.id,
    requestId: input.requestId,
    after: { rows: preview.rows.length, valid: preview.validCount, warning: preview.warningCount, error: preview.errorCount },
  });
  return { importId: importRow.id as string, ...preview };
}

type StoredRow = { row_number: number; student_id: string; full_name: string; display_name: string; row_status: RosterRow["status"] };

export async function applyRosterImport(
  deps: RosterDeps,
  input: { actorId: string; importId: string; confirmedWarningRows: number[]; displayNameOverrides: Record<string, string>; requestId?: string },
) {
  const { admin, env } = deps;
  const overrides = new Map<number, string>();
  for (const [row, name] of Object.entries(input.displayNameOverrides)) {
    const normalized = normalizeDisplayName(name);
    if (!normalized) throw new ApiError(422, "validation_error", "Tên hiển thị không hợp lệ.", [{ field: `displayNameOverrides.${row}`, code: "invalid_display_name", message: "1–40 ký tự, không ký tự điều khiển." }]);
    overrides.set(Number(row), normalized);
  }

  // Single transition validated -> applying guards against double apply.
  const { data: claimed } = await admin
    .from("roster_imports")
    .update({ status: "applying" })
    .eq("id", input.importId)
    .eq("status", "validated")
    .select("id, class_id")
    .maybeSingle();
  if (!claimed) throw new ApiError(409, "import_not_ready", "Bản nhập không ở trạng thái chờ áp dụng.");

  const { data: rows } = await admin
    .from("roster_import_rows")
    .select("row_number, student_id, full_name, display_name, row_status")
    .eq("import_id", input.importId)
    .order("row_number");
  const confirmed = new Set(input.confirmedWarningRows);
  const selected = ((rows ?? []) as StoredRow[]).filter((r) => r.row_status === "valid" || (r.row_status === "warning" && confirmed.has(r.row_number)));

  const context = await classContext(admin, claimed.class_id);
  const names = selected.map((r) => overrides.get(r.row_number) ?? r.display_name);
  const suffixes = assignDisplayNameSuffixes(names, context.takenDisplayNames);
  const createUser =
    deps.createAuthUser ??
    (async (attributes: { email: string; password: string }) => {
      const { data, error } = await admin.auth.admin.createUser({ ...attributes, email_confirm: true, app_metadata: { role: "student" } });
      if (error || !data.user) throw new Error(error?.message ?? "createUser failed");
      return { id: data.user.id };
    });

  const created: string[] = [];
  try {
    for (const [index, row] of selected.entries()) {
      if (context.existingStudentIds.has(row.student_id)) throw new Error("student id appeared after preview");
      const email = `${randomUUID()}@${env.INTERNAL_AUTH_EMAIL_DOMAIN}`; // random, not derived from MSSV (LA-ACC-015)
      const password = deriveProviderPassword(env.AUTH_PASSWORD_PEPPER, row.student_id, env.ROSTER_DEFAULT_PASSWORD);
      const user = await createUser({ email, password });
      created.push(user.id);
      const { error: profileError } = await admin.from("profiles").insert({
        id: user.id,
        role: "student",
        student_id: row.student_id,
        full_name: row.full_name,
        display_name: names[index],
        display_name_suffix: suffixes[index],
        class_id: claimed.class_id,
      });
      if (profileError) throw new Error(profileError.message);
      const { error: identityError } = await admin.from("student_auth_identities").insert({ profile_id: user.id, internal_email: email });
      if (identityError) throw new Error(identityError.message);
      await admin.from("roster_import_rows").update({ created_profile_id: user.id, admin_confirmed: row.row_status === "warning" }).eq("import_id", input.importId).eq("row_number", row.row_number);
    }
  } catch (failure) {
    // Compensation: Auth and profile writes are not one transaction, so undo every account
    // created by this batch (profiles and identities cascade from auth.users).
    for (const id of created) await admin.auth.admin.deleteUser(id);
    await admin
      .from("roster_imports")
      .update({ status: "compensated", error_summary: { message: "provider_failure", createdBeforeFailure: created.length } })
      .eq("id", input.importId);
    await recordAudit(admin, {
      actorId: input.actorId,
      action: "roster.apply_compensated",
      targetType: "roster_import",
      targetId: input.importId,
      requestId: input.requestId,
      after: { compensatedAccounts: created.length, reason: failure instanceof Error ? failure.message.slice(0, 200) : "unknown" },
    });
    throw new ApiError(503, "roster_apply_failed", "Không áp dụng được danh sách; không tài khoản nào được tạo.");
  }

  await admin.from("roster_imports").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", input.importId);
  await recordAudit(admin, {
    actorId: input.actorId,
    action: "roster.apply",
    targetType: "roster_import",
    targetId: input.importId,
    requestId: input.requestId,
    after: { created: created.length, confirmedWarnings: selected.filter((r) => r.row_status === "warning").length },
  });
  return { created: created.length };
}

export async function getRosterImport(admin: SupabaseClient, importId: string) {
  const { data: importRow } = await admin
    .from("roster_imports")
    .select("id, file_name, file_format, status, row_count, valid_count, warning_count, error_count, created_at, applied_at")
    .eq("id", importId)
    .maybeSingle();
  if (!importRow) throw new ApiError(404, "not_found", "Không tìm thấy.");
  const { data: rows } = await admin
    .from("roster_import_rows")
    .select("row_number, student_id, full_name, display_name, student_id_cell_type, row_status, issues, admin_confirmed")
    .eq("import_id", importId)
    .order("row_number");
  return { ...importRow, rows: rows ?? [] };
}
