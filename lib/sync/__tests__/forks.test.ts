import { describe, expect, it } from "vitest";
import { forkStateFrom, partitionCourseWork } from "../forks";
import { mapLesson } from "../map";

describe("partitionCourseWork", () => {
  const work = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("splits out the courseWork we created as forks", () => {
    const { forks, regular } = partitionCourseWork(work, new Set(["b"]));
    expect(forks.map((w) => w.id)).toEqual(["b"]);
    expect(regular.map((w) => w.id)).toEqual(["a", "c"]);
  });

  it("leaves everything regular when there are no forks", () => {
    expect(partitionCourseWork(work, new Set()).regular).toHaveLength(3);
  });
});

describe("forkStateFrom", () => {
  it("reads Classroom's states", () => {
    expect(forkStateFrom("PUBLISHED")).toBe("PUBLISHED");
    expect(forkStateFrom("DRAFT")).toBe("DRAFT");
    expect(forkStateFrom("DELETED")).toBe("REMOVED");
    expect(forkStateFrom(undefined)).toBe("DRAFT");
  });
});

describe("mapLesson", () => {
  it("maps a fork even if Classroom now lists it as individual-student work", () => {
    const lesson = mapLesson({ id: "x", title: "T", assigneeMode: "INDIVIDUAL_STUDENTS", state: "DRAFT" });
    expect(lesson.google_coursework_id).toBe("x");
  });
});
