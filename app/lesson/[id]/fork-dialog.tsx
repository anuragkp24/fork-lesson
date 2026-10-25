"use client";

import { useRef, useState } from "react";
import { FileChip } from "@/components/file-chip";
import { ThanksForm } from "@/components/thanks-form";
import { topicMatch, type TopicChoice } from "@/lib/fork/plan";
import { alertError, btnPrimary, btnSecondary, input } from "@/lib/ui";

export type ForkClass = { id: string; name: string; section: string | null; topics: string[] };
export type ForkItem = {
  key: string;
  label: string;
  title: string;
  outcome: "copy" | "as-is" | "skip";
  note: string;
};

type Done = { forkId: string; status: "done" | "partial"; className: string; alternateLink: string; notCopied: string[] };

const OUTCOME_STYLE = {
  copy: "text-brand",
  "as-is": "text-muted",
  skip: "text-chip-slides-ink",
} as const;

export function ForkDialog({
  lessonId,
  lessonTitle,
  lessonTopic,
  authorName,
  classes,
  items,
}: {
  lessonId: string;
  lessonTitle: string;
  lessonTopic: string | null;
  authorName: string;
  classes: ForkClass[];
  items: ForkItem[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // No class is preselected: the teacher has to choose where the draft goes.
  const [courseId, setCourseId] = useState("");
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

  function reset() {
    setDone(null);
    setError(null);
    setCourseId("");
    setOverride(null);
  }

  const topicOptions: { value: TopicChoice; text: string }[] = lessonTopic
    ? [
        ...(match
          ? [{ value: "existing" as const, text: `Topic “${match.name!.trim()}” (already in this class)` }]
          : [{ value: "create" as const, text: `Create topic “${lessonTopic}”` }]),
        { value: "none", text: "No topic" },
      ]
    : [];

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={btnPrimary}>
        Fork to my class
      </button>

      <dialog
        ref={dialog}
        onClose={reset}
        className="m-auto max-h-[90vh] w-[calc(100%-2.5rem)] max-w-lg overflow-auto rounded-card border border-line bg-white p-6 text-ink backdrop:bg-ink/50"
      >
        {done ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Draft created in {done.className}</h2>
            <p className="text-muted">
              Your draft is in Classwork for {done.className}. Click it there to set a due date and assign.
            </p>
            {done.notCopied.length > 0 && (
              <div className="rounded-[10px] border border-accent bg-chip-slides p-3 text-sm text-chip-slides-ink">
                <p className="font-semibold">Please re-add:</p>
                <ul className="list-disc pl-5">
                  {done.notCopied.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            <Shoutout
              key={done.forkId}
              forkId={done.forkId}
              authorName={authorName}
              alternateLink={done.alternateLink}
              onClose={() => dialog.current?.close()}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold leading-tight">Fork “{lessonTitle}”</h2>

            {classes.length === 0 ? (
              <p className="text-muted">
                Fork Lesson doesn&apos;t know your classes yet. Open My lessons and click “Sync and publish”, then come back.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-semibold">Class</span>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    disabled={busy}
                    className={input}
                  >
                    <option value="" disabled>
                      Choose a class…
                    </option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.section ? ` · ${c.section}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="flex flex-col text-sm" disabled={busy || !courseId}>
                  <legend className="mb-1 font-semibold">Topic</legend>
                  {!courseId ? (
                    <p className="text-muted">Choose a class to see topic options.</p>
                  ) : lessonTopic ? (
                    topicOptions.map((option) => (
                      <label key={option.value} className="flex min-h-11 items-center gap-3">
                        <input
                          type="radio"
                          name="topic"
                          className="size-4 accent-brand"
                          checked={choice === option.value}
                          onChange={() => setOverride({ courseId, choice: option.value })}
                        />
                        {option.text}
                      </label>
                    ))
                  ) : (
                    <p className="text-muted">This lesson has no topic.</p>
                  )}
                </fieldset>

                <div className="flex flex-col gap-2 text-sm">
                  <p className="font-semibold">What gets copied</p>
                  <ul className="flex flex-col gap-2">
                    <li>Title, instructions and points</li>
                    {items.map((item) => (
                      <li key={item.key} className="flex flex-wrap items-center gap-2">
                        <FileChip label={item.label} />
                        <span>{item.title}</span>
                        <span className={`text-xs ${OUTCOME_STYLE[item.outcome]}`}>{item.note}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted">
                    This creates a draft with no due date. Students won&apos;t see it until you post it.
                  </p>
                </div>
              </>
            )}

            {error && (
              <p role="alert" className={alertError}>
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {classes.length > 0 && (
                <button type="button" onClick={fork} disabled={busy || !courseId} className={btnPrimary}>
                  {busy ? "Forking…" : "Create draft"}
                </button>
              )}
              <button type="button" onClick={() => dialog.current?.close()} disabled={busy} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

// Shown after the draft exists, so it can never block or fail a fork.
function Shoutout({
  forkId,
  authorName,
  alternateLink,
  onClose,
}: {
  forkId: string;
  authorName: string;
  alternateLink: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"ask" | "sent" | "skipped">("ask");

  if (stage !== "ask") {
    return (
      <>
        {stage === "sent" && (
          <p role="status" className="font-semibold text-brand">
            Thanks sent.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <a href={alternateLink} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            Open in Classroom
          </a>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Close
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      <h3 className="text-lg font-bold">
        Say thanks to {authorName}? <span className="text-sm font-normal text-muted">(optional)</span>
      </h3>
      <ThanksForm
        forkId={forkId}
        authorName={authorName}
        onSent={() => setStage("sent")}
        onSkip={() => setStage("skipped")}
      />
    </div>
  );
}
