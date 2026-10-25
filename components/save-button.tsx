"use client";

import { useState } from "react";
import { setSaved } from "@/app/library/actions";

const HEART = "M12 21s-8-4.9-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.1-8 11-8 11z";

// The heart. Toggles at once and undoes itself if the save fails. Only for
// someone else's original lesson. "card" sits on top of a stretched card link.
export function SaveButton({
  lessonId,
  initialSaved,
  variant = "card",
}: {
  lessonId: string;
  initialSaved: boolean;
  variant?: "card" | "header";
}) {
  const [saved, setSavedState] = useState(initialSaved);
  const [error, setError] = useState(false);

  async function toggle() {
    const next = !saved;
    setSavedState(next);
    setError(false);
    try {
      const result = await setSaved({ lessonId, saved: next });
      if (!result.ok) throw new Error(result.error);
    } catch {
      setSavedState(!next);
      setError(true);
    }
  }

  const icon = (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d={HEART} fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );

  if (variant === "header") {
    return (
      <>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={saved}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-line bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:bg-brand-light"
        >
          <span className={saved ? "text-danger" : "text-muted"}>{icon}</span>
          {saved ? "Saved" : "Save for later"}
        </button>
        {error && (
          <span role="alert" className="text-sm text-danger">
            Couldn&apos;t save. Try again.
          </span>
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Saved" : "Save for later"}
      title={error ? "Couldn't save. Try again." : saved ? "Saved" : "Save for later"}
      className={`relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-brand-light ${
        error ? "text-danger" : saved ? "text-danger" : "text-muted"
      }`}
    >
      {icon}
    </button>
  );
}
