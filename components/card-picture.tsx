import type { CardMedia } from "@/lib/cards/media";
import { subjectTone, type SubjectTone } from "@/lib/cards/subject";

const TONE: Record<SubjectTone, string> = {
  doc: "bg-chip-doc text-chip-doc-ink",
  sheet: "bg-chip-sheet text-chip-sheet-ink",
  slides: "bg-chip-slides text-chip-slides-ink",
  pdf: "bg-chip-pdf text-chip-pdf-ink",
  video: "bg-chip-video text-chip-video-ink",
  link: "bg-chip-link text-chip-link-ink",
};

const INK: Record<string, string> = {
  Doc: "text-chip-doc-ink",
  Sheet: "text-chip-sheet-ink",
  Slides: "text-chip-slides-ink",
  PDF: "text-chip-pdf-ink",
  Video: "text-chip-video-ink",
};

const SVG = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;

// File types as small white labels, bottom-left, in attachment order: up to 3,
// then "+N". Each type once.
export function typeLabels(labels: string[], max = 3): { shown: string[]; more: number } {
  const unique = [...new Set(labels)];
  return { shown: unique.slice(0, max), more: Math.max(0, unique.length - max) };
}

// The picture area at the top of every card: the same 16:10 size, whatever is
// inside. Decorative (alt=""): the title and class line say the same thing.
export function CardPicture({
  media,
  course,
  labels,
}: {
  media: CardMedia;
  course?: string | null;
  labels: string[];
}) {
  const { shown, more } = typeLabels(labels);
  return (
    <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-[#eef0f2]">
      {media.type === "tile" ? (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 ${TONE[subjectTone(course)]}`}
        >
          {media.icon === "link" ? (
            <svg {...SVG} className="size-[30px]">
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
          ) : (
            <svg {...SVG} className="size-[30px]">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h6" />
            </svg>
          )}
          <small className="max-w-[80%] truncate text-xs opacity-85">{media.note}</small>
        </div>
      ) : (
        // Same-origin route (or YouTube's public thumbnail) with its own cache
        // headers; next/image adds nothing here.
        /* eslint-disable @next/next/no-img-element */
        <img
          src={media.src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={
            media.type === "page"
              ? "absolute left-1/2 top-3.5 w-[62%] -translate-x-1/2 bg-white shadow-[0_1px_4px_rgba(0,0,0,.14)]"
              : media.type === "slide"
                ? "absolute inset-x-3.5 top-3.5 w-[calc(100%-28px)] rounded bg-white shadow-[0_1px_4px_rgba(0,0,0,.14)]"
                : "absolute inset-0 size-full object-cover"
          }
        />
      )}
      {shown.length > 0 && (
        <div className="absolute bottom-2.5 left-2.5 flex gap-1">
          {shown.map((label) => (
            <span
              key={label}
              className={`rounded-md bg-white/95 px-[7px] py-0.5 text-[11px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,.12)] ${INK[label] ?? "text-chip-link-ink"}`}
            >
              {label}
            </span>
          ))}
          {more > 0 && (
            <span className="rounded-md bg-white/95 px-[7px] py-0.5 text-[11px] font-semibold text-chip-link-ink shadow-[0_1px_2px_rgba(0,0,0,.12)]">
              +{more}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
