"use client";

import { useActionState, useState, type FormEvent } from "react";
import { ClassSelects, selectLook } from "@/components/class-selects";
import { missingForShare, type ChoiceErrors } from "@/lib/onboarding/choices";
import { alertError, btnPrimary } from "@/lib/ui";
import { saveClassesAction, type ClassesState } from "../actions";

export type ClassRow = {
  id: string;
  label: string;
  assignments: number;
  subject: string;
  subjectPrefilled: boolean;
  grade: string;
  gradePrefilled: boolean;
  shared: boolean;
};

type Edit = { subject?: string; grade?: string; shared?: boolean };

// The class list and the submit button. Her changes are kept per class id, so
// a page refresh that adds a class (the read is still running) keeps them.
export function ClassesForm({ rows, next }: { rows: ClassRow[]; next: string | null }) {
  const [state, formAction, pending] = useActionState<ClassesState, FormData>(saveClassesAction, {});
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [errors, setErrors] = useState<ChoiceErrors>({});

  const current = (r: ClassRow) => ({
    subject: edits[r.id]?.subject ?? r.subject,
    grade: edits[r.id]?.grade ?? r.grade,
    shared: edits[r.id]?.shared ?? r.shared,
  });
  const edit = (id: string, change: Edit) => {
    setEdits((all) => ({ ...all, [id]: { ...all[id], ...change } }));
    setErrors((all) => {
      const rest = { ...all };
      delete rest[id];
      return rest;
    });
  };
  const shownErrors = Object.keys(errors).length ? errors : (state.errors ?? {});
  const sharedCount = rows.filter((r) => current(r).shared).length;

  // A shared class needs a subject and grade: stop here, say so on that class
  // and scroll to it. Unshared classes may stay blank.
  function check(e: FormEvent<HTMLFormElement>) {
    const found: ChoiceErrors = {};
    for (const r of rows) {
      const missing = missingForShare(current(r));
      if (missing) found[r.id] = missing;
    }
    setErrors(found);
    const first = rows.find((r) => found[r.id]);
    if (first) {
      e.preventDefault();
      document.getElementById(`class-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <form action={formAction} onSubmit={check} className="flex flex-col gap-3.5">
      {next && <input type="hidden" name="next" value={next} />}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const value = current(r);
            const error = shownErrors[r.id];
            return (
              <li
                key={r.id}
                id={`class-${r.id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3 ${
                  error ? "border-[#e0b44a]" : "border-line"
                }`}
              >
                <input type="hidden" name="course" value={r.id} />
                {value.shared && <input type="hidden" name={`shared:${r.id}`} value="on" />}
                <div className="min-w-0">
                  <p className="truncate font-bold">{r.label}</p>
                  <p className="text-xs text-muted">
                    {r.assignments} {r.assignments === 1 ? "assignment" : "assignments"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={value.shared}
                  aria-label={`Share ${r.label} with teachers in your district`}
                  onClick={() => edit(r.id, { shared: !value.shared })}
                  className="row-span-2 flex min-h-11 items-center justify-center px-0.5"
                >
                  <span
                    aria-hidden="true"
                    className={`relative h-6 w-[42px] rounded-full transition-colors ${value.shared ? "bg-brand" : "bg-[#cfd5d2]"}`}
                  >
                    <span
                      className={`absolute top-[3px] size-[18px] rounded-full bg-white transition-all ${
                        value.shared ? "right-[3px]" : "right-[21px]"
                      }`}
                    />
                  </span>
                </button>
                <ClassSelects
                  courseId={r.id}
                  label={r.label}
                  subject={value.subject}
                  grade={value.grade}
                  subjectLook={selectLook(value.subject, r.subjectPrefilled, edits[r.id]?.subject !== undefined)}
                  gradeLook={selectLook(value.grade, r.gradePrefilled, edits[r.id]?.grade !== undefined)}
                  onSubject={(subject) => edit(r.id, { subject })}
                  onGrade={(grade) => edit(r.id, { grade })}
                />
                {error && (
                  <p role="alert" className="col-span-2 text-sm font-semibold text-danger">
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > 0 && (
        <p className="text-xs text-muted">
          <span
            aria-hidden="true"
            className="mr-1 inline-block size-2.5 rounded-[3px] border border-[#b9d3c4] bg-[#f3f8f5] align-[-1px]"
          />
          Filled in from Google Classroom or your class name; change anything.{" "}
          <span
            aria-hidden="true"
            className="mx-1 inline-block size-2.5 rounded-[3px] border border-[#e0b44a] bg-[#fffaf0] align-[-1px]"
          />
          = please pick.
        </p>
      )}
      {state.error && (
        <p role="alert" className={alertError}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending
          ? "Saving…"
          : rows.length === 0
            ? "Continue"
            : sharedCount > 0
              ? `Share ${sharedCount} ${sharedCount === 1 ? "class" : "classes"} and continue`
              : "Continue without sharing"}
      </button>
    </form>
  );
}
