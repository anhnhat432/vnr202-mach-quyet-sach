import { describe, expect, it } from "vitest";
import { readDraft, saveDraft, clearDraftIfUnchanged } from "@/features/passport/offline-progress";

describe("device progress drafts", () => {
  it("survives reload and does not clear a newer local edit after an older save completes", () => {
    const storage = new Map<string, string>();
    const store = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); } };
    const first = { stage: "evidence" as const, selectedEvidence: [], selectedDecision: "" };
    const second = { stage: "evidence" as const, selectedEvidence: ["c1-e1"], selectedDecision: "" };
    saveDraft(store, "x", first);
    expect(readDraft(store, "x")).toEqual(first);
    saveDraft(store, "x", second);
    clearDraftIfUnchanged(store, "x", first);
    expect(readDraft(store, "x")).toEqual(second);
    clearDraftIfUnchanged(store, "x", second);
    expect(readDraft(store, "x")).toBeNull();
  });
});
