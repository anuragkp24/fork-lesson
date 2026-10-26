import { hasForkableAttachment } from "@/lib/library/qualifies";
import { pairLabel, type Grade, type Subject } from "./labels";

// The last onboarding screen: Library lessons that match what the teacher
// teaches, or a neutral "what teachers in your district are sharing" when
// there are fewer than 3, or nothing when the Library is empty. Pure; the page
// does the query.

export type PayoffCandidate = {
  id: string;
  ownerSchoolId: string | null;
  subject: string | null;
  grade: string | null;
  forks: number;
  updatedAt: string | null;
};

export type TaughtClass = { subject: Subject | null; grade: Grade | null };

export type Payoff<T> =
  | { mode: "match"; lessons: T[]; total: number; fromMySchool: number; label: string | null }
  | { mode: "district"; lessons: T[] }
  | { mode: "empty" };

const SHOWN = 3;

// What the Library would show this teacher: someone else's original lessons
// with something to fork. Row level security has already left out hidden and
// unshared ones.
export function payoffCandidates<T extends { owner_id: string; attachments: { kind: string; library_file_id?: string | null }[] }>(
  rows: T[],
  myId: string
): T[] {
  return rows.filter((r) => r.owner_id !== myId && hasForkableAttachment(r.attachments));
}

// The (subject, grade) pairs she teaches, shared or not. Classes that aren't a
// subject, or have no subject or grade yet, don't count.
export function taughtPairs(classes: TaughtClass[]): { subject: Subject; grade: Grade }[] {
  const pairs = new Map<string, { subject: Subject; grade: Grade }>();
  for (const c of classes) {
    if (!c.subject || c.subject === "none" || !c.grade) continue;
    pairs.set(`${c.subject}|${c.grade}`, { subject: c.subject, grade: c.grade });
  }
  return [...pairs.values()];
}

// Same subject, and the same grade or "mixed" on either side. A candidate
// whose class has no subject or grade yet never matches.
export function matches(candidate: PayoffCandidate, pairs: { subject: Subject; grade: Grade }[]): boolean {
  if (!candidate.subject || candidate.subject === "none" || !candidate.grade) return false;
  return pairs.some(
    (p) =>
      p.subject === candidate.subject && (p.grade === candidate.grade || p.grade === "mixed" || candidate.grade === "mixed")
  );
}

function byForksThenNewest(a: PayoffCandidate, b: PayoffCandidate): number {
  return b.forks - a.forks || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
}

export function pickPayoff<T extends PayoffCandidate>({
  candidates,
  myClasses,
  mySchoolId,
}: {
  candidates: T[];
  myClasses: TaughtClass[];
  mySchoolId: string | null;
}): Payoff<T> {
  if (candidates.length === 0) return { mode: "empty" };

  const pairs = taughtPairs(myClasses);
  const fromMine = (c: T) => !!mySchoolId && c.ownerSchoolId === mySchoolId;
  const matched = candidates.filter((c) => matches(c, pairs));

  if (matched.length >= SHOWN) {
    const ordered = [...matched].sort((a, b) => Number(fromMine(b)) - Number(fromMine(a)) || byForksThenNewest(a, b));
    return {
      mode: "match",
      lessons: ordered.slice(0, SHOWN),
      total: matched.length,
      fromMySchool: matched.filter(fromMine).length,
      label: pairs.length === 1 ? pairLabel(pairs[0].subject, pairs[0].grade) : null,
    };
  }
  return { mode: "district", lessons: [...candidates].sort(byForksThenNewest).slice(0, SHOWN) };
}

// "12 Grade 7 Math lessons are waiting for you", or "12 lessons for what you
// teach are waiting for you" when she teaches several subject/grade pairs.
export function payoffHeadline(total: number, label: string | null): string {
  return label ? `${total} ${label} lessons are waiting for you` : `${total} lessons for what you teach are waiting for you`;
}

// "3 are from Central Middle School.", "1 is from …".
export function fromSchoolLine(count: number, school: string): string {
  return `${count} ${count === 1 ? "is" : "are"} from ${school}.`;
}
