// What the Library shows: an original lesson from someone else with at least
// one thing a colleague can fork. A YouTube video or a link counts at once. A
// Drive file (any type, PDFs too) counts once it has a copy in the author's
// library folder (library_file_id), because that copy is what gets forked.
// Forms and add-ons (unsupported) don't count, and a lesson with only text
// stays in the author's My lessons.
export function hasForkableAttachment(attachments: { kind: string; library_file_id?: string | null }[]): boolean {
  return attachments.some(
    (a) => a.kind === "youtube" || a.kind === "link" || (a.kind === "drive" && !!a.library_file_id)
  );
}
