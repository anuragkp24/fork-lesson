import { btnPrimary, btnSecondary } from "@/lib/ui";
import { shareClassAction } from "./actions";

// Shown on a class the teacher hasn't answered for yet. Until they do, the
// class is read but nothing from it is published or shown to colleagues.
export function SharePrompt({ courseId }: { courseId: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-brand-light p-3">
      <p className="text-sm font-semibold">Share this class with teachers in your district?</p>
      <div className="flex gap-2">
        <form action={shareClassAction.bind(null, courseId, true)}>
          <button type="submit" className={btnPrimary}>
            Yes
          </button>
        </form>
        <form action={shareClassAction.bind(null, courseId, false)}>
          <button type="submit" className={btnSecondary}>
            Not now
          </button>
        </form>
      </div>
    </div>
  );
}
