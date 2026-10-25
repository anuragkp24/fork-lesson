"use client";

import { useRef, useState } from "react";
import { ThanksForm } from "@/components/thanks-form";
import { btnSecondary } from "@/lib/ui";

// "Say thanks" for a fork that hasn't thanked yet: opens the thanks form in a
// small dialog. After Send it reads "Thanks sent ✓", final.
export function SayThanks({ forkId, authorName }: { forkId: string; authorName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) return <ThanksSent />;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        className={`${btnSecondary} relative z-10 min-h-9 px-3.5 text-sm`}
      >
        Say thanks
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        className="m-auto max-h-[90vh] w-[calc(100%-2.5rem)] max-w-lg overflow-auto rounded-card border border-line bg-white p-6 text-ink backdrop:bg-ink/50"
      >
        {open && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Say thanks to {authorName}</h2>
            <ThanksForm
              forkId={forkId}
              authorName={authorName}
              skipLabel="Cancel"
              onSkip={() => dialog.current?.close()}
              onSent={() => {
                setSent(true);
                dialog.current?.close();
              }}
            />
          </div>
        )}
      </dialog>
    </>
  );
}

export function ThanksSent() {
  return (
    <span role="status" className="inline-flex items-center text-sm font-semibold text-brand">
      Thanks sent ✓
    </span>
  );
}
