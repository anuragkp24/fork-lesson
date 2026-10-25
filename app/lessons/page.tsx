import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ForkBadge } from "@/components/fork-badge";
import { FileChip } from "@/components/file-chip";
import { getAccessToken } from "@/lib/google/access-token";
import { myForkStatus } from "@/lib/library/forks";
import { driveOpenUrl } from "@/lib/library/links";
import { createClient, getUser } from "@/lib/supabase/server";
import { attachmentLabel } from "@/lib/sync/map";
import { alertError, card } from "@/lib/ui";
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
  kind: string;
  classroom_state: string | null;
  forked_from_lesson_id: string | null;
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

  const [{ data: courses }, { data: sync }, google] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, name, section, lessons(id, title, description, topic_name, source_updated_at, kind, classroom_state, forked_from_lesson_id, attachments(id, position, kind, title, url, mime_type, unsupported_type, library_file_id, publish_error))"
      )
      .eq("owner_id", user.id)
      .order("name")
      .returns<Course[]>(),
    supabase.from("sync_state").select("*").eq("user_id", user.id).maybeSingle(),
    getAccessToken(user.id),
  ]);

  // Who made the original of each fork, for the "Forked from" badge. Anything
  // that isn't visible to me (deleted, unshared) simply has no entry.
  const originalIds = [
    ...new Set(
      (courses ?? []).flatMap((c) => c.lessons.map((l) => l.forked_from_lesson_id).filter((id): id is string => !!id))
    ),
  ];
  const { data: originals } = originalIds.length
    ? await supabase
        .from("lessons")
        .select("id, teacher:users(name, email)")
        .in("id", originalIds)
        .returns<{ id: string; teacher: { name: string | null; email: string } | null }[]>()
    : { data: [] };
  const originalTeacher = new Map(
    (originals ?? []).map((o) => [o.id, o.teacher?.name ?? o.teacher?.email ?? null])
  );

  return (
    <>
      <AppHeader current="lessons" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold">My lessons</h1>
            <p className="text-sm text-muted">
              {sync?.last_finished_at
                ? `Last synced ${new Date(sync.last_finished_at).toLocaleString()} · ${sync.courses_count ?? 0} classes, ${sync.lessons_count ?? 0} lessons · ${sync.published_count ?? 0} files in the library`
                : "Not synced yet. Sync to bring in your Classroom lessons and share them with your district."}
            </p>
          </div>
          <form action={syncAction}>
            <SyncButton />
          </form>
        </div>

        {sync?.last_error && (
          <p role="alert" className={alertError}>
            Sync problem: {sync.last_error}
          </p>
        )}
        {google.status !== "ok" && (
          <p role="alert" className={alertError}>
            Google connection: {google.reason}. Sign out and sign in again.
          </p>
        )}

        {(courses ?? []).map((course) => (
          <section key={course.id} className="flex flex-col gap-4">
            <h2 className="flex flex-wrap items-baseline gap-2 text-xl font-bold">
              {course.name}
              {course.section && <span className="text-base font-medium text-muted">{course.section}</span>}
            </h2>
            {course.lessons.length === 0 && <p className="text-sm text-muted">No lessons in this class.</p>}
            {groupByTopic([...course.lessons].sort(newestFirst)).map(([topic, lessons]) => (
              <div key={topic ?? "(none)"} className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{topic ?? "No topic"}</h3>
                {lessons.map((lesson) => (
                  <article key={lesson.id} className={`${card} p-5`}>
                    <h4 className="text-lg font-bold">
                      {/* A fork has no page of its own: the original lesson is the hub. */}
                      {lesson.kind === "fork" && !originalTeacher.has(lesson.forked_from_lesson_id ?? "") ? (
                        lesson.title
                      ) : (
                        <Link
                          href={`/lesson/${lesson.kind === "fork" ? lesson.forked_from_lesson_id : lesson.id}`}
                          className="hover:text-brand hover:underline"
                        >
                          {lesson.title}
                        </Link>
                      )}
                    </h4>
                    {lesson.kind === "fork" && (
                      <p className="mt-2 flex flex-wrap items-center gap-2">
                        <ForkBadge
                          originalId={lesson.forked_from_lesson_id}
                          teacher={originalTeacher.get(lesson.forked_from_lesson_id ?? "") ?? null}
                        />
                        {myForkStatus(lesson.classroom_state) && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              lesson.classroom_state === "PUBLISHED"
                                ? "bg-chip-sheet text-chip-sheet-ink"
                                : "bg-chip-slides text-chip-slides-ink"
                            }`}
                          >
                            {myForkStatus(lesson.classroom_state)}
                          </span>
                        )}
                      </p>
                    )}
                    {lesson.description && (
                      <p className="mt-1 text-sm text-muted">
                        {lesson.description.length > 160 ? `${lesson.description.slice(0, 160)}…` : lesson.description}
                      </p>
                    )}
                    <ul className="mt-4 flex flex-col gap-2 text-sm">
                      {[...lesson.attachments]
                        .sort((a, b) => a.position - b.position)
                        .map((att) => (
                          <li key={att.id} className="flex flex-wrap items-center gap-2">
                            <FileChip label={attachmentLabel(att)} />
                            {att.url ? (
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="underline">
                                {att.title ?? att.url}
                              </a>
                            ) : (
                              <span>{att.title ?? "(untitled)"}</span>
                            )}
                            {att.kind === "drive" && lesson.kind === "original" &&
                              (att.library_file_id ? (
                                <a
                                  href={driveOpenUrl(att.library_file_id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand"
                                >
                                  In library
                                </a>
                              ) : att.publish_error ? (
                                <span className="rounded-full bg-danger-light px-2.5 py-0.5 text-xs font-semibold text-danger">
                                  Couldn&apos;t be shared ({att.publish_error})
                                </span>
                              ) : (
                                <span className="text-xs text-muted">Not shared yet</span>
                              ))}
                            {att.kind === "unsupported" && (
                              <span className="text-xs text-chip-slides-ink">Not copied. Re-add it after forking.</span>
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
          <p className="text-sm text-muted">No active classes found where you are a teacher.</p>
        )}
      </main>
    </>
  );
}
