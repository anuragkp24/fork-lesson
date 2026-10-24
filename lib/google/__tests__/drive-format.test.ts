import { describe, expect, it } from "vitest";
import { multipartBody, reuploadPlan } from "../drive-format";

describe("reuploadPlan", () => {
  it("round-trips Google files through Office formats", () => {
    expect(reuploadPlan("application/vnd.google-apps.document")).toEqual({
      exportAs: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      uploadAs: "application/vnd.google-apps.document",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });

  it("uploads ordinary files as they are", () => {
    expect(reuploadPlan("application/pdf")).toEqual({
      exportAs: null,
      uploadAs: "application/pdf",
      contentType: "application/pdf",
    });
  });

  it("refuses Google types it can't re-upload", () => {
    expect(reuploadPlan("application/vnd.google-apps.form")).toBeNull();
    expect(reuploadPlan("application/vnd.google-apps.shortcut")).toBeNull();
  });
});

describe("multipartBody", () => {
  it("wraps metadata and bytes between boundaries", () => {
    const body = multipartBody({ name: "a.pdf" }, "application/pdf", new Uint8Array([1, 2, 3]), "BND").toString("latin1");
    expect(body.startsWith("--BND\r\nContent-Type: application/json")).toBe(true);
    expect(body).toContain('{"name":"a.pdf"}');
    expect(body).toContain("--BND\r\nContent-Type: application/pdf\r\n\r\n\u0001\u0002\u0003\r\n--BND--");
  });
});
