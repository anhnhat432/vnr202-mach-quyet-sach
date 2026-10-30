import { describe, expect, it } from "vitest";
import { groupOfficialAttempts, officialAttempts } from "@/features/passport/attempts";

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

  it("groups official attempts by competition identity, even when names match", () => {
    const attempts = [
      { game: "race", state: "completed", competition: { id: "a", name: "Thi", kind: "official" } },
      { game: "minefield", state: "completed", competition: { id: "a", name: "Thi", kind: "official" } },
      { game: "race", state: "completed", competition: { id: "b", name: "Thi", kind: "official" } },
      { game: "race", state: "voided", competition: { id: "c", name: "Thi", kind: "official" } },
      { game: "race", state: "completed", competition: { id: "d", name: "Diễn tập", kind: "rehearsal" } },
    ];
    const groups = groupOfficialAttempts(attempts);
    expect(groups.map((group) => [group.competition.id, group.attempts.length])).toEqual([["a", 2], ["b", 1]]);
  });
});
