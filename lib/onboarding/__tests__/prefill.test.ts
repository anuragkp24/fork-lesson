import { describe, expect, it } from "vitest";
import { defaultShare, guessGrade, guessSubject, prefillClass } from "../prefill";

describe("guessSubject", () => {
  it("prefers the Classroom subject over the class name", () => {
    expect(guessSubject("Biology", "Math · Section A", null)).toEqual({ value: "science", source: "classroom" });
  });

  it("falls back to the name when the Classroom subject says nothing useful", () => {
    expect(guessSubject("", "Math", "Section A")).toEqual({ value: "math", source: "name" });
    expect(guessSubject("Period 3", "Geometry", "Section C")).toEqual({ value: "math", source: "name" });
  });

  it.each([
    ["Geometry", "math"],
    ["Pre-Algebra 7", "math"],
    ["Precalculus", "math"],
    ["AP Bio", "science"],
    ["Earth Science", "science"],
    ["English 9", "ela"],
    ["Language Arts", "ela"],
    ["US History", "social_studies"],
    ["Spanish II", "world_languages"],
    ["Band", "music"],
    ["Ceramics", "arts"],
    ["PE", "pe_health"],
    ["Computer Science", "computer_science"],
    ["Homeroom 204", "none"],
    ["Advisory", "none"],
    ["Math Club", "none"],
  ])("%s → %s", (name, subject) => {
    expect(guessSubject(null, name, null).value).toBe(subject);
  });

  it("returns null when nothing matches", () => {
    expect(guessSubject(null, "Room 12", "Period 2")).toEqual({ value: null, source: null });
  });

  it("matches whole words only", () => {
    expect(guessSubject(null, "Party planning", null).value).toBeNull(); // "art" inside a word
    expect(guessSubject(null, "Biography project", null).value).toBeNull(); // "bio" inside a word
  });
});

describe("guessGrade", () => {
  it.each([
    ["7th grade", "7"],
    ["Grade 7", "7"],
    ["gr7", "7"],
    ["Gr. 10", "10"],
    ["G8", "8"],
    ["Year 3", "3"],
    ["K", "K"],
    ["Kindergarten", "K"],
    ["K-2", "mixed"],
    ["6-8", "mixed"],
    ["6–8", "mixed"],
    ["Mixed", "mixed"],
    ["Multi-age", "mixed"],
  ])("levels %s → %s", (levels, grade) => {
    expect(guessGrade(levels, "Class", null)).toEqual({ value: grade, source: "classroom" });
  });

  it.each(["Middle school", "High school", "3000", "Grade 13"])("levels %s → nothing", (levels) => {
    expect(guessGrade(levels, "Class", null).value).toBeNull();
  });

  it("reads a bare number only from the Classroom levels", () => {
    expect(guessGrade("7", "Math", null)).toEqual({ value: "7", source: "classroom" });
    expect(guessGrade(null, "Math 7", null).value).toBeNull();
  });

  it("ignores periods and sections in the name", () => {
    expect(guessGrade(null, "Math", "Period 2").value).toBeNull();
    expect(guessGrade(null, "Math", "Section 2").value).toBeNull();
    expect(guessGrade(null, "Math · Section A", null).value).toBeNull();
    expect(guessGrade(null, "7th Period Math", null).value).toBeNull();
  });

  it("falls back to the name", () => {
    expect(guessGrade("Middle school", "Grade 7 Math", null)).toEqual({ value: "7", source: "name" });
    expect(guessGrade(null, "Math", "7th grade")).toEqual({ value: "7", source: "name" });
  });
});

describe("defaultShare", () => {
  it("is on, except for classes that aren't a subject", () => {
    expect(defaultShare("math")).toBe(true);
    expect(defaultShare(null)).toBe(true);
    expect(defaultShare("none")).toBe(false);
  });
});

describe("prefillClass", () => {
  const base = {
    name: "Math",
    section: "Section A",
    classroom_subject: null,
    classroom_levels: "Grade 7",
    subject: null,
    grade: null,
    shared: false,
    share_decided: false,
  };

  it("guesses for a new class, share on by default", () => {
    expect(prefillClass(base)).toEqual({
      subject: { value: "math", source: "name" },
      grade: { value: "7", source: "classroom" },
      shared: true,
    });
  });

  it("keeps a saved answer and the earlier share choice", () => {
    expect(prefillClass({ ...base, subject: "science", grade: "8", shared: false, share_decided: true })).toEqual({
      subject: { value: "science", source: "saved" },
      grade: { value: "8", source: "saved" },
      shared: false,
    });
    expect(prefillClass({ ...base, shared: true, share_decided: true }).shared).toBe(true);
  });

  it("has no grade and no sharing for a class that isn't a subject", () => {
    expect(prefillClass({ ...base, name: "Homeroom 204", section: null })).toEqual({
      subject: { value: "none", source: "name" },
      grade: { value: null, source: null },
      shared: false,
    });
  });
});
