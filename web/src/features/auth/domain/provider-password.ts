import { createHmac } from "node:crypto";

// LA-ACC-005: the password typed by the student never reaches Supabase Auth. Auth stores a
// derived password that only this server can compute, so the public Auth endpoint cannot be
// used with the shared default password to bypass the application's rate limits.
const MIN_PEPPER_LENGTH = 32;

function assertPepper(pepper: string) {
  if (pepper.length < MIN_PEPPER_LENGTH) throw new Error("AUTH_PASSWORD_PEPPER is too short");
}

export function deriveProviderPassword(pepper: string, normalizedStudentId: string, enteredPassword: string): string {
  assertPepper(pepper);
  return createHmac("sha256", pepper).update(`provider-password:${normalizedStudentId}:${enteredPassword}`).digest("base64url");
}

// Keyed hash for rate-limit keys and audit fields (IP, MSSV): stable, irreversible without the pepper.
export function hashIdentifier(pepper: string, purpose: string, value: string): string {
  assertPepper(pepper);
  return createHmac("sha256", pepper).update(`${purpose}:${value}`).digest("hex");
}
