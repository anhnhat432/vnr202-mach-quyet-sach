import path from "node:path";
import { defineConfig } from "vitest/config";

// Runs only the offline roster file checker (npm run roster:check).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/helpers/server-only-stub.ts") } },
  test: { environment: "node", include: ["tests/tools/**/*.test.ts"], reporters: ["dot"] },
});
