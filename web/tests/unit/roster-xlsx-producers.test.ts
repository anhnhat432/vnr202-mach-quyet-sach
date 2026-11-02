// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { RosterFileError } from "@/features/roster/domain/csv";
import { buildRosterPreview, readRosterFile, type RosterRow } from "@/features/roster/domain/roster-table";
import { parseXlsx } from "@/features/roster/domain/xlsx";

const dir = path.resolve(import.meta.dirname, "../fixtures/roster");
const load = (name: string) => new Uint8Array(readFileSync(path.join(dir, name)));
const preview = (name: string) => buildRosterPreview(readRosterFile(name, load(name)), { existingStudentIds: new Set(), takenDisplayNames: new Map() });
const summary = (rows: RosterRow[]) => rows.map((r) => [r.studentId, r.fullName, r.status]);

const EXPECTED_ROSTER = [
  ["00123", "Nguyễn Văn An", "valid"],
  ["HE000124", "Trần Thị Bình", "valid"],
  ["0456789", "Lê Thị Ngọc Ánh", "valid"],
  ["HE000126", "Đặng Quốc Việt", "valid"],
];

describe("files written by independent producers (synthetic data)", () => {
  it("XlsxWriter, shared strings, title row, merged cells: IDs keep leading zeros, Vietnamese intact", () => {
    const p = preview("xlsxwriter-text-ids.xlsx");
    expect(summary(p.rows.slice(0, 4))).toEqual(EXPECTED_ROSTER);
    expect(p.rows[0].rowNumber).toBe(4); // header is on row 3 under a merged title row
  });

  it("XlsxWriter inline-string mode and LibreOffice (real app, text-typed column) give the same roster", () => {
    expect(summary(preview("xlsxwriter-inline-strings.xlsx").rows)).toEqual(EXPECTED_ROSTER);
    expect(summary(preview("lo-from-csv.xlsx").rows)).toEqual(EXPECTED_ROSTER);
  });

  it("decomposed (NFD) Vietnamese names are normalized to NFC", () => {
    const row = preview("xlsxwriter-inline-strings.xlsx").rows[2];
    expect(row.fullName).toBe("Lê Thị Ngọc Ánh");
    expect(row.fullName).toBe(row.fullName.normalize("NFC"));
    expect(row.displayName).toBe("Ánh L.T.N.");
  });

  it("numeric ID cells (what Excel and LibreOffice do to 00123 in a General cell) are flagged, never silently accepted", () => {
    for (const name of ["xlsxwriter-numeric-ids.xlsx", "lo-general-cells.xlsx", "openpyxl-mixed.xlsx"]) {
      const flagged = preview(name).rows.filter((r) => r.issues.includes("numeric_cell"));
      expect(flagged.length, name).toBeGreaterThan(0);
      expect(flagged.every((r) => r.status === "warning" && r.studentIdCellType === "number")).toBe(true);
    }
    const lo = preview("lo-general-cells.xlsx").rows;
    expect(lo[0].studentId).toBe("123"); // the zeros are already gone in the file: the warning is the only protection
    expect(lo[1]).toMatchObject({ studentId: "HE000124", status: "valid" });
  });

  it("openpyxl text-formatted cell keeps its zeros while a number cell in the same column is flagged", () => {
    expect(summary(preview("openpyxl-mixed.xlsx").rows)).toEqual([
      ["00777", "Hoàng Văn Em", "valid"],
      ["778", "Vũ Thị Phương", "warning"],
      ["00779", "Bùi Văn Giang", "valid"],
    ]);
  });

  it("reads only the first VISIBLE sheet: a hidden sheet is never imported", () => {
    const p = preview("openpyxl-hidden-first-sheet.xlsx");
    expect(summary(p.rows)).toEqual(EXPECTED_ROSTER);
    expect(JSON.stringify(p.rows)).not.toContain("SAI0001");
  });

  it("rich text runs are joined; XML entities and Excel's _x000D_ escape are decoded", () => {
    expect(preview("xlsxwriter-rich-text.xlsx").rows[0]).toMatchObject({ studentId: "HE000200", fullName: "Phạm Thị Cúc" });
    const rows = preview("xlsxwriter-special-chars.xlsx").rows;
    expect(rows[0].fullName).toBe("Võ <Tên> & \"Họ\" 'Lạ' Dòng 2"); // CR/LF collapsed to one space, no _x000D_ left
    expect(rows[1]).toMatchObject({ studentId: "=1+1", status: "error" });
    expect(rows[1].issues).toContain("formula_prefix");
  });

  it("formula cells return their cached value and are never evaluated", () => {
    const p = preview("xlsxwriter-text-ids.xlsx");
    const formulaRow = p.rows.find((r) => r.rowNumber === 10)!;
    expect(formulaRow.fullName).toBe("Nguyễn Văn An"); // cached result of =C4&""
    expect(formulaRow.issues).toContain("missing_student_id");
  });
});

describe("unreadable files fail closed with a specific reason", () => {
  it("rejects truncated, garbage and non-workbook archives as unsupported_format", () => {
    for (const name of ["corrupt-truncated.xlsx", "corrupt-garbage.xlsx", "corrupt-not-a-workbook.xlsx", "not-a-workbook.xlsx"]) {
      expect(() => readRosterFile(name, load(name)), name).toThrow(/unsupported_format/);
    }
  });

  it("recognises password-protected and legacy binary .xls (both are Compound Files)", () => {
    for (const name of ["encrypted-password.xlsx", "legacy-binary-renamed.xlsx"]) {
      expect(() => readRosterFile(name, load(name)), name).toThrow(/legacy_or_encrypted/);
    }
  });
});

// Variants a real producer may emit that the generators above cannot; built by rewriting a good file.
function rewrite(name: string, edit: (files: Record<string, string>) => void): Uint8Array {
  const files = Object.fromEntries(Object.entries(unzipSync(load(name))).map(([k, v]) => [k, strFromU8(v)]));
  edit(files);
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}

describe("structural variants (synthetic rewrites of a good file)", () => {
  const baseline = summary(parseRoster(load("xlsxwriter-inline-strings.xlsx")));

  function parseRoster(bytes: Uint8Array): RosterRow[] {
    return buildRosterPreview(parseXlsx(bytes), { existingStudentIds: new Set(), takenDisplayNames: new Map() }).rows;
  }

  it("namespace-prefixed elements (<x:row>, <x:c>)", () => {
    const bytes = rewrite("xlsxwriter-inline-strings.xlsx", (f) => {
      for (const key of ["xl/workbook.xml", "xl/worksheets/sheet1.xml"]) {
        f[key] = f[key].replace(/xmlns="([^"]+)"/, 'xmlns:x="$1"').replace(/<(\/?)(?!\?)([A-Za-z])/g, "<$1x:$2");
      }
    });
    expect(summary(parseRoster(bytes))).toEqual(baseline);
  });

  it("absolute relationship targets (/xl/worksheets/sheet1.xml)", () => {
    const bytes = rewrite("xlsxwriter-inline-strings.xlsx", (f) => {
      f["xl/_rels/workbook.xml.rels"] = f["xl/_rels/workbook.xml.rels"].replace('Target="worksheets/sheet1.xml"', 'Target="/xl/worksheets/sheet1.xml"');
    });
    expect(summary(parseRoster(bytes))).toEqual(baseline);
  });

  it("phonetic annotations (<rPh>) are not part of the text", () => {
    const bytes = rewrite("xlsxwriter-text-ids.xlsx", (f) => {
      f["xl/sharedStrings.xml"] = f["xl/sharedStrings.xml"].replace("Nguyễn Văn An</t>", "Nguyễn Văn An</t><rPh sb=\"0\" eb=\"1\"><t>ngu</t></rPh>");
    });
    expect(parseRoster(bytes).find((r) => r.studentId === "00123")?.fullName).toBe("Nguyễn Văn An");
  });

  it("sparse cells and missing r attributes still align columns", () => {
    const bytes = rewrite("xlsxwriter-inline-strings.xlsx", (f) => {
      f["xl/worksheets/sheet1.xml"] = f["xl/worksheets/sheet1.xml"].replace(/ r="[A-Z]+\d+"(?= t="inlineStr")/g, "");
    });
    expect(summary(parseRoster(bytes))).toEqual(baseline);
  });
});

describe("decompression limits", () => {
  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

  // Hand-built single-entry zip whose central directory may declare a size different from the real one.
  function zipWithDeclaredSize(entryName: string, deflated: Uint8Array, declared: number): Uint8Array {
    const name = strToU8(entryName);
    const crc = 0;
    const local = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0), ...u32(crc), ...u32(deflated.length), ...u32(declared), ...u16(name.length), ...u16(0), ...name, ...deflated];
    const central = [0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0), ...u32(crc), ...u32(deflated.length), ...u32(declared), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...name];
    const eocd = [0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(1), ...u16(1), ...u32(central.length), ...u32(local.length), ...u16(0)];
    return Uint8Array.from([...local, ...central, ...eocd]);
  }

  it("an entry that DECLARES more than 16 MiB is refused before it is inflated", async () => {
    const { deflateSync } = await import("fflate");
    const bomb = zipWithDeclaredSize("xl/worksheets/sheet1.xml", deflateSync(new Uint8Array(1024)), 17 * 1024 * 1024);
    expect(() => parseXlsx(bomb)).toThrow(/file_too_large/);
  });

  it("an entry that LIES about its size (declares 100 bytes, inflates to 64 MiB) is truncated, not expanded in memory", async () => {
    const { deflateSync } = await import("fflate");
    const bomb = zipWithDeclaredSize("xl/worksheets/sheet1.xml", deflateSync(new Uint8Array(64 * 1024 * 1024)), 100);
    expect(bomb.length).toBeLessThan(200 * 1024);
    const before = process.memoryUsage().rss;
    expect(() => parseXlsx(bomb)).toThrow(RosterFileError); // truncated data is not a workbook
    expect(process.memoryUsage().rss - before).toBeLessThan(32 * 1024 * 1024);
  });

  it("more than 300 archive entries are refused", () => {
    const many = Object.fromEntries(Array.from({ length: 301 }, (_, i) => [`junk/${i}.txt`, strToU8("x")]));
    expect(() => parseXlsx(zipSync(many))).toThrow(/malformed_file/);
  });
});
