"use client";

import { useFormStatus } from "react-dom";
import { btnPrimary } from "@/lib/ui";

export function SyncButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={btnPrimary}
    >
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}
