import { isGrade, isSubject, type Grade, type Subject } from "./labels";

// Best guesses for a class's subject and grade, from Classroom's free-text
// Course.subject / Course.levels first, then the class name and section.
// The teacher sees and can change every guess; null means "please pick".

export type Guess<T> = { value: T | null; source: "classroom" | "name" | null };

// Checked in this order, so "Computer science" is not Science, "Language arts"
// is not Arts, and "Math club" is not a class.
const SUBJECT_WORDS: [Subject, string[]][] = [
  ["none", ["homeroom", "advisory", "study hall", "office hours", "staff", "plc", "club"]],
  ["computer_science", ["computer\\w*", "coding", "cs", "programming"]],
  ["ela", ["english", "ela", "language arts", "reading", "writing", "literature"]],
  ["math", ["math\\w*", "algebra", "pre-algebra", "geometry", "calculus", "precalc\\w*", "statistics", "trig\\w*"]],
  ["science", ["science\\w*", "biology", "bio", "chemistry", "chem", "physics", "earth", "life science", "anatomy"]],
  ["social_studies", ["history", "social studies", "civics", "government", "geography", "economics"]],
  ["world_languages", ["spanish", "french", "german", "chinese", "mandarin", "latin", "italian", "japanese", "world languages?"]],
  ["music", ["music", "band", "choir", "orchestra", "chorus"]],
  ["arts", ["art", "arts", "drawing", "painting", "ceramics", "theatre", "theater", "drama"]],
  ["pe_health", ["pe", "physical education", "health", "gym"]],
];

const SUBJECT_PATTERNS: [Subject, RegExp][] = SUBJECT_WORDS.map(([subject, words]) => [
  subject,
  new RegExp(`\\b(?:${words.join("|")})\\b`, "i"),
]);

function subjectIn(text: string | null | undefined): Subject | null {
  if (!text?.trim()) return null;
  return SUBJECT_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function nameText(name: string | null | undefined, section: string | null | undefined): string {
  return `${name ?? ""} ${section ?? ""}`;
}

export function guessSubject(
  classroomSubject: string | null | undefined,
  name: string | null | undefined,
  section: string | null | undefined
): Guess<Subject> {
  const fromClassroom = subjectIn(classroomSubject);
  if (fromClassroom) return { value: fromClassroom, source: "classroom" };
  const fromName = subjectIn(nameText(name, section));
  return fromName ? { value: fromName, source: "name" } : { value: null, source: null };
}

function gradeNumber(text: string): Grade | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? (String(n) as Grade) : null;
}

const GRADE_TOKEN = "(?:k|\\d{1,2})";

// A grade written out: "Grade 7", "7th grade", "gr 7", "G7", "Year 7", "K",
// "Kindergarten"; a range ("K-2", "6–8") or "mixed"/"multi" is mixed. A bare
// number counts only when allowed (it is the whole Classroom levels value);
// in a class name it is too often a period or a section.
function gradeIn(text: string | null | undefined, bareNumber: boolean): Grade | null {
  const value = text?.trim();
  if (!value) return null;

  const range = value.match(new RegExp(`\\b(${GRADE_TOKEN})\\s*[-–—]\\s*(${GRADE_TOKEN})\\b`, "i"));
  if (range) {
    const ok = (t: string) => t.toLowerCase() === "k" || gradeNumber(t) !== null;
    if (ok(range[1]) && ok(range[2])) return "mixed";
  }
  if (/\b(?:mixed|multi)\b/i.test(value)) return "mixed";
  if (/\bkindergarten\b/i.test(value) || /\bK\b/.test(value)) return "K";

  const written =
    value.match(/\b(?:grade|gr\.?|g|year)\s*(\d{1,2})\b/i) ?? value.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:grade|gr)\b/i);
  if (written) return gradeNumber(written[1]);

  if (bareNumber && /^\d{1,2}$/.test(value)) return gradeNumber(value);
  return null;
}

export function guessGrade(
  classroomLevels: string | null | undefined,
  name: string | null | undefined,
  section: string | null | undefined
): Guess<Grade> {
  const fromClassroom = gradeIn(classroomLevels, true);
  if (fromClassroom) return { value: fromClassroom, source: "classroom" };
  const fromName = gradeIn(nameText(name, section), false);
  return fromName ? { value: fromName, source: "name" } : { value: null, source: null };
}

// Share is on by default, except for classes that aren't a subject (Homeroom).
export function defaultShare(subject: Subject | null): boolean {
  return subject !== "none";
}

export type Prefilled<T> = { value: T | null; source: "saved" | "classroom" | "name" | null };

export type ClassForPrefill = {
  name: string;
  section: string | null;
  classroom_subject: string | null;
  classroom_levels: string | null;
  subject: string | null;
  grade: string | null;
  shared: boolean;
  share_decided: boolean;
};

// What the classes screen (and the My lessons share prompt) starts with for a
// class: the teacher's saved answer when there is one, else the guesses. A
// class she already answered "share?" for keeps that answer.
export function prefillClass(c: ClassForPrefill): { subject: Prefilled<Subject>; grade: Prefilled<Grade>; shared: boolean } {
  const subject: Prefilled<Subject> = isSubject(c.subject)
    ? { value: c.subject, source: "saved" }
    : guessSubject(c.classroom_subject, c.name, c.section);
  const grade: Prefilled<Grade> =
    subject.value === "none"
      ? { value: null, source: null }
      : isGrade(c.grade)
        ? { value: c.grade, source: "saved" }
        : guessGrade(c.classroom_levels, c.name, c.section);
  return { subject, grade, shared: c.share_decided ? c.shared : defaultShare(subject.value) };
}
