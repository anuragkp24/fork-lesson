import { describe, expect, it } from "vitest";
import { groupByTeacher, teacherOptions, type GroupableLesson } from "../group";

const lesson = (
  owner: string,
  name: string | null,
  course: string,
  section: string | null,
  updated: string | null,
  id = `${owner}-${course}-${updated}`
): GroupableLesson & { id: string } => ({
  id,
  owner_id: owner,
  source_updated_at: updated,
  teacher: { name, email: `${owner}@x.org` },
  course: { name: course, section },
});

const lessons = [
  lesson("me", "Sam", "Geometry", "C", "2026-10-01"),
  lesson("z", "Zed Zimmer", "Art", null, "2026-09-01"),
  lesson("a", "Ana Abel", "Math", "B", "2026-09-10", "old"),
  lesson("a", "Ana Abel", "Math", "B", "2026-10-05", "new"),
  lesson("a", "Ana Abel", "Math", "A", "2026-08-01"),
];

describe("groupByTeacher", () => {
  const groups = groupByTeacher(lessons, "me");

  it("puts other teachers A to Z first and you last", () => {
    expect(groups.map((g) => g.name)).toEqual(["Ana Abel", "Zed Zimmer", "Sam"]);
    expect(groups.map((g) => g.isYou)).toEqual([false, false, true]);
  });

  it("counts each teacher's lessons", () => {
    expect(groups.map((g) => g.count)).toEqual([3, 1, 1]);
  });

  it("groups by class A to Z, newest lesson first", () => {
    const ana = groups[0];
    expect(ana.classes.map((c) => c.label)).toEqual(["Math · A", "Math · B"]);
    expect(ana.classes[1].lessons.map((l) => (l as { id: string }).id)).toEqual(["new", "old"]);
  });

  it("is empty for no lessons", () => {
    expect(groupByTeacher([], "me")).toEqual([]);
  });
});

describe("teacherOptions", () => {
  it("lists teachers in group order and marks you", () => {
    expect(teacherOptions(lessons, "me")).toEqual([
      { id: "a", label: "Ana Abel" },
      { id: "z", label: "Zed Zimmer" },
      { id: "me", label: "You (Sam)" },
    ]);
  });
});
