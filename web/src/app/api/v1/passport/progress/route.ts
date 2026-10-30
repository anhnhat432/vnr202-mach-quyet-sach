import { z } from "zod";
import { getPublishedDossierBySlug } from "@/features/content/server/dossier-repository";
import { progressSchema, validateProgress } from "@/features/passport/progress";
import { rpc } from "@/features/arena/server/arena-service";
import { ApiError } from "@/lib/api/errors";
import { requireStudent } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

export const GET = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: false });
  const { data, error } = await ctx.admin.from("student_dossier_progress").select("dossier_id, state, completed_at").eq("profile_id", ctx.actor.userId);
  if (error) throw error;
  return ok(data, requestId);
});

export const POST = route(async (request, requestId) => {
  const ctx = await requireStudent(request, { mutating: true });
  const body = await readJson(request, z.strictObject({ slug: z.string().min(1).max(150), state: progressSchema }));
  const dossier = await getPublishedDossierBySlug(body.slug);
  if (!dossier) throw new ApiError(404, "not_found", "Không tìm thấy hồ sơ.");
  let state;
  try { state = validateProgress(dossier, body.state); }
  catch { throw new ApiError(422, "invalid_progress", "Tiến độ hồ sơ không hợp lệ."); }
  await rpc(ctx.admin, "save_dossier_progress", { p_profile_id: ctx.actor.userId, p_dossier_id: dossier.id, p_state: state });
  return ok({ saved: true }, requestId);
});
