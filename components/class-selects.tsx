"use client";

import { GRADES, SUBJECTS, gradeLabel, subjectLabel } from "@/lib/onboarding/labels";

// Soft green: filled in for her (from Classroom, the class name, or her
// earlier answer). Yellow: please pick. Plain once she has changed it.
export type SelectLook = "auto" | "need" | "plain";

const LOOK: Record<SelectLook, string> = {
  auto: "border-[#b9d3c4] bg-[#f3f8f5]",
  need: "border-[#e0b44a] bg-[#fffaf0]",
  plain: "border-line bg-white",
};

const SELECT = "min-h-11 rounded-lg border px-2 text-sm text-ink";

export function selectLook(value: string, prefilled: boolean, touched: boolean): SelectLook {
  if (!value) return "need";
  return prefilled && !touched ? "auto" : "plain";
}

// Subject and grade for one class. The grade is hidden for a class that isn't
// a subject (Homeroom). Field names are the form's: subject:<id>, grade:<id>.
export function ClassSelects({
  courseId,
  label,
  subject,
  grade,
  subjectLook,
  gradeLook,
  onSubject,
  onGrade,
}: {
  courseId: string;
  label: string;
  subject: string;
  grade: string;
  subjectLook: SelectLook;
  gradeLook: SelectLook;
  onSubject: (value: string) => void;
  onGrade: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <select
        name={`subject:${courseId}`}
        value={subject}
        onChange={(e) => onSubject(e.target.value)}
        aria-label={`Subject for ${label}`}
        className={`${SELECT} ${LOOK[subjectLook]}`}
      >
        <option value="">Pick subject</option>
        {SUBJECTS.map((s) => (
          <option key={s} value={s}>
            {subjectLabel(s)}
          </option>
        ))}
      </select>
      {subject !== "none" && (
        <select
          name={`grade:${courseId}`}
          value={grade}
          onChange={(e) => onGrade(e.target.value)}
          aria-label={`Grade for ${label}`}
          className={`${SELECT} ${LOOK[gradeLook]}`}
        >
          <option value="">Pick grade</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {gradeLabel(g)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
