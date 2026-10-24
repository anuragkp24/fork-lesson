import { describe, expect, it } from "vitest";
import { attachmentKeys, attachmentLabel, mapCourseWork, mapMaterial } from "../map";

const pdf = {
  driveFile: { driveFile: { id: "d1", title: "Practice.pdf", alternateLink: "https://drive/d1" }, shareMode: "VIEW" },
};

describe("mapCourseWork", () => {
  it("maps a whole-class assignment with its materials", () => {
    const result = mapCourseWork({
      id: "cw1",
      title: " Adding and subtracting integers: practice set ",
      description: "Do the set.",
      state: "PUBLISHED",
      assigneeMode: "ALL_STUDENTS",
      workType: "ASSIGNMENT",
      maxPoints: 20,
      topicId: "t1",
      updateTime: "2026-10-01T12:00:00Z",
      materials: [
        pdf,
        { youtubeVideo: { id: "y1", title: "Integers", alternateLink: "https://youtu.be/y1" } },
        { link: { url: "https://example.com", title: "Example" } },
      ],
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.lesson).toMatchObject({
      google_coursework_id: "cw1",
      title: "Adding and subtracting integers: practice set",
      max_points: 20,
      topic_id: "t1",
    });
    expect(result.lesson.attachments.map((a) => [a.position, a.kind])).toEqual([
      [0, "drive"],
      [1, "youtube"],
      [2, "link"],
    ]);
    expect(result.lesson.attachments[0]).toMatchObject({ drive_file_id: "d1", share_mode: "VIEW" });
  });

  it("skips individual-student assignments", () => {
    expect(mapCourseWork({ id: "cw2", state: "PUBLISHED", assigneeMode: "INDIVIDUAL_STUDENTS" })).toEqual({
      status: "skipped",
      reason: "individual_students",
    });
  });

  it("skips anything not published", () => {
    expect(mapCourseWork({ id: "cw3", state: "DRAFT" })).toEqual({ status: "skipped", reason: "not_published" });
  });

  it("keeps an assignment with no materials", () => {
    const result = mapCourseWork({ id: "cw4", title: "Reflect", description: "Write a paragraph." });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.lesson.attachments).toEqual([]);
      expect(result.lesson.topic_id).toBeNull();
    }
  });
});

describe("mapMaterial", () => {
  it("marks forms and unknown materials unsupported", () => {
    expect(mapMaterial({ form: { formUrl: "https://forms/x", title: "Quiz" } }, 0)).toMatchObject({
      kind: "unsupported",
      unsupported_type: "form",
      title: "Quiz",
    });
    expect(mapMaterial({}, 3)).toMatchObject({ kind: "unsupported", unsupported_type: "other", position: 3 });
  });
});

describe("attachmentKeys", () => {
  it("is stable per file and tells repeats apart", () => {
    const a = mapMaterial(pdf, 0);
    const b = mapMaterial(pdf, 1);
    expect(attachmentKeys([a, b])).toEqual(["drive:d1", "drive:d1#1"]);
  });
});

describe("attachmentLabel", () => {
  it("names Drive files by type", () => {
    const label = (mime_type: string | null) => attachmentLabel({ kind: "drive", mime_type, unsupported_type: null });
    expect(label("application/pdf")).toBe("PDF");
    expect(label("application/vnd.google-apps.document")).toBe("Doc");
    expect(label(null)).toBe("File");
  });

  it("names the other kinds", () => {
    expect(attachmentLabel({ kind: "youtube", mime_type: null, unsupported_type: null })).toBe("Video");
    expect(attachmentLabel({ kind: "unsupported", mime_type: null, unsupported_type: "form" })).toBe("Form");
  });
});
