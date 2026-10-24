"use client";

import { useFormStatus } from "react-dom";

export function SyncButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
    >
      {pending ? "Syncing…" : "Sync and publish"}
    </button>
  );
}
