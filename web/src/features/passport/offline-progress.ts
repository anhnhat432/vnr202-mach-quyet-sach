import { progressSchema, type Progress } from "./progress";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readDraft(storage: StorageLike, key: string): Progress | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = progressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function saveDraft(storage: StorageLike, key: string, state: Progress): void {
  storage.setItem(key, JSON.stringify(state));
}

export function clearDraftIfUnchanged(storage: StorageLike, key: string, state: Progress): void {
  if (storage.getItem(key) === JSON.stringify(state)) storage.removeItem(key);
}
