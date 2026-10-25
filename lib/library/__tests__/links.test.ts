import { describe, expect, it } from "vitest";
import { drivePreviewUrl } from "../links";

describe("drivePreviewUrl", () => {
  it("previews a Google Doc", () => {
    expect(drivePreviewUrl("abc", "application/vnd.google-apps.document")).toBe(
      "https://docs.google.com/document/d/abc/preview"
    );
  });

  it("previews a Sheet", () => {
    expect(drivePreviewUrl("abc", "application/vnd.google-apps.spreadsheet")).toBe(
      "https://docs.google.com/spreadsheets/d/abc/preview"
    );
  });

  it("previews Slides", () => {
    expect(drivePreviewUrl("abc", "application/vnd.google-apps.presentation")).toBe(
      "https://docs.google.com/presentation/d/abc/preview"
    );
  });

  it("views a PDF in Drive", () => {
    expect(drivePreviewUrl("abc", "application/pdf")).toBe("https://drive.google.com/file/d/abc/view");
  });

  it("views a Drawing, an unknown type or a missing type in Drive", () => {
    expect(drivePreviewUrl("abc", "application/vnd.google-apps.drawing")).toBe("https://drive.google.com/file/d/abc/view");
    expect(drivePreviewUrl("abc", "application/x-unknown")).toBe("https://drive.google.com/file/d/abc/view");
    expect(drivePreviewUrl("abc", null)).toBe("https://drive.google.com/file/d/abc/view");
  });

  it("encodes the id", () => {
    expect(drivePreviewUrl("a/b?c", "application/vnd.google-apps.document")).toBe(
      "https://docs.google.com/document/d/a%2Fb%3Fc/preview"
    );
    expect(drivePreviewUrl("a/b?c", "application/pdf")).toBe("https://drive.google.com/file/d/a%2Fb%3Fc/view");
  });
});
