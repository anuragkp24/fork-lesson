import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ForkIcon } from "@/components/fork-icon";
import { YouTag } from "@/components/you-tag";
import { FileChip } from "@/components/file-chip";
import { initials } from "@/lib/initials";
import { forkedLabel } from "@/lib/library/forks";
import { groupByTeacher, teacherOptions } from "@/lib/library/group";
import { attachmentSummaryParts, matchesQuery } from "@/lib/library/search";
import { createClient, getUser } from "@/lib/supabase/server";
import { btnPrimary, card, input } from "@/lib/ui";

type LibraryLesson = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  topic_name: string | null;
  source_updated_at: string | null;
  teacher: { name: string | null; email: string } | null;
  course: { name: string; section: string | null } | null;
  attachments: { kind: string; mime_type: string | null; unsupported_type: string | null }[];
};

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; teacher?: string }> }) {
  const { q = "", teacher = "" } = await searchParams;
  const user = (await getUser())!;
  // Row level security limits this to shared, unhidden lessons in my domain
  // (plus my own).
  const supabase = await createClient();

  const { data } = await supabase
    .from("lessons")
    .select(
      "id, owner_id, title, description, topic_name, source_updated_at, teacher:users(name, email), course:courses(name, section), attachments(kind, mime_type, unsupported_type)"
    )
    .eq("kind", "original")
    .eq("hidden", false)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .limit(300)
    .returns<LibraryLesson[]>();

  const all = data ?? [];

  // "Forked N times" per original lesson. If this lookup fails the cards just
  // show no count.
  const { data: counts } = await supabase.rpc("lesson_fork_counts", { ids: all.map((l) => l.id) });
  const forkCount = new Map<string, number>(
    ((counts ?? []) as { lesson_id: string; forks: number }[]).map((c) => [c.lesson_id, c.forks])
  );
  const options = teacherOptions(all, user.id);
  const lessons = all.filter(
    (l) =>
      (!teacher || l.owner_id === teacher) &&
      matchesQuery(
        [l.title, l.description, l.topic_name, l.teacher?.name, l.teacher?.email, l.course?.name, l.course?.section],
        q
      )
  );
  const groups = groupByTeacher(lessons, user.id);
  const noun = lessons.length === 1 ? "lesson" : "lessons";

  return (
    <>
      <AppHeader current="library" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Library</h1>
          <p className="text-muted">Lessons shared by teachers in your district. Fork one into your own class.</p>
        </div>

        <form action="/library" role="search" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search the library"
            placeholder="Search by lesson, teacher, class or topic"
            className={`${input} min-w-48 flex-1`}
          />
          <select name="teacher" defaultValue={teacher} aria-label="Filter by teacher" className={`${input} sm:w-56`}>
            <option value="">All teachers</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" className={btnPrimary}>
            Search
          </button>
        </form>

        <p className="text-sm text-muted">
          {q ? `${lessons.length} ${noun} matching “${q}”` : `${lessons.length} shared ${noun} in your district`}
        </p>

        {groups.map((group) => (
          <section key={group.teacherId} className="flex flex-col gap-4" aria-label={group.isYou ? "You" : group.name}>
            <div className="flex items-center gap-3 border-b border-line pb-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-bold text-brand"
                aria-hidden="true"
              >
                {initials(group.name, null)}
              </span>
              <div className="flex flex-col">
                <h2 className="text-xl font-bold leading-tight">{group.isYou ? "You" : group.name}</h2>
                <p className="text-sm text-muted">
                  {group.count} {group.count === 1 ? "lesson" : "lessons"}
                </p>
              </div>
            </div>

            {group.classes.map((cls) => (
              <div key={cls.label} className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{cls.label}</h3>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {cls.lessons.map((lesson) => {
                    const mine = lesson.owner_id === user.id;
                    const classLine = lesson.course
                      ? `${lesson.course.name}${lesson.course.section ? ` · ${lesson.course.section}` : ""}`
                      : "Class";
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`/lesson/${lesson.id}`}
                          className={`${card} flex h-full flex-col gap-3 p-5 transition-colors hover:border-brand`}
                        >
                          <p className="text-xs font-bold uppercase tracking-wider text-brand">{classLine}</p>
                          <h4 className="text-lg font-bold leading-snug">{lesson.title}</h4>
                          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                            <span>{lesson.teacher?.name ?? lesson.teacher?.email ?? "A teacher"}</span>
                            {mine && <YouTag />}
                            {lesson.topic_name && <span>· {lesson.topic_name}</span>}
                          </p>
                          {(lesson.attachments.length > 0 || forkedLabel(forkCount.get(lesson.id) ?? 0)) && (
                            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="flex flex-wrap gap-1.5">
                                {attachmentSummaryParts(lesson.attachments).map(({ label, count }) => (
                                  <FileChip key={label} label={label} count={count} />
                                ))}
                              </div>
                              {forkedLabel(forkCount.get(lesson.id) ?? 0) && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
                                  <ForkIcon /> {forkedLabel(forkCount.get(lesson.id) ?? 0)}
                                </span>
                              )}
                            </div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ))}

        {lessons.length === 0 && (
          <p className="text-sm text-muted">
            {q ? "Nothing matches. Try fewer words." : "No shared lessons yet. Teachers' lessons appear here after they sync."}
          </p>
        )}
      </main>
    </>
  );
}
