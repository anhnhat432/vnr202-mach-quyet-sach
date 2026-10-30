import { describe, expect, it } from "vitest";
import { officialAttempts } from "@/features/passport/attempts";

describe("Student Passport competition history", () => {
  it("excludes rehearsal and voided attempts while retaining both official games in server order", () => {
    const attempts = [
      { game: "race", state: "completed", competition: { kind: "rehearsal" } },
      { game: "race", state: "voided", competition: { kind: "official" } },
      { game: "minefield", state: "completed", competition: { kind: "official" } },
      { game: "race", state: "active", competition: { kind: "official" } },
    ] as const;
    expect(officialAttempts(attempts)).toEqual([attempts[2], attempts[3]]);
  });
});
