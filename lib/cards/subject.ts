// The soft cover on a card with no picture: the subject and a colour
// that depends only on the class name, so the same subject always looks the
// same. "Math · Section A" and "Math" share a tile.

// The tones are the file-chip colour pairs in globals.css.
export const SUBJECT_TONES = ["doc", "sheet", "slides", "pdf", "video", "link"] as const;
export type SubjectTone = (typeof SUBJECT_TONES)[number];

function subjectWord(className: string | null | undefined): string {
  return (className ?? "").trim().toLowerCase().split(/[^a-z0-9]+/).find(Boolean) ?? "";
}

// Same class name, same tone. The section and letter case don't matter.
export function subjectTone(className: string | null | undefined): SubjectTone {
  const word = subjectWord(className);
  let hash = 0;
  for (const ch of word) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_TONES[hash % SUBJECT_TONES.length];
}
