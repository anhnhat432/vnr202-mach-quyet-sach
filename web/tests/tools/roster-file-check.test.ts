// @vitest-environment node
// Offline checker for YOUR roster file. Not part of the normal test run (see vitest.config.mts include).
//
//   ROSTER_FILE=/path/to/lop.xlsx npm run roster:check
//
// Reads the file locally with the same code the admin upload uses and prints a masked summary to
// the terminal. Nothing is uploaded, written to disk or stored; names and IDs are masked.
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

import { buildRosterPreview, readRosterFile } from "@/features/roster/domain/roster-table";

const file = process.env.ROSTER_FILE;
const mask = (value: string) => (value.length <= 2 ? "*".repeat(value.length) : `${value[0]}${"*".repeat(value.length - 2)}${value.at(-1)}`);

it.runIf(Boolean(file))("reads the roster file and prints a masked preview", () => {
  const bytes = new Uint8Array(readFileSync(file!));
  const table = readRosterFile(path.basename(file!), bytes);
  const preview = buildRosterPreview(table, { existingStudentIds: new Set(), takenDisplayNames: new Map() });
  const lines = [
    "",
    `FILE CHECK ${path.basename(file!)}: ${bytes.byteLength} bytes, ${table.length} sheet rows read`,
    `rows ${preview.rows.length} | valid ${preview.validCount} | warning ${preview.warningCount} | error ${preview.errorCount}`,
    "row | MSSV (masked) | len | cell | display name | status",
    ...preview.rows.slice(0, 15).map((r) => `${r.rowNumber} | ${mask(r.studentId)} | ${r.studentId.length} | ${r.studentIdCellType} | ${r.displayName}${r.displayNameSuffix ? ` (${r.displayNameSuffix})` : ""} | ${r.status}${r.issues.length ? ` ${r.issues.join(",")}` : ""}`),
    preview.rows.length > 15 ? `... ${preview.rows.length - 15} more rows` : "",
    `MSSV lengths: ${[...new Set(preview.rows.map((r) => r.studentId.length))].sort((a, b) => a - b).join(", ") || "-"}`,
    `MSSV with leading zero: ${preview.rows.filter((r) => /^0/.test(r.studentId)).length} | numeric cells: ${preview.rows.filter((r) => r.studentIdCellType === "number").length}`,
    "",
  ];
  process.stderr.write(lines.join("\n"));
  expect(preview.rows.length).toBeGreaterThan(0);
});
