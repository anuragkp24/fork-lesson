// Who goes where during onboarding. Pure, so it is easy to test; the pages
// and the auth callback do the database reads.

// Where a signed-out visitor was going (a lesson link), set by proxy.ts and
// read once by the auth callback. A cookie, not a ?next on the OAuth redirect
// URL, which would have to match Supabase's redirect allow-list exactly.
export const NEXT_COOKIE = "fl_next";

export type WelcomeStep = "school" | "classes" | "done";

export function welcomeStep({
  onboardedAt,
  schoolId,
}: {
  onboardedAt: string | null | undefined;
  schoolId: string | null | undefined;
}): WelcomeStep {
  if (onboardedAt) return "done";
  return schoolId ? "classes" : "school";
}

// A path inside this app to return to after sign-in and onboarding, or null.
// Only relative paths: "/lesson/abc" yes; "//evil.com", "https://…" and
// "/\evil.com" (browsers read it as //evil.com) no.
export function safeNext(next: string | null | undefined): string | null {
  if (!next || next.length > 512) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (/[\\\u0000-\u001f]/.test(next)) return null;
  return next;
}

// "/welcome/classes?next=%2Flesson%2Fabc", or without next.
export function welcomePath(step: WelcomeStep, next?: string | null): string {
  const safe = safeNext(next);
  return `/welcome/${step}${safe ? `?next=${encodeURIComponent(safe)}` : ""}`;
}
