// Classroom display name for public boards (LA-PRV-003): "Nguyễn Văn An" -> "An N.V.".
export const DISPLAY_NAME_MAX_LENGTH = 40;

export function classroomDisplayName(fullName: string): string {
  const parts = fullName.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const given = parts[parts.length - 1];
  if (parts.length === 1) return given.slice(0, DISPLAY_NAME_MAX_LENGTH);
  const initials = parts
    .slice(0, -1)
    .map((part) => `${part[0].toLocaleUpperCase("vi")}.`)
    .join("");
  const name = `${given} ${initials}`;
  return name.length <= DISPLAY_NAME_MAX_LENGTH ? name : name.slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function normalizeDisplayName(value: string): string | null {
  const name = value.normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > DISPLAY_NAME_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

// Suffix 2, 3, ... for duplicates in import order. `taken` holds, per name, the highest suffix
// already used in the class (1 = taken without suffix).
export function assignDisplayNameSuffixes(names: string[], taken: ReadonlyMap<string, number>): Array<number | null> {
  const highest = new Map(taken);
  return names.map((name) => {
    const current = highest.get(name);
    if (current === undefined) {
      highest.set(name, 1);
      return null;
    }
    highest.set(name, current + 1);
    return current + 1;
  });
}
