import { thumbnailSrc, type PictureAttachment } from "./thumbnail";

// What the picture area of a card shows. See the card rules in
// .claude/handoffs/2026-10-25-batch-B.md.
export type MediaAttachment = PictureAttachment & { mime_type: string | null; url: string | null };

export type CardMedia =
  | { type: "page" | "slide" | "video"; src: string }
  | { type: "tile"; icon: "link" | "file"; note: string };

// The 11-character id of a YouTube link (watch, youtu.be, embed or shorts),
// or null.
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = parsed.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "m.youtube.com") {
    id = parsed.pathname === "/watch" ? parsed.searchParams.get("v") : (parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? null);
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

// YouTube's public thumbnail: no Google sign-in needed.
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// "geogebra.org" for a link; null when it isn't a URL.
export function linkDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function isSlides(mimeType: string | null): boolean {
  return mimeType === "application/vnd.google-apps.presentation" || !!mimeType?.includes("presentationml");
}

// The first attachment, in order, that can show a picture: a Drive file with
// our saved copy (first page, or first slide), or a YouTube video. Otherwise a
// tile: a link shows its domain; anything else says a preview is coming.
// A Drive pick here is always the one /api/thumbnail/<lessonId> serves.
export function cardMedia(lessonId: string, attachments: MediaAttachment[]): CardMedia {
  const ordered = [...attachments].sort((a, b) => a.position - b.position);
  for (const att of ordered) {
    if (att.kind === "drive" && att.library_file_id && att.thumbnail_path) {
      return { type: isSlides(att.mime_type) ? "slide" : "page", src: thumbnailSrc(lessonId, att.thumbnail_version) };
    }
    if (att.kind === "youtube") {
      const id = youtubeId(att.url);
      if (id) return { type: "video", src: youtubeThumbnailUrl(id) };
    }
  }
  const first = ordered[0];
  if (first?.kind === "link") return { type: "tile", icon: "link", note: linkDomain(first.url) ?? "Link" };
  return { type: "tile", icon: "file", note: first ? "Preview coming" : "No files" };
}
