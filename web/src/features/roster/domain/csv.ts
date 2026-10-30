// RFC 4180 CSV reader for roster files (UTF-8, optional BOM, quoted fields, CRLF or LF).
// Values are kept as text; nothing is coerced to numbers (LA-ACC-011).

export type SheetCell = { text: string; kind: "text" | "number" | "other" };

export class RosterFileError extends Error {
  constructor(readonly code: "file_too_large" | "invalid_encoding" | "malformed_file" | "unsupported_format" | "legacy_or_encrypted") {
    super(code);
  }
}

export function parseCsv(bytes: Uint8Array): SheetCell[][] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RosterFileError("invalid_encoding");
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\u0000")) throw new RosterFileError("malformed_file");

  const rows: SheetCell[][] = [];
  let row: SheetCell[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;
  const pushField = () => {
    row.push({ text: field, kind: "text" });
    field = "";
    fieldStarted = false;
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      pushField();
      rows.push(row);
      row = [];
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (inQuotes) throw new RosterFileError("malformed_file");
  if (fieldStarted || field.length > 0 || row.length > 0) {
    pushField();
    rows.push(row);
  }
  return rows;
}
