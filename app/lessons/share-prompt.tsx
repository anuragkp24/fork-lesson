"use client";

import { useActionState, useState } from "react";
import { ClassSelects, selectLook } from "@/components/class-selects";
import { missingForShare } from "@/lib/onboarding/choices";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { shareClassAction, type ShareState } from "./actions";

// Shown on a class the teacher hasn't answered for yet (one that appeared
// after onboarding). Until they do, the class is read but nothing from it is
// published or shown to colleagues. Subject and grade are prefilled the same
// way as on the onboarding classes screen; sharing needs both.
export function SharePrompt({
  courseId,
  label,
  subject: startSubject,
  subjectPrefilled,
  grade: startGrade,
  gradePrefilled,
}: {
  courseId: string;
  label: string;
  subject: string;
  subjectPrefilled: boolean;
  grade: string;
  gradePrefilled: boolean;
}) {
  const [state, formAction, pending] = useActionState<ShareState, FormData>(shareClassAction, {});
  const [subject, setSubject] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const value = { subject: subject ?? startSubject, grade: grade ?? startGrade };
  const message = problem ?? state.error;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Only the Yes button needs a subject and grade.
        const yes = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "yes";
        const missing = yes ? missingForShare({ ...value, shared: true }) : null;
        setProblem(missing);
        if (missing) e.preventDefault();
      }}
      className="flex flex-col gap-3 rounded-[10px] border border-line bg-brand-light p-3"
    >
      <input type="hidden" name="course" value={courseId} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">Share this class with teachers in your district?</p>
        <ClassSelects
          courseId={courseId}
          label={label}
          subject={value.subject}
          grade={value.grade}
          subjectLook={selectLook(value.subject, subjectPrefilled, subject !== null)}
          gradeLook={selectLook(value.grade, gradePrefilled, grade !== null)}
          onSubject={(v) => {
            setSubject(v);
            setProblem(null);
          }}
          onGrade={(v) => {
            setGrade(v);
            setProblem(null);
          }}
        />
        <div className="flex gap-2">
          <button type="submit" name="answer" value="yes" disabled={pending} className={btnPrimary}>
            Yes
          </button>
          <button type="submit" name="answer" value="no" disabled={pending} className={btnSecondary}>
            Not now
          </button>
        </div>
      </div>
      {message && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {message}
        </p>
      )}
    </form>
  );
}
