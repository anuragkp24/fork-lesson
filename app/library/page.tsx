import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { attachmentSummary, matchesQuery } from "@/lib/library/search";
import { createClient, getUser } from "@/lib/supabase/server";

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
    matchesQuery([l.title, l.description, l.topic_name, l.teacher?.name, l.teacher?.email, l.course?.name, l.course?.section], q)
  );

  return (
    <>
      <AppNav current="library" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <form action="/library" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by lesson, teacher, class or topic"
            className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
            Search
          </button>
        </form>

        <p className="text-sm text-zinc-500">
          {q ? `${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"} matching “${q}”` : `${lessons.length} shared ${lessons.length === 1 ? "lesson" : "lessons"} in your school`}
        </p>

        <ul className="flex flex-col gap-3">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/lesson/${lesson.id}`}
                className="block rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <h2 className="font-medium">{lesson.title}</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {lesson.owner_id === user.id ? "You" : (lesson.teacher?.name ?? lesson.teacher?.email ?? "A teacher")}
                  {lesson.course ? ` · ${lesson.course.name}${lesson.course.section ? ` · ${lesson.course.section}` : ""}` : ""}
                  {lesson.topic_name ? ` · ${lesson.topic_name}` : ""}
                </p>
                {lesson.attachments.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-500">{attachmentSummary(lesson.attachments)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {lessons.length === 0 && (
          <p className="text-sm text-zinc-500">
            {q ? "Nothing matches. Try fewer words." : "No shared lessons yet. Teachers' lessons appear here after they sync."}
          </p>
        )}
      </main>
    </>
  );
}
