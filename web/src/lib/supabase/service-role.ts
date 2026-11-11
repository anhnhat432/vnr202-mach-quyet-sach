import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { ServerEnv } from "@/lib/config/server-env";

// Service-role client: server code only, used after a server-side authorization check.
export function createServiceRoleClient(env: Pick<ServerEnv, "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
