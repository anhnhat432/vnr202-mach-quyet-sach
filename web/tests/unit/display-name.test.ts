import { describe, expect, it } from "vitest";

import { assignDisplayNameSuffixes, classroomDisplayName, normalizeDisplayName } from "@/features/roster/domain/display-name";

describe("classroom display name (LA-PRV-003)", () => {
  it("uses the given name plus initials of family and middle names", () => {
    expect(classroomDisplayName("Nguyễn Văn An")).toBe("An N.V.");
    expect(classroomDisplayName("Trần Thị Ngọc Bích")).toBe("Bích T.T.N.");
    expect(classroomDisplayName("Lê An")).toBe("An L.");
  });

  it("keeps single-word names and collapses whitespace", () => {
    expect(classroomDisplayName("  An  ")).toBe("An");
    expect(classroomDisplayName("Nguyễn   Văn\tAn")).toBe("An N.V.");
  });

  it("upper-cases initials including Vietnamese letters", () => {
    expect(classroomDisplayName("đặng ân")).toBe("ân Đ.");
  });

  it("never exceeds 40 characters", () => {
    expect(classroomDisplayName(`${"Nguyễn ".repeat(30)}An`).length).toBeLessThanOrEqual(40);
  });

  it("normalizes admin edits and rejects empty or control characters", () => {
    expect(normalizeDisplayName("  An  N.V. ")).toBe("An N.V.");
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName("A\u0007")).toBeNull();
    expect(normalizeDisplayName("x".repeat(41))).toBeNull();
  });

  it("assigns stable suffixes to duplicates, after names already taken (LA-LB-012)", () => {
    const result = assignDisplayNameSuffixes(["An N.V.", "Bình T.", "An N.V.", "An N.V."], new Map([["An N.V.", 1]]));
    expect(result).toEqual([2, null, 3, 4]);
    expect(assignDisplayNameSuffixes(["An N.V.", "An N.V."], new Map())).toEqual([null, 2]);
  });
});
