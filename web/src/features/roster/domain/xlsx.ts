import { unzipSync } from "fflate";

import { RosterFileError, type SheetCell } from "@/features/roster/domain/csv";

// Minimal, read-only XLSX reader for roster files (decision N9, ADR-004 §7).
// Reads only the first worksheet and the shared strings. Formulas are never evaluated:
// a formula cell yields its cached value. Cell kind is reported so numeric MSSV cells
// can be flagged (LA-ACC-012). Archive limits guard against zip bombs.
const MAX_ENTRIES = 300;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
const NEEDED = /^(\[Content_Types\]\.xml|xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/[^/]+\.xml)$/;

// Excel escapes characters that XML cannot carry as _xHHHH_ (for example CR as _x000D_).
function decodeEscapes(value: string): string {
  return value.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

// Some producers write every element with a namespace prefix (<x:row>, <x:c>). Drop the element
// prefixes so one set of patterns reads both styles; attribute names such as r:id are untouched.
function stripElementPrefixes(xml: string): string {
  return /<\w+:(worksheet|workbook|sst|Relationships)\b/.test(xml) ? xml.replace(/<(\/?)\w+:(?=[A-Za-z])/g, "<$1") : xml;
}

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return '"';
    if (entity === "apos") return "'";
    const code = entity.startsWith("#x") ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

function textRuns(xml: string): string {
  // Phonetic guides (<rPh>) are annotations, not part of the cell text.
  const visible = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").replace(/<phoneticPr\b[^>]*\/>/g, "");
  return decodeEscapes([...visible.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map((m) => decodeXml(m[1] ?? "")).join(""));
}

function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? "";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

export function parseXlsx(bytes: Uint8Array): SheetCell[][] {
  let entries = 0;
  let total = 0;
  // Compound File magic: an old binary .xls, or an OOXML file protected with a password.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) throw new RosterFileError("legacy_or_encrypted");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        entries += 1;
        if (entries > MAX_ENTRIES) throw new RosterFileError("malformed_file");
        if (!NEEDED.test(file.name)) return false;
        total += file.originalSize;
        if (file.originalSize > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES) throw new RosterFileError("file_too_large");
        return true;
      },
    });
  } catch (error) {
    if (error instanceof RosterFileError) throw error;
    throw new RosterFileError("unsupported_format");
  }
  const read = (name: string) => {
    const raw = files[name] ? new TextDecoder("utf-8").decode(files[name]) : undefined;
    return raw === undefined ? undefined : stripElementPrefixes(raw);
  };

  const workbook = read("xl/workbook.xml");
  const rels = read("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new RosterFileError("unsupported_format");
  // First sheet the user can see: a hidden sheet is never read, so stale or private data in a
  // hidden tab cannot be imported by accident.
  const firstSheet = [...workbook.matchAll(/<sheet\s[^>]*>/g)].map((m) => m[0]).find((tag) => !/^(hidden|veryHidden)$/.test(attr(tag, "state") ?? ""));
  const relId = firstSheet && (attr(firstSheet, "r:id") ?? attr(firstSheet, "id"));
  const relTag = relId ? [...rels.matchAll(/<Relationship\s[^>]*>/g)].map((m) => m[0]).find((tag) => attr(tag, "Id") === relId) : undefined;
  const target = relTag ? attr(relTag, "Target") : undefined;
  if (!target) throw new RosterFileError("unsupported_format");
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`.replace(/^xl\/\.\.\//, "");
  const sheet = read(sheetPath);
  if (!sheet) throw new RosterFileError("unsupported_format");

  const shared = [...(read("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1]));

  const rows: SheetCell[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(attr(` ${rowMatch[1]}`, "r") ?? rows.length + 1);
    const cells: SheetCell[] = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = ` ${cellMatch[1]}`;
      const body = cellMatch[2] ?? "";
      const ref = attr(tag, "r");
      const index = ref ? columnIndex(ref) : cells.length;
      const type = attr(tag, "t") ?? "n";
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let cell: SheetCell;
      if (type === "s") cell = { text: shared[Number(raw)] ?? "", kind: "text" };
      else if (type === "inlineStr") cell = { text: textRuns(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? ""), kind: "text" };
      else if (type === "str") cell = { text: decodeEscapes(decodeXml(raw ?? "")), kind: "text" };
      else if (type === "n") cell = { text: raw === undefined ? "" : decodeXml(raw), kind: raw === undefined ? "text" : "number" };
      else cell = { text: decodeXml(raw ?? ""), kind: "other" };
      cells[index] = cell;
    }
    for (let i = 0; i < cells.length; i += 1) cells[i] ??= { text: "", kind: "text" };
    rows[rowNumber - 1] = cells;
  }
  for (let i = 0; i < rows.length; i += 1) rows[i] ??= [];
  return rows;
}
