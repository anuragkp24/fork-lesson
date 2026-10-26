import { describe, expect, it } from "vitest";
import { hasForkableAttachment } from "../qualifies";

describe("hasForkableAttachment", () => {
  it("counts Drive files, YouTube videos and links", () => {
    expect(hasForkableAttachment([{ kind: "drive", library_file_id: "lib1" }])).toBe(true);
    expect(hasForkableAttachment([{ kind: "youtube" }])).toBe(true);
    expect(hasForkableAttachment([{ kind: "link" }])).toBe(true);
  });

  it("needs the library copy before a Drive file counts", () => {
    expect(hasForkableAttachment([{ kind: "drive", library_file_id: null }])).toBe(false);
    expect(hasForkableAttachment([{ kind: "drive" }])).toBe(false);
    expect(hasForkableAttachment([{ kind: "drive", library_file_id: "" }])).toBe(false);
  });

  it("counts YouTube and links without any copy", () => {
    expect(hasForkableAttachment([{ kind: "youtube", library_file_id: null }])).toBe(true);
    expect(hasForkableAttachment([{ kind: "link" }])).toBe(true);
  });

  it("is forkable when one Drive file is copied and another is not", () => {
    expect(
      hasForkableAttachment([
        { kind: "drive", library_file_id: null },
        { kind: "drive", library_file_id: "lib2" },
      ])
    ).toBe(true);
  });

  it("rejects text-only lessons", () => {
    expect(hasForkableAttachment([])).toBe(false);
  });

  it("rejects lessons with only Forms or add-ons", () => {
    expect(hasForkableAttachment([{ kind: "unsupported" }, { kind: "unsupported" }])).toBe(false);
  });

  it("accepts one forkable attachment next to unsupported ones", () => {
    expect(hasForkableAttachment([{ kind: "unsupported" }, { kind: "link" }])).toBe(true);
  });
});
