import { AppHeader } from "@/components/app-header";
import { LIBRARY_LESSON_SELECT, LibraryCard, type LibraryLesson } from "@/components/lesson-card";
import { topTags } from "@/lib/hub/tags";
import { initials } from "@/lib/initials";
import { groupByTeacher, teacherOptions } from "@/lib/library/group";
import { matchesQuery } from "@/lib/library/search";
import { logQueryError } from "@/lib/supabase/log";
import { createClient, getUser } from "@/lib/supabase/server";
import { btnPrimary, input } from "@/lib/ui";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; teacher?: string }> }) {
  const { q = "", teacher = "" } = await searchParams;
  const user = (await getUser())!;
  // Row level security limits this to shared, unhidden lessons in my domain
  // (plus my own).
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lessons")
    .select(LIBRARY_LESSON_SELECT)
    .eq("kind", "original")
    .eq("hidden", false)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .limit(300)
    .returns<LibraryLesson[]>();

  logQueryError("library lessons", error);
  const all = data ?? [];

  // "Forked N times" per original lesson. If this lookup fails the cards just
  // show no count.
  const { data: counts, error: countsError } = await supabase.rpc("lesson_fork_counts", { ids: all.map((l) => l.id) });
  logQueryError("library fork counts", countsError);
  const forkCount = new Map<string, number>(
    ((counts ?? []) as { lesson_id: string; forks: number }[]).map((c) => [c.lesson_id, c.forks])
  );

  // "What teachers like" for every card in one call (anonymous counts), and the
  // lessons I've saved (my own rows only). If either fails the cards just
  // show no chips or an unsaved Save button.
  const [{ data: tagRows, error: tagError }, { data: savedRows, error: savedError }] = await Promise.all([
    supabase.rpc("lesson_tag_counts", { ids: all.map((l) => l.id) }),
    supabase.from("saved_lessons").select("lesson_id"),
  ]);
  logQueryError("library tag counts", tagError);
  logQueryError("library saved", savedError);
  const tagCounts = (tagRows ?? []) as { lesson_id: string; tag: string; n: number }[];
  const saved = new Set((savedRows ?? []).map((r: { lesson_id: string }) => r.lesson_id));
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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-10">
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
                <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {cls.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <LibraryCard
                        lesson={lesson}
                        mine={lesson.owner_id === user.id}
                        saved={saved.has(lesson.id)}
                        forkCount={forkCount.get(lesson.id) ?? 0}
                        tags={topTags(tagCounts, lesson.id, 2)}
                      />
                    </li>
                  ))}
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
