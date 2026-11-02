import { rpc } from "@/features/arena/server/arena-service";
import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getServerEnv } from "@/lib/config/server-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Public: which competition the boards and the projector should show (the open one, else the most
// recent one that is closing, settling or finalized). Only public fields; null when there is none.
export const GET = route(async (_request, requestId) => {
  return ok(await rpc(createServiceRoleClient(getServerEnv()), "arena_current_competition", {}), requestId);
});
