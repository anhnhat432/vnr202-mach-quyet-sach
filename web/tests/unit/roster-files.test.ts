// @vitest-environment node
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { RosterFileError, parseCsv } from "@/features/roster/domain/csv";
import { readRosterFile } from "@/features/roster/domain/roster-table";
import { parseXlsx } from "@/features/roster/domain/xlsx";
import { buildXlsx } from "../helpers/xlsx-fixture";

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("CSV reader", () => {
  it("keeps leading zeros, quotes, commas, BOM and CRLF", () => {
    const rows = parseCsv(utf8('﻿MSSV,Họ và tên\r\n00123,"Nguyễn, Văn ""An"""\r\nHE1,Bình\n'));
    expect(rows.map((r) => r.map((c) => c.text))).toEqual([
      ["MSSV", "Họ và tên"],
      ["00123", 'Nguyễn, Văn "An"'],
      ["HE1", "Bình"],
    ]);
    expect(rows[1][0].kind).toBe("text");
  });

  it("rejects invalid UTF-8, NUL bytes and unterminated quotes", () => {
    expect(() => parseCsv(new Uint8Array([0x4d, 0xff, 0xfe]))).toThrow(RosterFileError);
    expect(() => parseCsv(utf8("a,b\u0000\n"))).toThrow(RosterFileError);
    expect(() => parseCsv(utf8('a,"b\n'))).toThrow(RosterFileError);
  });
});

describe("XLSX reader", () => {
  it("reads only the first sheet with text, inline and formula-cached cells", () => {
    const rows = parseXlsx(buildXlsx([["MSSV", "Họ và tên"], ["00123", { inline: "Nguyễn Văn An" }], [{ f: "A1&\"x\"", v: "HE9" }, "Bình"]]));
    expect(rows.map((r) => r.map((c) => c.text))).toEqual([
      ["MSSV", "Họ và tên"],
      ["00123", "Nguyễn Văn An"],
      ["HE9", "Bình"],
    ]);
    expect(JSON.stringify(rows)).not.toContain("SHOULD_NOT_BE_READ");
  });

  it("reports numeric cells so lost leading zeros can be flagged (LA-ACC-012)", () => {
    const rows = parseXlsx(buildXlsx([["MSSV", "Họ và tên"], [{ n: "123" }, "An"]]));
    expect(rows[1][0]).toEqual({ text: "123", kind: "number" });
  });

  it("rejects non-xlsx archives and oversized entries", () => {
    expect(() => parseXlsx(utf8("not a zip"))).toThrow(RosterFileError);
    expect(() => parseXlsx(zipSync({ "hello.txt": utf8("x") }))).toThrow(RosterFileError);
    const bomb = buildXlsx([["MSSV", "Họ và tên"]], { "xl/worksheets/sheet3.xml": new Uint8Array(17 * 1024 * 1024) });
    expect(() => parseXlsx(bomb)).toThrow(/file_too_large/);
  });

  it("dispatches by extension and enforces the 1 MiB file limit", () => {
    expect(() => readRosterFile("lop.xls", utf8("x"))).toThrow(/unsupported_format/);
    expect(() => readRosterFile("lop.csv", new Uint8Array(1024 * 1024 + 1))).toThrow(/file_too_large/);
    expect(readRosterFile("LOP.CSV", utf8("MSSV,Họ tên\n")).length).toBe(1);
  });
});
