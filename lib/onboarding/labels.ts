// Subjects and grades a class can have. The values match the check
// constraints on courses.subject and courses.grade (migration 0009).

export const SUBJECTS = [
  "math",
  "science",
  "ela",
  "social_studies",
  "world_languages",
  "arts",
  "music",
  "pe_health",
  "computer_science",
  "other",
  "none",
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "mixed"] as const;
export type Grade = (typeof GRADES)[number];

const SUBJECT_LABEL: Record<Subject, string> = {
  math: "Math",
  science: "Science",
  ela: "ELA",
  social_studies: "Social studies",
  world_languages: "World languages",
  arts: "Arts",
  music: "Music",
  pe_health: "PE / Health",
  computer_science: "Computer science",
  other: "Other",
  none: "Not a subject",
};

export function isSubject(value: unknown): value is Subject {
  return typeof value === "string" && (SUBJECTS as readonly string[]).includes(value);
}

export function isGrade(value: unknown): value is Grade {
  return typeof value === "string" && (GRADES as readonly string[]).includes(value);
}

export function subjectLabel(subject: Subject): string {
  return SUBJECT_LABEL[subject];
}

// "K", "Grade 7", "Mixed grades".
export function gradeLabel(grade: Grade): string {
  if (grade === "K") return "K";
  if (grade === "mixed") return "Mixed grades";
  return `Grade ${grade}`;
}

// "Grade 7 Math", "Kindergarten Science", "Mixed-grade Music", "Grade 7" (Other).
export function pairLabel(subject: Subject, grade: Grade): string {
  const gradePart = grade === "K" ? "Kindergarten" : grade === "mixed" ? "Mixed-grade" : `Grade ${grade}`;
  return subject === "other" ? gradePart : `${gradePart} ${SUBJECT_LABEL[subject]}`;
}
