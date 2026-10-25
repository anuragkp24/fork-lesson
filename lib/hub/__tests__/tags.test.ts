import { describe, expect, it } from "vitest";
import { sortTagCounts, topTags } from "../tags";

describe("sortTagCounts", () => {
  it("puts the biggest count first", () => {
    const sorted = sortTagCounts([
      { tag: "saved_time", n: 1 },
      { tag: "easy_to_adapt", n: 3 },
    ]);
    expect(sorted.map((t) => [t.tag, t.n])).toEqual([
      ["easy_to_adapt", 3],
      ["saved_time", 1],
    ]);
    expect(sorted[0].label).toBe("Easy to adapt");
  });

  it("breaks ties in the fixed tag order", () => {
    const sorted = sortTagCounts([
      { tag: "easy_to_adapt", n: 2 },
      { tag: "clear_instructions", n: 2 },
      { tag: "saved_time", n: 2 },
    ]);
    expect(sorted.map((t) => t.tag)).toEqual(["saved_time", "clear_instructions", "easy_to_adapt"]);
  });

  it("ignores unknown tags and zero counts", () => {
    expect(sortTagCounts([{ tag: "best_ever", n: 9 }, { tag: "saved_time", n: 0 }])).toEqual([]);
  });

  it("is empty for no rows", () => {
    expect(sortTagCounts([])).toEqual([]);
  });
});

describe("topTags", () => {
  const rows = [
    { lesson_id: "R", tag: "saved_time", n: 1 },
    { lesson_id: "R", tag: "clear_instructions", n: 1 },
    { lesson_id: "R", tag: "ready_to_use", n: 1 },
    { lesson_id: "P", tag: "students_love", n: 5 },
  ];

  it("keeps the top 2, ties broken by tag order", () => {
    expect(topTags(rows, "R", 2).map((t) => t.tag)).toEqual(["saved_time", "ready_to_use"]);
  });

  it("only looks at that lesson's rows", () => {
    expect(topTags(rows, "P", 2).map((t) => t.tag)).toEqual(["students_love"]);
    expect(topTags(rows, "Q", 2)).toEqual([]);
  });
});
