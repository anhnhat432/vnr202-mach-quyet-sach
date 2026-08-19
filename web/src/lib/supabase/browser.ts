import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/config/env";

export function createBrowserClient() {
  const env = getPublicEnv();
  return createSupabaseBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
