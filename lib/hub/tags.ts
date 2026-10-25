// Shout-out tags, in display order. The keys match the check constraint in
// supabase/migrations/0005_shoutouts.sql.
export const SHOUTOUT_TAGS = [
  { key: "saved_time", label: "Saved me time" },
  { key: "ready_to_use", label: "Ready to use" },
  { key: "great_materials", label: "Great materials" },
  { key: "clear_instructions", label: "Clear instructions" },
  { key: "students_love", label: "Students will love it" },
  { key: "easy_to_adapt", label: "Easy to adapt" },
] as const;

export type ShoutoutTag = (typeof SHOUTOUT_TAGS)[number]["key"];

export function isShoutoutTag(value: unknown): value is ShoutoutTag {
  return SHOUTOUT_TAGS.some((t) => t.key === value);
}

// Null for a tag we don't know, so it is never shown.
export function tagLabel(key: string): string | null {
  return SHOUTOUT_TAGS.find((t) => t.key === key)?.label ?? null;
}

export type TagCount = { tag: ShoutoutTag; label: string; n: number };

// Counts for one lesson, biggest first, ties in the fixed tag order. Tags we
// don't know are dropped, and so are zero counts.
export function sortTagCounts(rows: { tag: string; n: number }[]): TagCount[] {
  return SHOUTOUT_TAGS.flatMap((t) => {
    const n = rows.filter((r) => r.tag === t.key).reduce((sum, r) => sum + r.n, 0);
    return n > 0 ? [{ tag: t.key, label: t.label, n }] : [];
  }).sort((a, b) => b.n - a.n); // stable: equal counts keep the fixed tag order
}

// The few tags a Library card shows, from the rows of many lessons.
export function topTags(
  rows: { lesson_id: string; tag: string; n: number }[],
  lessonId: string,
  limit: number
): TagCount[] {
  return sortTagCounts(rows.filter((r) => r.lesson_id === lessonId)).slice(0, limit);
}
