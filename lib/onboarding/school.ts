// A typed school name: trimmed, inner spaces collapsed, 2 to 120 characters
// (the schools.name check). Null when it doesn't fit.
export function parseSchoolName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 120 ? name : null;
}

// The existing school with this name, ignoring case and spaces (the
// schools_domain_name index), so a typed name doesn't make a duplicate.
export function findSchool<T extends { name: string }>(schools: T[], name: string): T | null {
  const key = name.trim().replace(/\s+/g, " ").toLowerCase();
  return schools.find((s) => s.name.trim().replace(/\s+/g, " ").toLowerCase() === key) ?? null;
}
