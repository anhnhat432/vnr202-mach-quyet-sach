import { strToU8, zipSync } from "fflate";

// Builds a minimal .xlsx in memory so no binary fixtures are committed.
// Cell spec: string -> shared string, { n: "123" } -> numeric cell, { inline: "x" } -> inline string.
export type FixtureCell = string | { n: string } | { inline: string } | { f: string; v: string };

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildXlsx(rows: FixtureCell[][], extraFiles: Record<string, Uint8Array> = {}): Uint8Array {
  const shared: string[] = [];
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
          if (typeof cell === "string") {
            shared.push(cell);
            return `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`;
          }
          if ("n" in cell) return `<c r="${ref}"><v>${cell.n}</v></c>`;
          if ("inline" in cell) return `<c r="${ref}" t="inlineStr"><is><t>${escape(cell.inline)}</t></is></c>`;
          return `<c r="${ref}" t="str"><f>${escape(cell.f)}</f><v>${escape(cell.v)}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "xl/workbook.xml": strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Lop" sheetId="1" r:id="rId1"/><sheet name="Khac" sheetId="2" r:id="rId2"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/sharedStrings.xml": strToU8(`<sst>${shared.map((s) => `<si><t xml:space="preserve">${escape(s)}</t></si>`).join("")}</sst>`),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`),
    "xl/worksheets/sheet2.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>SHOULD_NOT_BE_READ</t></is></c></row></sheetData></worksheet>'),
    ...extraFiles,
  });
}
