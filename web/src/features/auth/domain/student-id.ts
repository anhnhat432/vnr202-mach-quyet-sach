// MSSV is always a string (LA-ACC-011): trim, upper-case ASCII letters, keep leading zeros.
// Only minimal safety checks apply until the real roster format is known (LA-ACC-013, LA-ACC-018).

export const STUDENT_ID_MAX_LENGTH = 32;

export type StudentIdIssue = "missing_student_id" | "formula_prefix" | "invalid_characters" | "too_long" | "pattern_mismatch";

export function normalizeStudentId(raw: string): string {
  return raw.trim().replace(/[a-z]/g, (letter) => letter.toUpperCase());
}

export function checkStudentId(studentId: string, pattern?: RegExp): StudentIdIssue[] {
  if (studentId.length === 0) return ["missing_student_id"];
  const issues: StudentIdIssue[] = [];
  if (/^[=+\-@]/.test(studentId)) issues.push("formula_prefix");
  // Whitespace or control characters anywhere inside the identifier.
  if (/[\s\u0000-\u001f\u007f]/.test(studentId)) issues.push("invalid_characters");
  if (studentId.length > STUDENT_ID_MAX_LENGTH) issues.push("too_long");
  if (pattern && issues.length === 0 && !pattern.test(studentId)) issues.push("pattern_mismatch");
  return issues;
}
