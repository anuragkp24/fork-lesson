import { describe, expect, it } from "vitest";
import { buildMaterials, forkWorkType, reAddNote, topicMatch, youtubeIdFromUrl, type ForkSourceAttachment } from "../plan";

const att = (over: Partial<ForkSourceAttachment>): ForkSourceAttachment => ({
  id: "a1",
  kind: "drive",
  title: "Worksheet",
  url: null,
  share_mode: "VIEW",
  library_file_id: "lib1",
  unsupported_type: null,
  ...over,
});

describe("topicMatch", () => {
  const topics = [{ name: "Ratios" }, { name: " Integers " }];

  it("matches case-insensitively and trimmed", () => {
    expect(topicMatch("integers", topics)).toBe(topics[1]);
    expect(topicMatch("RATIOS ", topics)).toBe(topics[0]);
  });

  it("is null with no lesson topic or no match", () => {
    expect(topicMatch(null, topics)).toBeNull();
    expect(topicMatch("Geometry", topics)).toBeNull();
    expect(topicMatch("Geometry", [])).toBeNull();
  });
});

describe("forkWorkType", () => {
  it("keeps short answer, flattens everything else to an assignment", () => {
    expect(forkWorkType("SHORT_ANSWER_QUESTION")).toBe("SHORT_ANSWER_QUESTION");
    expect(forkWorkType("MULTIPLE_CHOICE_QUESTION")).toBe("ASSIGNMENT");
    expect(forkWorkType(null)).toBe("ASSIGNMENT");
  });
});

describe("youtubeIdFromUrl", () => {
  it("reads the common URL shapes", () => {
    expect(youtubeIdFromUrl("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
    expect(youtubeIdFromUrl("https://youtu.be/abc123")).toBe("abc123");
    expect(youtubeIdFromUrl("https://www.youtube.com/embed/abc123")).toBe("abc123");
  });

  it("is null for anything else", () => {
    expect(youtubeIdFromUrl("https://example.com/watch?v=abc")).toBeNull();
    expect(youtubeIdFromUrl("nope")).toBeNull();
    expect(youtubeIdFromUrl(null)).toBeNull();
  });
});

describe("buildMaterials", () => {
  it("swaps in the new copies and keeps the share mode", () => {
    const { materials, notCopied } = buildMaterials(
      [
        att({ id: "d1", share_mode: "STUDENT_COPY" }),
        att({ id: "y1", kind: "youtube", url: "https://www.youtube.com/watch?v=vid1", library_file_id: null }),
        att({ id: "l1", kind: "link", url: "https://example.com", library_file_id: null }),
      ],
      new Map([["d1", "new1"]])
    );
    expect(materials).toEqual([
      { driveFile: { driveFile: { id: "new1" }, shareMode: "STUDENT_COPY" } },
      { youtubeVideo: { id: "vid1" } },
      { link: { url: "https://example.com" } },
    ]);
    expect(notCopied).toEqual([]);
  });

  it("reports what could not be copied", () => {
    const { materials, notCopied } = buildMaterials(
      [
        att({ id: "d1" }),
        att({ id: "d2", library_file_id: null }),
        att({ id: "f1", kind: "unsupported", title: "Quiz", library_file_id: null, unsupported_type: "form" }),
      ],
      new Map()
    );
    expect(materials).toEqual([]);
    expect(notCopied.map((n) => n.reason)).toEqual(["copy_failed", "not_in_library", "form"]);
  });
});

describe("reAddNote", () => {
  it("is empty when nothing is missing", () => {
    expect(reAddNote([])).toBe("");
  });

  it("lists each missing item", () => {
    const note = reAddNote([{ title: "Quiz", reason: "form" }]);
    expect(note).toContain("“Quiz” (a Google Form that can't be copied)");
  });
});
