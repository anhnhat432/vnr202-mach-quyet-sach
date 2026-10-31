import { z } from "zod";
import type { PublishedDossier } from "@/features/content/contracts/dossier";

const stages = ["briefing", "evidence", "decision", "consequences", "comparison", "connections"] as const;
export const progressSchema = z.strictObject({
  stage: z.enum(stages),
  selectedEvidence: z.array(z.string().min(1).max(100)).max(30),
  selectedDecision: z.string().max(100),
});
export type Progress = z.infer<typeof progressSchema>;

export function validateProgress(dossier: PublishedDossier, input: unknown): Progress {
  const state = progressSchema.parse(input);
  const evidence = new Set(state.selectedEvidence);
  if (evidence.size !== state.selectedEvidence.length || state.selectedEvidence.some((id) => !dossier.experience.evidence.some((item) => item.id === id))) throw new Error("invalid_evidence");
  const stage = stages.indexOf(state.stage);
  if (stage >= 2 && evidence.size < dossier.experience.decision.requiredEvidenceCount) throw new Error("insufficient_evidence");
  if (state.selectedDecision && !dossier.experience.decision.options.some((option) => option.id === state.selectedDecision)) throw new Error("invalid_decision");
  if (stage >= 3 && !state.selectedDecision) throw new Error("missing_decision");
  return state;
}
