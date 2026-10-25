import { SHOUTOUT_TAGS, isShoutoutTag, type ShoutoutTag } from "./tags";

export const SHOUTOUT_NOTE_MAX = 300;

export type ParsedShoutout =
  | { ok: true; tags: ShoutoutTag[]; note: string | null }
  | { ok: false; error: string };

// Validates what the dialog sends: known tags only (deduped, in display
// order), a trimmed note of at most 300 characters, and at least one of them.
export function parseShoutout(input: { tags: unknown; note: unknown }): ParsedShoutout {
  if (!Array.isArray(input.tags) || (input.note != null && typeof input.note !== "string")) {
    return { ok: false, error: "Bad request." };
  }
  if (!input.tags.every(isShoutoutTag)) return { ok: false, error: "Unknown tag." };
  const picked = new Set<string>(input.tags);
  const tags = SHOUTOUT_TAGS.map((t) => t.key).filter((key) => picked.has(key));

  const note = typeof input.note === "string" ? input.note.trim() || null : null;
  if (note && note.length > SHOUTOUT_NOTE_MAX) {
    return { ok: false, error: `Keep the note under ${SHOUTOUT_NOTE_MAX} characters.` };
  }
  if (tags.length === 0 && !note) return { ok: false, error: "Pick a tag or write a note." };
  return { ok: true, tags, note };
}
