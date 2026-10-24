import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { getAccessToken } from "@/lib/google/access-token";
import { createClient, getUser } from "@/lib/supabase/server";
import { driveOpenUrl } from "@/lib/library/links";
import { attachmentLabel } from "@/lib/sync/map";
import { syncAction } from "./actions";
import { SyncButton } from "./sync-button";

type Attachment = {
  id: string;
  position: number;
  kind: string;
  title: string | null;
  url: string | null;
  mime_type: string | null;
  unsupported_type: string | null;
  library_file_id: string | null;
  publish_error: string | null;
};

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  topic_name: string | null;
  source_updated_at: string | null;
  attachments: Attachment[];
};

type Course = {
  id: string;
  name: string;
  section: string | null;
  lessons: Lesson[];
};

function groupByTopic(lessons: Lesson[]): [string | null, Lesson[]][] {
  const groups = new Map<string | null, Lesson[]>();
  for (const lesson of lessons) {
    groups.set(lesson.topic_name, [...(groups.get(lesson.topic_name) ?? []), lesson]);
  }
  // Named topics A to Z, lessons without a topic last.
  return [...groups.entries()].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)));
}

function newestFirst(a: Lesson, b: Lesson) {
  return (b.source_updated_at ?? "").localeCompare(a.source_updated_at ?? "");
}

export default async function LessonsPage() {
  const user = (await getUser())!;
  // The signed-in client, so row level security decides what comes back.
  const supabase = await createClient();

  const [{ data: courses }, { data: sync }, { data: profile }, google] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, section, lessons(id, title, description, topic_name, source_updated_at, attachments(id, position, kind, title, url, mime_type, unsupported_type, library_file_id, publish_error))"
      )
      .eq("owner_id", user.id)
      .order("name")
      .returns<Course[]>(),
    supabase.from("sync_state").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("users").select("name, email, domain").eq("id", user.id).maybeSingle(),
    getAccessToken(user.id),
  ]);

  return (
    <>
    <AppNav current="lessons" />
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My lessons</h1>
          <p className="text-sm text-zinc-500">
            {sync?.last_finished_at
              ? `Last synced ${new Date(sync.last_finished_at).toLocaleString()} · ${sync.courses_count ?? 0} classes, ${sync.lessons_count ?? 0} lessons · ${sync.published_count ?? 0} files in the library`
              : "Not synced yet."}
          </p>
        </div>
        <form action={syncAction}>
          <SyncButton />
        </form>
      </header>

      {sync?.last_error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Sync problem: {sync.last_error}
        </p>
      )}

      {(courses ?? []).map((course) => (
        <section key={course.id} className="flex flex-col gap-4">
          <h2 className="border-b border-zinc-200 pb-2 text-lg font-semibold dark:border-zinc-800">
            {course.name}
            {course.section ? ` · ${course.section}` : ""}
          </h2>
          {course.lessons.length === 0 && <p className="text-sm text-zinc-500">No lessons in this class.</p>}
          {groupByTopic([...course.lessons].sort(newestFirst)).map(([topic, lessons]) => (
            <div key={topic ?? "(none)"} className="flex flex-col gap-3">
              <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">{topic ?? "No topic"}</h3>
              {lessons.map((lesson) => (
                <article key={lesson.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <h4 className="font-medium">
                    <Link href={`/lesson/${lesson.id}`} className="hover:underline">
                      {lesson.title}
                    </Link>
                  </h4>
                  {lesson.description && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {lesson.description.length > 160 ? `${lesson.description.slice(0, 160)}…` : lesson.description}
                    </p>
                  )}
                  <ul className="mt-3 flex flex-col gap-1 text-sm">
                    {[...lesson.attachments]
                      .sort((a, b) => a.position - b.position)
                      .map((att) => (
                        <li key={att.id} className="flex items-baseline gap-2">
                          <span className="w-14 shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-center text-xs font-medium dark:bg-zinc-800">
                            {attachmentLabel(att)}
                          </span>
                          {att.url ? (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="underline">
                              {att.title ?? att.url}
                            </a>
                          ) : (
                            <span>{att.title ?? "(untitled)"}</span>
                          )}
                          {att.kind === "drive" &&
                            (att.library_file_id ? (
                              <a
                                href={driveOpenUrl(att.library_file_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-green-700 underline"
                              >
                                In library
                              </a>
                            ) : att.publish_error ? (
                              <span className="text-xs text-red-700">
                                This file couldn&apos;t be shared ({att.publish_error})
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-500">Not shared yet</span>
                            ))}
                          {att.kind === "unsupported" && (
                            <span className="text-xs text-amber-700">Not copied. Re-add it after forking.</span>
                          )}
                        </li>
                      ))}
                  </ul>
                </article>
              ))}
            </div>
          ))}
        </section>
      ))}

      {courses?.length === 0 && sync?.last_finished_at && !sync.last_error && (
        <p className="text-sm text-zinc-500">No active classes found where you are a teacher.</p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500">Account and connection</summary>
        <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2">
          <dt className="text-zinc-500">Signed in as</dt>
          <dd>{profile?.name ?? "(no name)"} · {profile?.email ?? user.email}</dd>
          <dt className="text-zinc-500">Sharing domain</dt>
          <dd>{profile?.domain ?? "not saved"}</dd>
          <dt className="text-zinc-500">Google connection</dt>
          <dd>{google.status === "ok" ? "working" : `${google.status}: ${google.reason}`}</dd>
        </dl>
        <form action="/auth/signout" method="post" className="mt-4">
          <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            Sign out
          </button>
        </form>
      </details>
    </main>
    </>
  );
}
