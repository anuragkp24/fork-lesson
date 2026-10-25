import type { ClassroomCourseWork } from "./map";

// Splits a class's courseWork into the teacher's own lessons and the forks we
// created for them (matched by the courseWork id we got back at fork time).
export function partitionCourseWork(
  courseWork: ClassroomCourseWork[],
  forkCourseWorkIds: Set<string>
): { forks: ClassroomCourseWork[]; regular: ClassroomCourseWork[] } {
  const forks: ClassroomCourseWork[] = [];
  const regular: ClassroomCourseWork[] = [];
  for (const work of courseWork) (forkCourseWorkIds.has(work.id) ? forks : regular).push(work);
  return { forks, regular };
}

export type ForkState = "DRAFT" | "PUBLISHED" | "REMOVED";

// What a fork's courseWork state means for us. Unknown states count as drafts:
// the safe reading, since nothing has reached students.
export function forkStateFrom(state: string | undefined): ForkState {
  if (state === "PUBLISHED") return "PUBLISHED";
  if (state === "DELETED") return "REMOVED";
  return "DRAFT";
}
