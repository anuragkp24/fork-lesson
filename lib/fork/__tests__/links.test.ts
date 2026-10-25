import { describe, expect, it } from "vitest";
import { classworkLink } from "../links";

describe("classworkLink", () => {
  it("links to the class's Classwork tab", () => {
    // Henry's Science · Section D
    expect(classworkLink("893715239615")).toBe("https://classroom.google.com/w/ODkzNzE1MjM5NjE1/t/all");
  });

  it("drops base64 padding", () => {
    expect(classworkLink("1234")).toBe("https://classroom.google.com/w/MTIzNA/t/all");
  });
});
