"use client";

import { useRef, useState } from "react";
import { topicMatch, type TopicChoice } from "@/lib/fork/plan";

export type ForkClass = { id: string; name: string; section: string | null; topics: string[] };
export type ForkItem = {
  key: string;
  label: string;
  title: string;
  outcome: "copy" | "as-is" | "skip";
  note: string;
};

type Done = { status: "done" | "partial"; className: string; alternateLink: string | null; notCopied: string[] };

const OUTCOME_STYLE = {
  copy: "text-green-700",
  "as-is": "text-zinc-500",
  skip: "text-amber-700",
} as const;

export function ForkDialog({
  lessonId,
  lessonTitle,
  lessonTopic,
  classes,
  items,
}: {
  lessonId: string;
  lessonTitle: string;
  lessonTopic: string | null;
  classes: ForkClass[];
  items: ForkItem[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [courseId, setCourseId] = useState(classes[0]?.id ?? "");
  const [override, setOverride] = useState<{ courseId: string; choice: TopicChoice } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const selected = classes.find((c) => c.id === courseId);
  const match = lessonTopic ? topicMatch(lessonTopic, (selected?.topics ?? []).map((name) => ({ name }))) : null;
  // Same-name topic preselected; otherwise no topic. Never create one unless asked.
  const choice: TopicChoice = override?.courseId === courseId ? override.choice : match ? "existing" : "none";

  async function fork() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, courseId, topicChoice: choice }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setError(body.error ?? "Something went wrong. Nothing was posted to your class.");
      else setDone(body);
    } catch {
      setError("Couldn't reach Fork Lesson. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    dialog.current?.close();
    setDone(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Fork to my class
      </button>

      <dialog
        ref={dialog}
        onClose={() => {
          setDone(null);
          setError(null);
        }}
        className="m-auto w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {done ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Draft created in {done.className}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              It&apos;s a draft with no due date. Students can&apos;t see it until you post it.
            </p>
            {done.notCopied.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Please re-add:</p>
                <ul className="list-disc pl-5">
                  {done.notCopied.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              {done.alternateLink && (
                <a
                  href={done.alternateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                >
                  Open in Classroom
                </a>
              )}
              <button type="button" onClick={close} className="rounded-md border border-zinc-300 px-4 py-2 text-sm">
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold">Fork “{lessonTitle}”</h2>

            {classes.length === 0 ? (
              <p className="text-sm text-zinc-600">
                Fork Lesson doesn&apos;t know your classes yet. Open My lessons and click “Sync and publish”, then come back.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Class</span>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    disabled={busy}
                    className="rounded-md border border-zinc-300 bg-transparent px-3 py-2"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.section ? ` · ${c.section}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="flex flex-col gap-2 text-sm" disabled={busy}>
                  <legend className="mb-1 font-medium">Topic</legend>
                  {lessonTopic ? (
                    [
                      ...(match ? [{ value: "existing" as const, text: `Topic “${match.name!.trim()}” (already in this class)` }] : []),
                      ...(match ? [] : [{ value: "create" as const, text: `Create topic “${lessonTopic}”` }]),
                      { value: "none" as const, text: "No topic" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="topic"
                          checked={choice === option.value}
                          onChange={() => setOverride({ courseId, choice: option.value })}
                        />
                        {option.text}
                      </label>
                    ))
                  ) : (
                    <p className="text-zinc-500">This lesson has no topic.</p>
                  )}
                </fieldset>

                <div className="flex flex-col gap-2 text-sm">
                  <p className="font-medium">What gets copied</p>
                  <ul className="flex flex-col gap-1">
                    <li>Title, instructions and points</li>
                    {items.map((item) => (
                      <li key={item.key}>
                        <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">{item.label}</span>
                        {item.title}{" "}
                        <span className={`text-xs ${OUTCOME_STYLE[item.outcome]}`}>{item.note}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-zinc-500">
                    This creates a draft with no due date. Students won&apos;t see it until you post it.
                  </p>
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={fork}
                  disabled={busy || !courseId}
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
                >
                  {busy ? "Forking…" : "Create draft"}
                </button>
              )}
              <button type="button" onClick={close} disabled={busy} className="rounded-md border border-zinc-300 px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
