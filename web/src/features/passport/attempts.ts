export function officialAttempts<T extends { state: string; competition: { kind: string } }>(attempts: readonly T[]): T[] {
  return attempts.filter((attempt) => attempt.competition.kind === "official" && attempt.state !== "voided");
}
