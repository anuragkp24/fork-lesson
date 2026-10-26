// When to sync. Pure, so it is easy to test; the database and Google calls
// live in auto.ts.

export type SyncTrigger = "manual" | "visit" | "nightly" | "onboarding";

// A visit syncs when the last sync finished more than this long ago. Short, so
// a lesson posted a moment ago shows up and new pictures get picked up.
export const VISIT_MAX_AGE_MINUTES = 2;
export const NIGHTLY_MAX_AGE_MINUTES = 24 * 60;
// A sync that started this recently and hasn't finished is still running.
// Older than this, it is treated as stuck and a new one may start.
export const RUNNING_WINDOW_MINUTES = 5;

export const SIGN_IN_NEEDED = "Google needs you to sign in again.";
export const SIGN_IN_REJECTED = "Google rejected the saved sign-in. Sign out and sign in again.";

// Errors only the teacher can fix, by signing in again. Background syncs stop
// trying until they do.
export function needsSignIn(lastError: string | null | undefined): boolean {
  return lastError === SIGN_IN_NEEDED || lastError === SIGN_IN_REJECTED;
}

type Times = { lastStartedAt: string | null; lastFinishedAt: string | null };

const MINUTE = 60_000;

function isRunning({ lastStartedAt, lastFinishedAt }: Times, now: Date): boolean {
  if (!lastStartedAt) return false;
  const started = new Date(lastStartedAt).getTime();
  const finished = lastFinishedAt ? new Date(lastFinishedAt).getTime() : null;
  return (finished === null || finished < started) && now.getTime() - started < RUNNING_WINDOW_MINUTES * MINUTE;
}

export function needsSync({
  lastFinishedAt,
  lastStartedAt,
  now,
  maxAgeMinutes = VISIT_MAX_AGE_MINUTES,
}: Times & { now: Date; maxAgeMinutes?: number }): "run" | "fresh" | "running" {
  if (isRunning({ lastStartedAt, lastFinishedAt }, now)) return "running";
  if (!lastFinishedAt) return "run";
  const age = now.getTime() - new Date(lastFinishedAt).getTime();
  return age >= maxAgeMinutes * MINUTE ? "run" : "fresh";
}

export type NightlyRow = Times & { userId: string; lastError: string | null };

// The teachers the nightly sweep should sync now: not synced in 24 hours, not
// running, and not waiting for a sign-in. Never-synced first, then oldest first.
export function pickTeachersForNightly(rows: NightlyRow[], now: Date, limit: number): NightlyRow[] {
  const finishedAt = (r: NightlyRow) => (r.lastFinishedAt ? new Date(r.lastFinishedAt).getTime() : -Infinity);
  return rows
    .filter((r) => !needsSignIn(r.lastError))
    .filter((r) => needsSync({ ...r, now, maxAgeMinutes: NIGHTLY_MAX_AGE_MINUTES }) === "run")
    .sort((a, b) => finishedAt(a) - finishedAt(b))
    .slice(0, Math.max(0, limit));
}

// "just now", "12 minutes ago", "3 hours ago", "2 days ago".
export function syncedAgo(finishedAt: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(finishedAt).getTime()) / MINUTE));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
