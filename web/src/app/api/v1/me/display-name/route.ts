import { studentNameSchema } from "@/features/auth/domain/student-name";
import { rpc } from "@/features/arena/server/arena-service";
import { ApiError } from "@/lib/api/errors";
import { assertCsrf, requireActor } from "@/lib/api/guard";
import { readJson, route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const POST = route(async (request, requestId) => {
  const { actor } = await requireActor();
  if (actor.role !== "student") throw new ApiError(403, "forbidden", "Chỉ sinh viên mới dùng bước nhập tên này.");
  await assertCsrf(request, actor.userId);
  const input = await readJson(request, studentNameSchema);
  return ok(await rpc(createServiceRoleClient(getServerEnv()), "set_student_display_name", { p_actor: actor.userId, p_name: input.name }), requestId);
});
