import { describe, expect, it } from "vitest";
import { SUBJECT_TONES, subjectTone } from "../subject";

describe("subjectTone", () => {
  it("is the same for the same subject however it is written", () => {
    expect(subjectTone("Math")).toBe(subjectTone("math · Section A"));
  });

  it("always returns a known tone", () => {
    for (const name of ["Math", "Science", "Band", "", "Robotics", null]) {
      expect(SUBJECT_TONES).toContain(subjectTone(name));
    }
  });
});
