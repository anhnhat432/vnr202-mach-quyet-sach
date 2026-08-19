import { describe, expect, it } from "vitest";

import { getCauseMapData, getEvidenceMatrixData } from "@/features/content/server/local-content";

describe("public knowledge projections", () => {
  it("projects all six causal lanes", () => {
    const map = getCauseMapData();
    expect(new Set(map.nodes.map((node) => node.lane))).toEqual(
      new Set(["context", "contradiction", "force", "decision", "result", "lesson"]),
    );
  });

  it("exposes only verified sources in the evidence matrix", () => {
    const matrix = getEvidenceMatrixData();
    expect(matrix.sources.length).toBeGreaterThan(0);
    expect(matrix.sources.every((source) => source.verificationStatus === "verified")).toBe(true);
  });
});
