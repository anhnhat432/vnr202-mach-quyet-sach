export function officialAttempts<T extends { state: string; competition: { kind: string } }>(attempts: readonly T[]): T[] {
  return attempts.filter((attempt) => attempt.competition.kind === "official" && attempt.state !== "voided");
}

export function groupOfficialAttempts<T extends { state: string; competition: { id: string; kind: string } }>(attempts: readonly T[]) {
  const groups = new Map<string, { competition: T["competition"]; attempts: T[] }>();
  for (const attempt of officialAttempts(attempts)) {
    const group = groups.get(attempt.competition.id);
    if (group) group.attempts.push(attempt);
    else groups.set(attempt.competition.id, { competition: attempt.competition, attempts: [attempt] });
  }
  return [...groups.values()];
}
