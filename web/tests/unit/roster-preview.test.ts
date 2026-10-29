// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { SheetCell } from "@/features/roster/domain/csv";
import { RosterHeaderError, buildRosterPreview } from "@/features/roster/domain/roster-table";

const t = (text: string): SheetCell => ({ text, kind: "text" });
const n = (text: string): SheetCell => ({ text, kind: "number" });
const none = { existingStudentIds: new Set<string>(), takenDisplayNames: new Map<string, number>() };

describe("roster preview (LA-ACC-002, LA-AC-018, LA-AC-028)", () => {
  it("accepts Vietnamese header aliases, extra columns and a title row above the header", () => {
    const preview = buildRosterPreview(
      [[t("Danh sách lớp")], [t("STT"), t("Mã sinh viên"), t("HỌ VÀ TÊN"), t("Lớp")], [t("1"), t("he001"), t("Nguyễn Văn An"), t("SE1")]],
      none,
    );
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({ rowNumber: 3, studentId: "HE001", fullName: "Nguyễn Văn An", status: "valid" });
  });

  it("builds rows with normalized MSSV, generated display names and statuses", () => {
    const preview = buildRosterPreview(
      [[t("STT"), t("Mã sinh viên"), t("HỌ VÀ TÊN")], [t("1"), t(" he001 "), t("Nguyễn  Văn An")], [t("2"), t("00042"), t("Trần Bình")]],
      none,
    );
    expect(preview.rows.map((r) => [r.rowNumber, r.studentId, r.fullName, r.displayName, r.status])).toEqual([
      [2, "HE001", "Nguyễn Văn An", "An N.V.", "valid"],
      [3, "00042", "Trần Bình", "Bình T.", "valid"],
    ]);
    expect(preview.validCount).toBe(2);
  });

  it("flags duplicates in file (both rows), existing MSSV, missing data and formula cells", () => {
    const preview = buildRosterPreview(
      [
        [t("MSSV"), t("Họ tên")],
        [t("HE1"), t("An")],
        [t("HE1"), t("An Khác")],
        [t("HE2"), t("")],
        [t(""), t("Không mã")],
        [t("HE3"), t("Đã có")],
        [t("=CMD()"), t("X")],
        [t(""), t("")],
      ],
      { ...none, existingStudentIds: new Set(["HE3"]) },
    );
    const issues = Object.fromEntries(preview.rows.map((r) => [r.rowNumber, r.issues]));
    expect(issues[2]).toContain("duplicate_in_file");
    expect(issues[3]).toContain("duplicate_in_file");
    expect(issues[4]).toContain("missing_full_name");
    expect(issues[5]).toContain("missing_student_id");
    expect(issues[6]).toContain("already_exists");
    expect(issues[7]).toContain("formula_prefix");
    expect(preview.rows).toHaveLength(6);
    expect(preview.errorCount).toBe(6);
  });

  it("marks numeric MSSV cells as warnings that need confirmation", () => {
    const preview = buildRosterPreview([[t("MSSV"), t("Họ tên")], [n("123"), t("An")]], none);
    expect(preview.rows[0]).toMatchObject({ studentId: "123", status: "warning", issues: ["numeric_cell"], studentIdCellType: "number" });
  });

  it("applies a configured MSSV pattern and row limit only when given (N6)", () => {
    const table = [[t("MSSV"), t("Họ tên")], [t("X1"), t("A")], [t("HE1"), t("B")]];
    expect(buildRosterPreview(table, none).errorCount).toBe(0);
    expect(buildRosterPreview(table, { ...none, studentIdPattern: /^HE\d+$/ }).rows[0].issues).toEqual(["pattern_mismatch"]);
    expect(buildRosterPreview(table, { ...none, maxRows: 1 }).rows[1].issues).toEqual(["row_limit_exceeded"]);
  });

  it("assigns display-name suffixes against names already used in the class", () => {
    const preview = buildRosterPreview([[t("MSSV"), t("Họ tên")], [t("A1"), t("Nguyễn Văn An")], [t("A2"), t("Ngô Viết An")]], {
      ...none,
      takenDisplayNames: new Map([["An N.V.", 1]]),
    });
    expect(preview.rows.map((r) => [r.displayName, r.displayNameSuffix])).toEqual([
      ["An N.V.", 2],
      ["An N.V.", 3],
    ]);
  });

  it("requires MSSV and full-name headers, once each", () => {
    expect(() => buildRosterPreview([[t("MSSV"), t("Lớp")]], none)).toThrow(RosterHeaderError);
    expect(() => buildRosterPreview([[t("MSSV"), t("Mã SV"), t("Họ tên")]], none)).toThrow(/duplicate_header/);
    expect(() => buildRosterPreview([], none)).toThrow(/missing_header/);
  });
});
