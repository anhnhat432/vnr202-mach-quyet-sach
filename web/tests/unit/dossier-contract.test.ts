import { describe, expect, it } from "vitest";

import { dossierExperienceSchema } from "@/features/content/contracts/dossier";

describe("dossier experience schema", () => {
  it("requires all six experience stages", () => {
    const parsed = dossierExperienceSchema.safeParse({ title: "Thiếu dữ liệu" });
    expect(parsed.success).toBe(false);
  });
});
