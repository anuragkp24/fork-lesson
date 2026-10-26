import { describe, expect, it } from "vitest";
import { choicesFromForm, missingForShare, parseClassChoices } from "../choices";

const row = (over: Partial<{ courseId: string; subject: string; grade: string; shared: boolean }> = {}) => ({
  courseId: "c1",
  subject: "math",
  grade: "7",
  shared: true,
  ...over,
});

describe("parseClassChoices", () => {
  it("accepts a complete shared class", () => {
    expect(parseClassChoices([row()])).toEqual({
      ok: true,
      choices: [{ courseId: "c1", subject: "math", grade: "7", shared: true }],
    });
  });

  it("rejects values that aren't in the lists", () => {
    expect(parseClassChoices([row({ subject: "cooking" })]).ok).toBe(false);
    expect(parseClassChoices([row({ grade: "13" })]).ok).toBe(false);
  });

  it("needs a grade for a shared class", () => {
    expect(parseClassChoices([row({ grade: "" })])).toEqual({
      ok: false,
      errors: { c1: "Pick a grade to share this class" },
    });
  });

  it("needs a subject for a shared class", () => {
    expect(parseClassChoices([row({ subject: "" })])).toEqual({
      ok: false,
      errors: { c1: "Pick a subject to share this class" },
    });
  });

  it("lets an unshared class stay blank", () => {
    expect(parseClassChoices([row({ subject: "", grade: "", shared: false })])).toEqual({
      ok: true,
      choices: [{ courseId: "c1", subject: null, grade: null, shared: false }],
    });
  });

  it("drops the grade for a class that isn't a subject", () => {
    expect(parseClassChoices([row({ subject: "none", grade: "7", shared: true })])).toEqual({
      ok: true,
      choices: [{ courseId: "c1", subject: "none", grade: null, shared: true }],
    });
  });

  it("reports every class with a problem", () => {
    const result = parseClassChoices([row({ courseId: "a", grade: "" }), row({ courseId: "b" }), row({ courseId: "c", subject: "" })]);
    expect(result.ok ? null : Object.keys(result.errors)).toEqual(["a", "c"]);
  });
});

describe("missingForShare", () => {
  it("says what is missing", () => {
    expect(missingForShare({ subject: null, grade: null, shared: true })).toBe("Pick a subject and grade to share this class");
    expect(missingForShare({ subject: "math", grade: "7", shared: true })).toBeNull();
    expect(missingForShare({ subject: null, grade: null, shared: false })).toBeNull();
  });
});

describe("choicesFromForm", () => {
  it("reads one entry per class", () => {
    const form = new FormData();
    form.append("course", "a");
    form.append("subject:a", "math");
    form.append("grade:a", "7");
    form.append("shared:a", "on");
    form.append("course", "b");
    form.append("subject:b", "none");
    expect(choicesFromForm(form)).toEqual([
      { courseId: "a", subject: "math", grade: "7", shared: true },
      { courseId: "b", subject: "none", grade: "", shared: false },
    ]);
  });
});
