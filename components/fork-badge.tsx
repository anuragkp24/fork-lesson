import Link from "next/link";
import { ForkIcon } from "./fork-icon";

const BADGE =
  "inline-flex items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand";

// "Forked from <teacher>", linked to the original lesson page. Without an
// original to link to (it was deleted or unshared) it says so, unlinked.
export function ForkBadge({ originalId, teacher }: { originalId: string | null; teacher: string | null }) {
  if (!originalId || !teacher) {
    return (
      <span className={`${BADGE} bg-chip-link text-chip-link-ink`}>
        <ForkIcon /> Forked from a lesson that&apos;s no longer shared
      </span>
    );
  }
  return (
    <Link href={`/lesson/${originalId}`} className={`${BADGE} hover:bg-brand hover:text-white`}>
      <ForkIcon /> Forked from {teacher}
    </Link>
  );
}
