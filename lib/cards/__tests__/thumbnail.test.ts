import { describe, expect, it } from "vitest";
import {
  attachmentThumbnailSrc,
  isAllowedThumbnailUrl,
  pickThumbnailAttachment,
  sizedThumbnailLink,
  thumbnailSrc,
} from "../thumbnail";

const att = (position: number, kind: string, library_file_id: string | null = null, thumbnail_path: string | null = null) => ({
  position,
  kind,
  library_file_id,
  thumbnail_path,
});

describe("pickThumbnailAttachment", () => {
  it("takes the first Drive file that has a copy and a picture", () => {
    expect(pickThumbnailAttachment([att(0, "drive", "a", "p/a"), att(1, "drive", "b", "p/b")])?.library_file_id).toBe("a");
  });

  it("skips a file with no picture yet and takes the next one", () => {
    expect(pickThumbnailAttachment([att(0, "drive", "a"), att(1, "drive", "b", "p/b")])?.library_file_id).toBe("b");
  });

  it("skips a link that comes first", () => {
    expect(pickThumbnailAttachment([att(0, "link"), att(1, "drive", "b", "p/b")])?.library_file_id).toBe("b");
  });

  it("skips a Drive file with no library copy", () => {
    expect(pickThumbnailAttachment([att(0, "drive", null, "p/a"), att(1, "drive", "b", "p/b")])?.library_file_id).toBe("b");
  });

  it("is null with no attachments or no usable one", () => {
    expect(pickThumbnailAttachment([])).toBeNull();
    expect(pickThumbnailAttachment([att(0, "link"), att(1, "drive", "x")])).toBeNull();
  });

  it("goes by position, not array order", () => {
    expect(pickThumbnailAttachment([att(2, "drive", "c", "p/c"), att(1, "drive", "b", "p/b")])?.library_file_id).toBe("b");
  });
});

describe("thumbnailSrc", () => {
  it("adds the version when there is one", () => {
    expect(thumbnailSrc("abc", "12")).toBe("/api/thumbnail/abc?v=12");
  });

  it("leaves it off when there is none", () => {
    expect(thumbnailSrc("abc")).toBe("/api/thumbnail/abc");
    expect(thumbnailSrc("abc", null)).toBe("/api/thumbnail/abc");
  });

  it("encodes both parts", () => {
    expect(thumbnailSrc("a/b", "1&2")).toBe("/api/thumbnail/a%2Fb?v=1%262");
  });
});

describe("attachmentThumbnailSrc", () => {
  it("points at the attachment route, with the version when there is one", () => {
    expect(attachmentThumbnailSrc("x", "2")).toBe("/api/thumbnail/attachment/x?v=2");
    expect(attachmentThumbnailSrc("x")).toBe("/api/thumbnail/attachment/x");
  });
});

describe("isAllowedThumbnailUrl", () => {
  it("accepts https googleusercontent hosts", () => {
    expect(isAllowedThumbnailUrl("https://lh3.googleusercontent.com/abc=s220")).toBe(true);
  });

  it("refuses http, other hosts and look-alikes", () => {
    expect(isAllowedThumbnailUrl("http://lh3.googleusercontent.com/abc")).toBe(false);
    expect(isAllowedThumbnailUrl("https://example.com/abc")).toBe(false);
    expect(isAllowedThumbnailUrl("https://googleusercontent.com.evil.test/abc")).toBe(false);
    expect(isAllowedThumbnailUrl("https://evilgoogleusercontent.com/abc")).toBe(false);
    expect(isAllowedThumbnailUrl("https://x@lh3.googleusercontent.com/abc")).toBe(false);
    expect(isAllowedThumbnailUrl("not a url")).toBe(false);
  });
});

describe("sizedThumbnailLink", () => {
  it("replaces =s220", () => {
    expect(sizedThumbnailLink("https://lh3.googleusercontent.com/abc=s220", 640)).toBe(
      "https://lh3.googleusercontent.com/abc=s640"
    );
  });

  it("leaves other links alone", () => {
    const link = "https://lh3.googleusercontent.com/abc?x=1";
    expect(sizedThumbnailLink(link, 640)).toBe(link);
  });
});
