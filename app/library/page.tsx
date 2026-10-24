import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { FileChip } from "@/components/file-chip";
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

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const user = (await getUser())!;
  // Row level security limits this to shared, unhidden lessons in my domain
  // (plus my own).
  const supabase = await createClient();

  const { data } = await supabase
    .from("lessons")
    .select(
      "id, owner_id, title, description, topic_name, source_updated_at, teacher:users(name, email), course:courses(name, section), attachments(kind, mime_type, unsupported_type)"
    )
    .eq("hidden", false)
    .order("source_updated_at", { ascending: false, nullsFirst: false })
    .limit(300)
    .returns<LibraryLesson[]>();

  const lessons = (data ?? []).filter((l) =>
    matchesQuery(
      [l.title, l.description, l.topic_name, l.teacher?.name, l.teacher?.email, l.course?.name, l.course?.section],
      q
    )
  );
  const noun = lessons.length === 1 ? "lesson" : "lessons";

  return (
    <>
      <AppHeader current="library" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Library</h1>
          <p className="text-muted">Lessons shared by teachers in your district. Fork one into your own class.</p>
        </div>

        <form action="/library" role="search" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search the library"
            placeholder="Search by lesson, teacher, class or topic"
            className={input}
          />
          <button type="submit" className={btnPrimary}>
            Search
          </button>
        </form>

        <p className="text-sm text-muted">
          {q ? `${lessons.length} ${noun} matching “${q}”` : `${lessons.length} shared ${noun} in your district`}
        </p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {lessons.map((lesson) => {
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
                  <h2 className="text-lg font-bold leading-snug">{lesson.title}</h2>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span>{lesson.teacher?.name ?? lesson.teacher?.email ?? "A teacher"}</span>
                    {mine && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">You</span>
                    )}
                    {lesson.topic_name && <span>· {lesson.topic_name}</span>}
                  </p>
                  {lesson.attachments.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      {attachmentSummaryParts(lesson.attachments).map(({ label, count }) => (
                        <FileChip key={label} label={label} count={count} />
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {lessons.length === 0 && (
          <p className="text-sm text-muted">
            {q ? "Nothing matches. Try fewer words." : "No shared lessons yet. Teachers' lessons appear here after they sync."}
          </p>
        )}
      </main>
    </>
  );
}
