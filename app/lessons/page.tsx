import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ForkedCount, LIBRARY_LESSON_SELECT, LessonCard, LibraryCard, type LibraryLesson } from "@/components/lesson-card";
import { SayThanks, ThanksSent } from "@/components/say-thanks";
import type { MediaAttachment } from "@/lib/cards/media";
import { getAccessToken } from "@/lib/google/access-token";
import { topTags } from "@/lib/hub/tags";
import { forkThanksState, thanksBadge } from "@/lib/hub/thanks";
import { firstName } from "@/lib/initials";
import { myForkStatus } from "@/lib/library/forks";
import { hasForkableAttachment } from "@/lib/library/qualifies";
import { lessonsTab, publishProblemLabel } from "@/lib/library/tabs";
import { logQueryError } from "@/lib/supabase/log";
import { createClient, getUser } from "@/lib/supabase/server";
import { alertError } from "@/lib/ui";
import { needsSync, syncedAgo } from "@/lib/sync/schedule";
import { syncAction } from "./actions";
import { AutoRefresh } from "./auto-refresh";
import { SharePrompt } from "./share-prompt";
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
  thumbnail_path: string | null;
  thumbnail_version: string | null;
};

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  topic_name: string | null;
  source_updated_at: string | null;
  kind: string;
  classroom_state: string | null;
  fork_id: string | null;
  forked_from_lesson_id: string | null;
  attachments: Attachment[];
};

type Course = {
  id: string;
  name: string;
  section: string | null;
  shared: boolean;
  share_decided: boolean;
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

// Drive files of mine that still wait for a library copy or a card picture
// (copies and pictures are done in batches, so a big first sync takes a few runs).
async function filesWaiting(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("attachments")
    .select("library_file_id, publish_error, thumbnail_path, thumbnail_checked_at, lessons!inner(owner_id, kind, hidden, courses!inner(shared, share_decided))")
    .eq("kind", "drive")
    .eq("lessons.owner_id", userId)
    .eq("lessons.kind", "original")
    .eq("lessons.hidden", false)
    .eq("lessons.courses.shared", true)
    .eq("lessons.courses.share_decided", true)
    .limit(500);
  logQueryError("my lessons files waiting", error);
  return (data ?? []).some(
    (a) => (!a.library_file_id && !a.publish_error) || (a.library_file_id && !a.thumbnail_path && !a.thumbnail_checked_at)
  );
}

const TAB = "inline-flex min-h-11 items-center border-b-2 px-4 text-[15px] font-semibold";

export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = lessonsTab((await searchParams).tab);
  const user = (await getUser())!;
  // The signed-in client, so row level security decides what comes back.
  const supabase = await createClient();

  const [{ data: sync }, google] = await Promise.all([
    supabase.from("sync_state").select("*").eq("user_id", user.id).maybeSingle(),
    getAccessToken(user.id),
  ]);

  const now = new Date();
  const state = needsSync({
    lastStartedAt: sync?.last_started_at ?? null,
    lastFinishedAt: sync?.last_finished_at ?? null,
    now,
  });
  // "run" means the page load itself is about to start one (AppHeader).
  const syncing = state !== "fresh" && google.status === "ok";
  const moreOnTheWay = !syncing && (await filesWaiting(supabase, user.id));

  return (
    <>
      <AppHeader current="lessons" />
      <AutoRefresh active={syncing} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold">My lessons</h1>
            <p className="text-sm text-muted">
              {syncing
                ? "Syncing…"
                : sync?.last_finished_at
                  ? `Last synced ${syncedAgo(sync.last_finished_at, now)} · ${sync.courses_count ?? 0} classes, ${sync.lessons_count ?? 0} lessons · ${sync.published_count ?? 0} files in the library${moreOnTheWay ? " · more files are on the way" : ""}`
                  : "Not synced yet. Your lessons sync on their own when you open the app."}
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

        <nav aria-label="My lessons" className="-mb-2 flex gap-1 border-b border-line">
          <Link
            href="/lessons"
            aria-current={tab === "mine" ? "page" : undefined}
            className={`${TAB} ${tab === "mine" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            My lessons
          </Link>
          <Link
            href="/lessons?tab=saved"
            aria-current={tab === "saved" ? "page" : undefined}
            className={`${TAB} ${tab === "saved" ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            Saved
          </Link>
        </nav>

        {tab === "saved" ? (
          <SavedLessons userId={user.id} />
        ) : (
          <MyLessons userId={user.id} showEmptyNote={!!sync?.last_finished_at && !sync.last_error} />
        )}
      </main>
    </>
  );
}

// Saved lessons I can still see, newest save first. One that is later hidden
// or unshared drops out of the list, and comes back if it is shared again.
async function SavedLessons({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: savedRows, error: savedError } = await supabase
    .from("saved_lessons")
    .select("lesson_id, created_at")
    .order("created_at", { ascending: false });
  logQueryError("saved lessons", savedError);
  const savedIds = (savedRows ?? []).map((r: { lesson_id: string }) => r.lesson_id);

  const { data, error: lessonsError } = savedIds.length
    ? await supabase
        .from("lessons")
        .select(LIBRARY_LESSON_SELECT)
        .in("id", savedIds)
        .eq("kind", "original")
        .eq("hidden", false)
        .returns<LibraryLesson[]>()
    : { data: [] as LibraryLesson[], error: null };
  logQueryError("saved lessons detail", lessonsError);
  const byId = new Map((data ?? []).map((l) => [l.id, l]));
  const lessons = savedIds.flatMap((id) => byId.get(id) ?? []).filter((l) => l.owner_id !== userId && hasForkableAttachment(l.attachments));

  const ids = lessons.map((l) => l.id);
  const [{ data: counts, error: countsError }, { data: tagRows, error: tagError }] = ids.length
    ? await Promise.all([
        supabase.rpc("lesson_fork_counts", { ids }),
        supabase.rpc("lesson_tag_counts", { ids }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  logQueryError("saved fork counts", countsError);
  logQueryError("saved tag counts", tagError);
  const forkCount = new Map<string, number>(
    ((counts ?? []) as { lesson_id: string; forks: number }[]).map((c) => [c.lesson_id, c.forks])
  );
  const tagCounts = (tagRows ?? []) as { lesson_id: string; tag: string; n: number }[];

  if (lessons.length === 0) {
    return <p className="text-sm text-muted">Tap Save on any lesson in the Library to keep it here.</p>;
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <LibraryCard
            lesson={lesson}
            mine={false}
            saved
            forkCount={forkCount.get(lesson.id) ?? 0}
            tags={topTags(tagCounts, lesson.id, 2)}
          />
        </li>
      ))}
    </ul>
  );
}

async function MyLessons({ userId, showEmptyNote }: { userId: string; showEmptyNote: boolean }) {
  const supabase = await createClient();

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select(
      "id, name, section, shared, share_decided, lessons(id, title, description, topic_name, source_updated_at, kind, classroom_state, fork_id, forked_from_lesson_id, attachments(id, position, kind, title, url, mime_type, unsupported_type, library_file_id, publish_error, thumbnail_path, thumbnail_version))"
    )
    .eq("owner_id", userId)
    .order("name")
    .returns<Course[]>();

  logQueryError("my lessons", coursesError);
  const allLessons = (courses ?? []).flatMap((c) => c.lessons);

  // Who made the original of each fork, for the "Forked from" badge. Anything
  // that isn't visible to me (deleted, unshared) simply has no entry.
  const originalIds = [
    ...new Set(allLessons.map((l) => l.forked_from_lesson_id).filter((id): id is string => !!id)),
  ];
  const { data: originals, error: originalsError } = originalIds.length
    ? await supabase
        .from("lessons")
        .select(
          "id, teacher:users!lessons_owner_id_fkey(name, email), attachments(kind, mime_type, url, position, library_file_id, thumbnail_path, thumbnail_version)"
        )
        .in("id", originalIds)
        .returns<
          { id: string; teacher: { name: string | null; email: string } | null; attachments: MediaAttachment[] }[]
        >()
    : { data: [], error: null };
  logQueryError("my lessons originals", originalsError);
  // A fork card shows the original's picture.
  const originalAttachments = new Map((originals ?? []).map((o) => [o.id, o.attachments]));
  const originalTeacher = new Map(
    (originals ?? []).map((o) => [o.id, o.teacher?.name ?? o.teacher?.email ?? null])
  );

  // Fork counts and the private thank-you counts (author only) for my originals.
  const ownIds = allLessons.filter((l) => l.kind === "original").map((l) => l.id);
  const forkIds = allLessons.flatMap((l) => (l.kind === "fork" && l.fork_id ? [l.fork_id] : []));
  const none = { data: [], error: null };
  const [counts, sent, forks] = await Promise.all([
    ownIds.length ? supabase.rpc("lesson_fork_counts", { ids: ownIds }) : none,
    forkIds.length ? supabase.rpc("my_thanks_sent", { fork_ids: forkIds }) : none,
    forkIds.length ? supabase.from("forks").select("id, status, removed_at").in("id", forkIds) : none,
  ]);
  logQueryError("my lessons fork counts", counts.error);
  logQueryError("my lessons thanks sent", sent.error);
  logQueryError("my lessons forks", forks.error);
  const countsById = new Map(
    ((counts.data ?? []) as { lesson_id: string; forks: number; thanks: number | null; new_thanks: number | null }[]).map(
      (c) => [c.lesson_id, c]
    )
  );
  const thanked = new Set<string>((sent.data ?? []) as string[]);
  const forkWorked = new Map(
    ((forks.data ?? []) as { id: string; status: string; removed_at: string | null }[]).map((f) => [
      f.id,
      !f.removed_at && (f.status === "done" || f.status === "partial"),
    ])
  );

  return (
    <>
      {(courses ?? []).map((course) => (
        <section key={course.id} className="flex flex-col gap-4">
          <h2 className="flex flex-wrap items-baseline gap-2 text-xl font-bold">
            {course.name}
            {course.section && <span className="text-base font-medium text-muted">{course.section}</span>}
          </h2>
          {!course.share_decided && <SharePrompt courseId={course.id} />}
          {course.lessons.length === 0 && <p className="text-sm text-muted">No lessons in this class.</p>}
          {groupByTopic([...course.lessons].sort(newestFirst)).map(([topic, lessons]) => (
            <div key={topic ?? "(none)"} className="flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{topic ?? "No topic"}</h3>
              <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {lessons.map((lesson) => {
                  const isFork = lesson.kind === "fork";
                  const originalId = lesson.forked_from_lesson_id;
                  const originalVisible = originalTeacher.has(originalId ?? "");
                  // A fork has no page of its own: the original lesson is the hub.
                  const href = isFork ? (originalVisible ? `/lesson/${originalId}` : null) : `/lesson/${lesson.id}`;
                  const status = isFork ? myForkStatus(lesson.classroom_state) : null;
                  const own = countsById.get(lesson.id);
                  const badge = isFork ? null : thanksBadge({ thanks: own?.thanks, newThanks: own?.new_thanks });
                  const problem = isFork ? null : publishProblemLabel(lesson.attachments);
                  const thanks = isFork
                    ? forkThanksState({
                        sent: !!lesson.fork_id && thanked.has(lesson.fork_id),
                        originalVisible,
                        forkOk: !!lesson.fork_id && (forkWorked.get(lesson.fork_id) ?? false),
                      })
                    : null;
                                  const originalPictures = isFork && originalId ? originalAttachments.get(originalId) : undefined;
                  const authorName = firstName(originalTeacher.get(originalId ?? "")) ?? "the author";

                  return (
                    <li key={lesson.id}>
                      <LessonCard
                        href={href}
                        title={lesson.title}
                        classLine={`${course.name}${course.section ? ` · ${course.section}` : ""}`}
                        course={course.name}
                        teacher={
                          isFork
                            ? originalVisible
                              ? `Forked from ${originalTeacher.get(originalId ?? "") ?? "a teacher"}`
                              : "Forked from a lesson that's no longer shared"
                            : null
                        }
                        isYou={!isFork}
                        topic={isFork ? null : lesson.topic_name}
                        attachments={lesson.attachments}
                        lessonId={lesson.id}
                        pictureLessonId={originalPictures ? originalId! : undefined}
                        pictureAttachments={originalPictures}
                        notice={
                          problem && (
                            <Link href={`/lesson/${lesson.id}`} className="relative z-10 truncate text-xs font-semibold text-danger underline">
                              {problem}
                            </Link>
                          )
                        }
                        footerLeft={
                          isFork ? (
                            status && <span className="text-muted">{status}</span>
                          ) : (
                            badge && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-2 py-px font-semibold text-brand">
                                {badge.label}
                                {badge.hasNew && (
                                  <>
                                    <span aria-hidden="true" className="size-[7px] rounded-full bg-brand" />
                                    <span className="sr-only">{badge.newCount} new</span>
                                  </>
                                )}
                              </span>
                            )
                          )
                        }
                        footerRight={
                          isFork ? (
                            <>
                              {thanks === "sent" && <ThanksSent />}
                              {thanks === "can-thank" && lesson.fork_id && (
                                <SayThanks forkId={lesson.fork_id} authorName={authorName} />
                              )}
                            </>
                          ) : (
                            <ForkedCount count={own?.forks ?? 0} />
                          )
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {courses?.length === 0 && showEmptyNote && (
        <p className="text-sm text-muted">No active classes found where you are a teacher.</p>
      )}
    </>
  );
}
