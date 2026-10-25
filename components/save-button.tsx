"use client";

import { useState } from "react";
import { setSaved } from "@/app/library/actions";

const BOOKMARK = "M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z";
const CHECK = "M5 12.5l4.5 4.5L19 7.5";

// The Save pill: bookmark + "Save", or a filled green "✓ Saved". Toggles at
// once and undoes itself if the save fails. Only for someone else's original
// lesson. "card" sits on a Library, Saved or My lessons card (above its
// stretched link); "header" is the larger one on the lesson page.
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

  const size = variant === "header" ? "min-h-11 px-5 text-[15px] gap-2" : "px-2.5 py-1 text-xs gap-1.5";
  const look = saved
    ? "border-brand bg-brand text-white hover:bg-brand-dark"
    : error
      ? "border-danger bg-white text-danger"
      : "border-[#d6ddd8] bg-white text-[#3d4742] hover:bg-brand-light";

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        title={error ? "Couldn't save. Try again." : undefined}
        className={`relative z-10 inline-flex items-center justify-center rounded-full border font-semibold transition-colors before:absolute before:-inset-2 before:content-[''] ${size} ${look}`}
      >
        <svg width={variant === "header" ? 18 : 14} height={variant === "header" ? 18 : 14} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
          {saved ? (
            <path d={CHECK} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d={BOOKMARK} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          )}
        </svg>
        {saved ? "Saved" : "Save"}
      </button>
      {error && variant === "header" && (
        <span role="alert" className="text-sm text-danger">
          Couldn&apos;t save. Try again.
        </span>
      )}
    </>
  );
}
