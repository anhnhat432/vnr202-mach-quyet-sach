import { describe, expect, it } from "vitest";
import { validateProgress } from "@/features/passport/progress";
import { getPublishedDossierBySlug } from "@/features/content/server/dossier-repository";

describe("dossier progress", () => {
  it("rejects completion without the actual evidence and decision", async () => {
    const dossier = (await getPublishedDossierBySlug("hop-nhat-de-mo-duong"))!;
    expect(() => validateProgress(dossier, { stage: "connections", selectedEvidence: [], selectedDecision: "" })).toThrow();
  });

  it("accepts the final stage when a valid decision and enough real evidence were chosen", async () => {
    const dossier = (await getPublishedDossierBySlug("hop-nhat-de-mo-duong"))!;
    const state = { stage: "connections", selectedEvidence: dossier.experience.evidence.slice(0, dossier.experience.decision.requiredEvidenceCount).map((e) => e.id), selectedDecision: dossier.experience.decision.options[0].id };
    expect(validateProgress(dossier, state).stage).toBe("connections");
  });
});
