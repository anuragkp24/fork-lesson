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
