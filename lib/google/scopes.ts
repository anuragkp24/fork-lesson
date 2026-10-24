// Every scope Fork Lesson asks for. See docs/plans/slice-1-local-demo.md.
export const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.topics",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const SIGN_IN_SCOPES = ["openid", "email", "profile", ...REQUIRED_SCOPES].join(" ");

// Teachers can untick scopes on the consent screen; these are the ones missing.
export function missingScopes(granted: string[]): string[] {
  const have = new Set(granted);
  return REQUIRED_SCOPES.filter((scope) => !have.has(scope));
}
