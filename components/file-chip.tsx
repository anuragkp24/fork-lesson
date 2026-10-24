// One chip per file type. The labels come from attachmentLabel().
const STYLES: Record<string, string> = {
  Doc: "bg-chip-doc text-chip-doc-ink",
  Sheet: "bg-chip-sheet text-chip-sheet-ink",
  Slides: "bg-chip-slides text-chip-slides-ink",
  PDF: "bg-chip-pdf text-chip-pdf-ink",
  Video: "bg-chip-video text-chip-video-ink",
};
const FALLBACK = "bg-chip-link text-chip-link-ink"; // Link, Form, File, anything else

export function FileChip({ label, count }: { label: string; count?: number }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[label] ?? FALLBACK}`}
    >
      {count && count > 1 ? `${count} ` : ""}
      {label}
    </span>
  );
}
