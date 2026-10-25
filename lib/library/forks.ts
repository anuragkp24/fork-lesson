// "Forked 1 time" / "Forked 3 times"; null when nobody has forked it.
export function forkedLabel(count: number): string | null {
  if (!count || count < 1) return null;
  return `Forked ${count} ${count === 1 ? "time" : "times"}`;
}

// A fork has no page of its own: its lesson page is the original's. Null
// when it isn't a fork, or when the original is gone.
export function hubTarget(lesson: { kind: string; forked_from_lesson_id: string | null }): string | null {
  return lesson.kind === "fork" ? lesson.forked_from_lesson_id : null;
}

// What the "Forked by" list may show. The database only ever returns DRAFT to
// the forker themselves, so everyone else gets no status for a draft.
export function forkStatusLabel(state: string | null): "Assigned" | "Draft" | null {
  if (state === "ASSIGNED") return "Assigned";
  if (state === "DRAFT") return "Draft";
  return null;
}

// My lessons status for a fork, from Classroom's state at the last sync.
export function myForkStatus(classroomState: string | null): "Assigned" | "Draft" | null {
  if (classroomState === "PUBLISHED") return "Assigned";
  if (classroomState === "DRAFT") return "Draft";
  return null;
}
