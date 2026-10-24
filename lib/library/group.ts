export type GroupableLesson = {
  owner_id: string;
  source_updated_at: string | null;
  teacher: { name: string | null; email: string } | null;
  course: { name: string; section: string | null } | null;
};

export type TeacherGroup<T extends GroupableLesson> = {
  teacherId: string;
  name: string;
  isYou: boolean;
  count: number;
  classes: { label: string; lessons: T[] }[];
};

export function teacherName(lesson: GroupableLesson): string {
  return lesson.teacher?.name?.trim() || lesson.teacher?.email || "A teacher";
}

export function classLabel(lesson: GroupableLesson): string {
  if (!lesson.course) return "Class";
  return lesson.course.section ? `${lesson.course.name} · ${lesson.course.section}` : lesson.course.name;
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
const newestFirst = (a: GroupableLesson, b: GroupableLesson) =>
  (b.source_updated_at ?? "").localeCompare(a.source_updated_at ?? "");

// One group per teacher: other teachers A to Z, then you. Inside a teacher,
// classes A to Z and each class's lessons newest first.
export function groupByTeacher<T extends GroupableLesson>(lessons: T[], currentUserId: string): TeacherGroup<T>[] {
  const byTeacher = new Map<string, T[]>();
  for (const lesson of lessons) {
    byTeacher.set(lesson.owner_id, [...(byTeacher.get(lesson.owner_id) ?? []), lesson]);
  }

  const groups = [...byTeacher.entries()].map(([teacherId, items]): TeacherGroup<T> => {
    const byClass = new Map<string, T[]>();
    for (const lesson of items) {
      const label = classLabel(lesson);
      byClass.set(label, [...(byClass.get(label) ?? []), lesson]);
    }
    return {
      teacherId,
      name: teacherName(items[0]),
      isYou: teacherId === currentUserId,
      count: items.length,
      classes: [...byClass.entries()]
        .sort(([a], [b]) => byText(a, b))
        .map(([label, group]) => ({ label, lessons: [...group].sort(newestFirst) })),
    };
  });

  return groups.sort((a, b) => (a.isYou === b.isYou ? byText(a.name, b.name) : a.isYou ? 1 : -1));
}

// Choices for the Teacher filter, in the same order as the groups.
export function teacherOptions(
  lessons: GroupableLesson[],
  currentUserId: string
): { id: string; label: string }[] {
  return groupByTeacher(lessons, currentUserId).map((g) => ({
    id: g.teacherId,
    label: g.isYou ? `You (${g.name})` : g.name,
  }));
}
