import { describe, expect, it } from "vitest";

import { checkStudentId, normalizeStudentId } from "@/features/auth/domain/student-id";

describe("MSSV normalization (LA-ACC-011, LA-ACC-018)", () => {
  it("trims and upper-cases Latin letters only, keeping leading zeros", () => {
    expect(normalizeStudentId("  he00123 ")).toBe("HE00123");
    expect(normalizeStudentId("000123")).toBe("000123");
  });

  it("never converts to a number", () => {
    expect(typeof normalizeStudentId("0012")).toBe("string");
    expect(normalizeStudentId("0012")).not.toBe("12");
  });

  it("accepts any non-empty value without a configured pattern", () => {
    expect(checkStudentId("HE176543")).toEqual([]);
    expect(checkStudentId("0012")).toEqual([]);
  });

  it("applies only the minimal safety checks", () => {
    expect(checkStudentId("")).toContain("missing_student_id");
    expect(checkStudentId("=HYPERLINK(1)")).toContain("formula_prefix");
    expect(checkStudentId("-1")).toContain("formula_prefix");
    expect(checkStudentId("HE 1")).toContain("invalid_characters");
    expect(checkStudentId("HE\u00001")).toContain("invalid_characters");
    expect(checkStudentId("A".repeat(33))).toContain("too_long");
  });

  it("checks a configured pattern only when one is provided (N6 open)", () => {
    expect(checkStudentId("ABC1", /^[A-Z]{2}\d+$/)).toContain("pattern_mismatch");
    expect(checkStudentId("AB1", /^[A-Z]{2}\d+$/)).toEqual([]);
  });
});
