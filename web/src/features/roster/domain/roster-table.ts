import { checkStudentId, normalizeStudentId, type StudentIdIssue } from "@/features/auth/domain/student-id";
import { RosterFileError, parseCsv, type SheetCell } from "@/features/roster/domain/csv";
import { assignDisplayNameSuffixes, classroomDisplayName } from "@/features/roster/domain/display-name";
import { parseXlsx } from "@/features/roster/domain/xlsx";

// Turns an uploaded class list into a preview (LA-ACC-001/002/010..014, LA-PRV-003).
// Nothing here touches the database; the server stores the preview and applies it later.

export const ROSTER_FILE_MAX_BYTES = 1024 * 1024; // LA-ACC-017 [THỬ NGHIỆM]

export type RosterIssue =
  | StudentIdIssue
  | "missing_full_name"
  | "full_name_too_long"
  | "duplicate_in_file"
  | "already_exists"
  | "numeric_cell"
  | "row_limit_exceeded";

const WARNINGS: ReadonlySet<RosterIssue> = new Set(["numeric_cell"]);

export type RosterRow = {
  rowNumber: number;
  studentId: string;
  fullName: string;
  displayName: string;
  displayNameSuffix: number | null;
  studentIdCellType: SheetCell["kind"];
  status: "valid" | "warning" | "error";
  issues: RosterIssue[];
};

export type RosterPreview = { rows: RosterRow[]; validCount: number; warningCount: number; errorCount: number };

const HEADER_ALIASES: Record<"studentId" | "fullName" | "displayName", string[]> = {
  studentId: ["student_id", "studentid", "mssv", "ma sinh vien", "ma sv", "masv"],
  fullName: ["full_name", "fullname", "ho va ten", "ho ten", "hoten", "ten sinh vien"],
  displayName: ["display_name", "displayname", "ten hien thi"],
};

function headerKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function readRosterFile(fileName: string, bytes: Uint8Array): SheetCell[][] {
  if (bytes.byteLength > ROSTER_FILE_MAX_BYTES) throw new RosterFileError("file_too_large");
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsv(bytes);
  if (lower.endsWith(".xlsx")) return parseXlsx(bytes);
  throw new RosterFileError("unsupported_format");
}

export class RosterHeaderError extends Error {
  constructor(readonly code: "missing_header" | "duplicate_header") {
    super(code);
  }
}

export function buildRosterPreview(
  table: SheetCell[][],
  options: { existingStudentIds: ReadonlySet<string>; takenDisplayNames: ReadonlyMap<string, number>; studentIdPattern?: RegExp; maxRows?: number },
): RosterPreview {
  // Class lists exported from Excel often carry title rows; the header is the first of the
  // first ten rows that names both an MSSV column and a full-name column.
  const mapColumns = (row: SheetCell[]) => {
    const found: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
    row.forEach((cell, index) => {
      const key = headerKey(cell.text);
      for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[keyof typeof HEADER_ALIASES, string[]]>) {
        if (aliases.includes(key)) {
          if (found[field] !== undefined) throw new RosterHeaderError("duplicate_header");
          found[field] = index;
        }
      }
    });
    return found;
  };
  let headerIndex = -1;
  let columns: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  for (let i = 0; i < Math.min(table.length, 10); i += 1) {
    const found = mapColumns(table[i]);
    if (found.studentId !== undefined && found.fullName !== undefined) {
      headerIndex = i;
      columns = found;
      break;
    }
  }
  if (headerIndex < 0) throw new RosterHeaderError("missing_header");
  if (columns.studentId === undefined || columns.fullName === undefined) throw new RosterHeaderError("missing_header");

  const seen = new Map<string, number>();
  const draft: RosterRow[] = [];
  table.slice(headerIndex + 1).forEach((cells, offset) => {
    if (cells.every((cell) => cell.text.trim() === "")) return;
    const idCell = cells[columns.studentId!] ?? { text: "", kind: "text" as const };
    const studentId = normalizeStudentId(idCell.text);
    const fullName = (cells[columns.fullName!]?.text ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
    const providedDisplay = columns.displayName !== undefined ? cells[columns.displayName]?.text.trim() ?? "" : "";
    const issues: RosterIssue[] = [...checkStudentId(studentId, options.studentIdPattern)];
    if (idCell.kind === "number") issues.push("numeric_cell");
    if (fullName.length === 0) issues.push("missing_full_name");
    if (fullName.length > 100) issues.push("full_name_too_long");
    if (studentId && options.existingStudentIds.has(studentId)) issues.push("already_exists");
    if (studentId) {
      if (seen.has(studentId)) {
        issues.push("duplicate_in_file");
        const first = draft.find((row) => row.rowNumber === seen.get(studentId));
        if (first && !first.issues.includes("duplicate_in_file")) first.issues.push("duplicate_in_file");
      } else {
        seen.set(studentId, headerIndex + offset + 2);
      }
    }
    if (options.maxRows !== undefined && draft.length >= options.maxRows) issues.push("row_limit_exceeded");
    draft.push({
      rowNumber: headerIndex + offset + 2,
      studentId,
      fullName,
      displayName: (providedDisplay || classroomDisplayName(fullName)).slice(0, 40),
      displayNameSuffix: null,
      studentIdCellType: idCell.kind,
      status: "valid",
      issues,
    });
  });

  for (const row of draft) {
    row.status = row.issues.length === 0 ? "valid" : row.issues.every((issue) => WARNINGS.has(issue)) ? "warning" : "error";
  }
  const importable = draft.filter((row) => row.status !== "error");
  const suffixes = assignDisplayNameSuffixes(importable.map((row) => row.displayName), options.takenDisplayNames);
  importable.forEach((row, index) => {
    row.displayNameSuffix = suffixes[index];
  });
  return {
    rows: draft,
    validCount: draft.filter((row) => row.status === "valid").length,
    warningCount: draft.filter((row) => row.status === "warning").length,
    errorCount: draft.filter((row) => row.status === "error").length,
  };
}
