// Card pictures. Pure helpers, shared by the sync step, the serving route and
// the cards.

export type PictureAttachment = {
  kind: string;
  position: number;
  library_file_id: string | null;
  thumbnail_path: string | null;
  thumbnail_version: string | null;
};

// The attachment whose picture a lesson's card uses: the first Drive file, by
// position, that has a library copy and a picture saved. Null when there is none.
export function pickThumbnailAttachment<
  T extends { kind: string; position: number; library_file_id: string | null; thumbnail_path: string | null },
>(attachments: T[]): T | null {
  const candidates = attachments.filter((a) => a.kind === "drive" && a.library_file_id && a.thumbnail_path);
  if (candidates.length === 0) return null;
  return candidates.reduce((first, a) => (a.position < first.position ? a : first));
}

// Same-origin address of a lesson's card picture. The version busts the
// browser cache when the picture changes.
export function thumbnailSrc(lessonId: string, version?: string | null): string {
  return withVersion(`/api/thumbnail/${encodeURIComponent(lessonId)}`, version);
}

// Same, for one attachment's own picture (the lesson page's file previews).
export function attachmentThumbnailSrc(attachmentId: string, version?: string | null): string {
  return withVersion(`/api/thumbnail/attachment/${encodeURIComponent(attachmentId)}`, version);
}

function withVersion(base: string, version?: string | null): string {
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

// Drive's thumbnailLink is only ever fetched from Google's image hosts, over
// https. A look-alike such as googleusercontent.com.evil.test is refused.
export function isAllowedThumbnailUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    !parsed.username &&
    !parsed.password &&
    parsed.hostname.endsWith(".googleusercontent.com")
  );
}

// Drive links end in =s220 (the long side in pixels). That suffix is not in
// Google's docs; a link without it is returned as it is.
export function sizedThumbnailLink(link: string, px: number): string {
  return /=s\d+$/.test(link) ? link.replace(/=s\d+$/, `=s${px}`) : link;
}
