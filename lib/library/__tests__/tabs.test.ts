import { describe, expect, it } from "vitest";
import { lessonsTab, publishProblemLabel } from "../tabs";

describe("lessonsTab", () => {
  it("defaults to my lessons", () => {
    expect(lessonsTab(undefined)).toBe("mine");
  });

  it("ignores unknown values", () => {
    expect(lessonsTab("other")).toBe("mine");
    expect(lessonsTab(["saved", "saved"])).toBe("mine");
  });

  it("opens Saved", () => {
    expect(lessonsTab("saved")).toBe("saved");
  });
});

describe("publishProblemLabel", () => {
  const ok = { kind: "drive", publish_error: null };
  const bad = { kind: "drive", publish_error: "quota" };

  it("is null when nothing failed", () => {
    expect(publishProblemLabel([])).toBeNull();
    expect(publishProblemLabel([ok, { kind: "link", publish_error: null }])).toBeNull();
  });

  it("counts failed Drive files", () => {
    expect(publishProblemLabel([ok, bad])).toBe("1 file couldn't be shared");
    expect(publishProblemLabel([bad, bad, ok])).toBe("2 files couldn't be shared");
  });
});
