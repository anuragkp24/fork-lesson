"use client";

import { useState } from "react";
import { sendShoutout } from "@/app/lesson/[id]/actions";
import { SHOUTOUT_NOTE_MAX } from "@/lib/hub/shoutout";
import { SHOUTOUT_TAGS, type ShoutoutTag } from "@/lib/hub/tags";
import { alertError, btnPrimary, btnSecondary, input } from "@/lib/ui";

// The thank-you form: tags and an optional note. Used on the fork success
// screen and by Say thanks. One per fork, final once sent.
export function ThanksForm({
  forkId,
  authorName,
  onSent,
  onSkip,
  skipLabel = "Skip",
}: {
  forkId: string;
  authorName: string;
  onSent: () => void;
  onSkip: () => void;
  skipLabel?: string;
}) {
  const [tags, setTags] = useState<ShoutoutTag[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: ShoutoutTag) =>
    setTags((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  const canSend = (tags.length > 0 || note.trim() !== "") && note.trim().length <= SHOUTOUT_NOTE_MAX;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const result = await sendShoutout({ forkId, tags, note });
      if (result.ok) onSent();
      else setError(result.error);
    } catch {
      setError("Couldn't reach Fork Lesson. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="What you liked">
        {SHOUTOUT_TAGS.map((tag) => {
          const on = tags.includes(tag.key);
          return (
            <button
              key={tag.key}
              type="button"
              aria-pressed={on}
              disabled={busy}
              onClick={() => toggle(tag.key)}
              className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold ${
                on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:bg-brand-light"
              }`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">
          Add a note to {authorName} (only {authorName} sees it)
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={SHOUTOUT_NOTE_MAX}
          rows={3}
          disabled={busy}
          className={`${input} py-2.5`}
        />
        <span className="flex justify-between text-muted">
          <span>Don&apos;t include student names.</span>
          <span>
            {note.length}/{SHOUTOUT_NOTE_MAX}
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className={alertError}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={send} disabled={busy || !canSend} className={btnPrimary}>
          {busy ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={onSkip} disabled={busy} className={btnSecondary}>
          {skipLabel}
        </button>
      </div>
    </div>
  );
}
