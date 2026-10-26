"use client";

import { useActionState, useState } from "react";
import { alertError, btnPrimary, input } from "@/lib/ui";
import { saveSchoolAction, type SchoolState } from "../actions";

// The radio itself is hidden; the whole row is the target and shows focus.
const OPTION =
  "flex min-h-11 cursor-pointer items-center rounded-[10px] border px-3 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand";

export function SchoolForm({
  schools,
  current,
  next,
}: {
  schools: { id: string; name: string }[];
  current: string | null;
  next: string | null;
}) {
  const [state, formAction, pending] = useActionState<SchoolState, FormData>(saveSchoolAction, {});
  const [choice, setChoice] = useState(current && schools.some((s) => s.id === current) ? current : "");
  const [typed, setTyped] = useState("");
  const ready = choice === "new" ? typed.trim().length >= 2 : !!choice;

  const option = (selected: boolean) =>
    `${OPTION} ${selected ? "border-brand bg-brand-light font-semibold" : "border-[#d7dcd9] hover:border-brand"}`;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      {next && <input type="hidden" name="next" value={next} />}
      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">Your school</legend>
        {schools.map((s) => (
          <label key={s.id} className={option(choice === s.id)}>
            <input
              type="radio"
              name="school"
              value={s.id}
              checked={choice === s.id}
              onChange={() => setChoice(s.id)}
              className="sr-only"
            />
            {s.name}
          </label>
        ))}
        <label className={`${option(choice === "new")} ${choice === "new" ? "" : "text-muted"}`}>
          <input
            type="radio"
            name="school"
            value="new"
            checked={choice === "new"}
            onChange={() => setChoice("new")}
            className="sr-only"
          />
          My school isn&apos;t listed…
        </label>
        {choice === "new" && (
          <input
            name="newSchool"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={120}
            autoFocus
            aria-label="Your school's name"
            placeholder="Your school's name"
            className={input}
          />
        )}
      </fieldset>
      <p className="text-xs text-muted">Schools other teachers in your district picked show up here.</p>
      {state.error && (
        <p role="alert" className={alertError}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={!ready || pending} className={`${btnPrimary} w-full`}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
