import { attachmentLabel } from "@/lib/sync/map";

// Every word typed must appear somewhere in the lesson's searchable text.
export function matchesQuery(fields: (string | null | undefined)[], query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

type AttachmentLike = { kind: string; mime_type: string | null; unsupported_type: string | null };

// Counts by type, in the order the types first appear.
export function attachmentSummaryParts(attachments: AttachmentLike[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const att of attachments) {
    const label = attachmentLabel(att);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

// "1 PDF · 1 Doc · 2 Video"
export function attachmentSummary(attachments: AttachmentLike[]): string {
  return attachmentSummaryParts(attachments)
    .map(({ label, count }) => `${count} ${label}`)
    .join(" · ");
}
