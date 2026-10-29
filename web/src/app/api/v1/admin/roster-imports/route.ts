import { createRosterPreview } from "@/features/roster/server/roster-service";
import { ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guard";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { ROSTER_FILE_MAX_BYTES } from "@/features/roster/domain/roster-table";

export const POST = route(async (request, requestId) => {
  const ctx = await requireAdmin(request);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > ROSTER_FILE_MAX_BYTES + 64 * 1024) throw new ApiError(422, "validation_error", "Tệp vượt giới hạn kích thước.");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "invalid_request", "Yêu cầu không hợp lệ.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(422, "validation_error", "Thiếu tệp.");
  const classCode = String(form.get("classCode") ?? "").trim();
  const className = String(form.get("className") ?? classCode).trim();
  if (classCode.length < 1 || classCode.length > 40 || className.length > 120) throw new ApiError(422, "validation_error", "Mã lớp không hợp lệ.");
  const preview = await createRosterPreview(
    { admin: ctx.admin, env: ctx.env },
    { actorId: ctx.actor.userId, classCode, className: className || classCode, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()), requestId },
  );
  return ok(preview, requestId, { status: 201 });
});
