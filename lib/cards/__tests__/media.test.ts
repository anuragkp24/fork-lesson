import { describe, expect, it } from "vitest";
import { cardMedia, linkDomain, youtubeId, youtubeThumbnailUrl } from "../media";

const att = (over: object) => ({
  kind: "drive",
  position: 0,
  mime_type: "application/vnd.google-apps.document",
  url: null,
  library_file_id: "x",
  thumbnail_path: null,
  thumbnail_version: null,
  ...over,
});

describe("youtubeId", () => {
  it("reads watch, short and embed links", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("refuses anything else", () => {
    expect(youtubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeId("nope")).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });

  it("builds the public thumbnail address", () => {
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});

describe("linkDomain", () => {
  it("drops www", () => {
    expect(linkDomain("https://www.geogebra.org/classic")).toBe("geogebra.org");
  });

  it("is null for a non-URL", () => {
    expect(linkDomain("not a url")).toBeNull();
    expect(linkDomain(null)).toBeNull();
  });
});

describe("cardMedia", () => {
  it("shows the first page of a Doc or PDF", () => {
    expect(cardMedia("L", [att({ thumbnail_path: "o/a", thumbnail_version: "2" })])).toEqual({
      type: "page",
      src: "/api/thumbnail/L?v=2",
    });
    expect(cardMedia("L", [att({ mime_type: "application/pdf", thumbnail_path: "o/a" })]).type).toBe("page");
  });

  it("shows the first slide of a deck", () => {
    expect(
      cardMedia("L", [att({ mime_type: "application/vnd.google-apps.presentation", thumbnail_path: "o/a" })]).type
    ).toBe("slide");
  });

  it("uses YouTube's own thumbnail for a video that comes first", () => {
    const media = cardMedia("L", [
      att({ position: 1, thumbnail_path: "o/a" }),
      att({ kind: "youtube", position: 0, mime_type: null, library_file_id: null, url: "https://youtu.be/dQw4w9WgXcQ" }),
    ]);
    expect(media).toEqual({ type: "video", src: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
  });

  it("skips a file whose picture isn't saved yet and takes the next one", () => {
    expect(cardMedia("L", [att({}), att({ position: 1, thumbnail_path: "o/b" })]).type).toBe("page");
  });

  it("shows the domain on a link-only lesson", () => {
    expect(
      cardMedia("L", [att({ kind: "link", mime_type: null, library_file_id: null, url: "https://www.geogebra.org/x" })])
    ).toEqual({ type: "tile", icon: "link", note: "geogebra.org" });
  });

  it("says a preview is coming when the file has no picture yet", () => {
    expect(cardMedia("L", [att({})])).toEqual({ type: "tile", icon: "file", note: "Preview coming" });
  });

  it("copes with no files", () => {
    expect(cardMedia("L", [])).toEqual({ type: "tile", icon: "file", note: "No files" });
  });
});
