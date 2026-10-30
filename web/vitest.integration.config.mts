import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run against a real Postgres + GoTrue + PostgREST stack (supabase start, or
// scripts/db/local-stack.sh). They never mock Supabase Auth. Variables come from the environment
// or from the harness file, which is git-ignored and holds only per-machine generated secrets.
function loadStackEnv(): Record<string, string> {
  try {
    const file = readFileSync(path.resolve(import.meta.dirname, "../.local/supabase/stack.env"), "utf8");
    return Object.fromEntries(file.split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  } catch {
    return {};
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    env: loadStackEnv(),
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
