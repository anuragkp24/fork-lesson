import { isGrade, isSubject, type Grade, type Subject } from "./labels";

// The subject, grade and share answer for one class, as submitted from the
// classes screen or the My lessons share prompt. Raw strings in, checked
// values out.

export type RawChoice = { courseId: string; subject: string; grade: string; shared: boolean };
export type ClassChoice = { courseId: string; subject: Subject | null; grade: Grade | null; shared: boolean };
export type ChoiceErrors = Record<string, string>;

// What a shared class still needs, or null when it can be saved. Unshared
// classes may stay blank; a class that isn't a subject needs no grade.
export function missingForShare(choice: { subject: string | null; grade: string | null; shared: boolean }): string | null {
  if (!choice.shared || choice.subject === "none") return null;
  if (!choice.subject && !choice.grade) return "Pick a subject and grade to share this class";
  if (!choice.subject) return "Pick a subject to share this class";
  if (!choice.grade) return "Pick a grade to share this class";
  return null;
}

export function parseClassChoices(
  raw: RawChoice[]
): { ok: true; choices: ClassChoice[] } | { ok: false; errors: ChoiceErrors } {
  const errors: ChoiceErrors = {};
  const choices: ClassChoice[] = [];
  for (const r of raw) {
    if (!r.courseId) continue;
    if ((r.subject && !isSubject(r.subject)) || (r.grade && !isGrade(r.grade))) {
      errors[r.courseId] = "Pick a subject and grade from the list";
      continue;
    }
    const subject = r.subject ? (r.subject as Subject) : null;
    const grade = subject === "none" || !r.grade ? null : (r.grade as Grade);
    const missing = missingForShare({ subject, grade, shared: r.shared });
    if (missing) {
      errors[r.courseId] = missing;
      continue;
    }
    choices.push({ courseId: r.courseId, subject, grade, shared: r.shared });
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, choices };
}

// Reads the classes form: one "course" field per class, then
// subject:<id>, grade:<id> and shared:<id> ("on" when ticked).
export function choicesFromForm(form: FormData): RawChoice[] {
  return form.getAll("course").map((value) => {
    const courseId = String(value);
    return {
      courseId,
      subject: String(form.get(`subject:${courseId}`) ?? ""),
      grade: String(form.get(`grade:${courseId}`) ?? ""),
      shared: form.get(`shared:${courseId}`) === "on",
    };
  });
}
