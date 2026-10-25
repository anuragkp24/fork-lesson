import { FileChip } from "@/components/file-chip";

// A Drive file on the lesson page: a large picture (our cached copy of the
// library file's thumbnail), the type chip and the name under it. The whole
// card opens the read-only Drive preview. No picture yet: a plain tile.
export function FilePreview({
  href,
  src,
  label,
  title,
}: {
  href: string;
  src: string | null;
  label: string;
  title: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-white transition-colors hover:border-brand"
    >
      <div className="h-48 w-full overflow-hidden bg-page">
        {src ? (
          // Same-origin route with its own cache headers; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="size-full object-cover object-top" />
        ) : (
          <div aria-hidden="true" className="flex size-full items-center justify-center text-sm font-semibold text-muted">
            Preview not ready yet
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <FileChip label={label} />
        <span className="min-w-0 break-words font-medium">{title}</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </div>
    </a>
  );
}
