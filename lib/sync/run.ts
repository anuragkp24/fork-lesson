import "server-only";
import { GoogleApiError, listCourseWork, listCourses, listTopics } from "@/lib/google/classroom";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAttachments } from "./attachments";
import { syncForks } from "./fork-sync";
import { mapCourseWork } from "./map";
import { SIGN_IN_REJECTED, type SyncTrigger } from "./schedule";

type Admin = ReturnType<typeof createAdminClient>;

function failureText(err: unknown): string {
  if (err instanceof GoogleApiError) {
    return err.httpStatus === 401
      ? SIGN_IN_REJECTED
      : `Google said ${err.message.replace("Google API ", "")}.`;
  }
  return "Unexpected error while syncing.";
}

// PostgREST "in" list for ids that are plain Google numbers/strings.
function inList(ids: string[]): string {
  return `(${ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`;
}

// Pulls this teacher's active classes, topics and published whole-class
// assignments into Supabase. Read-only on the Google side. Never throws:
// the outcome is written to sync_state for the page to show.
export async function runSync(
  userId: string,
  domain: string,
  token: string,
  trigger: SyncTrigger = "manual"
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("sync_state").upsert({
    user_id: userId,
    last_started_at: new Date().toISOString(),
    last_trigger: trigger,
    last_error: null,
  });

  let coursesCount = 0;
  let lessonsCount = 0;
  let lastError: string | null = null;

  try {
    const courses = await listCourses(token);
    coursesCount = courses.length;

    // A class we haven't seen before starts unshared and undecided: it is read,
    // but nothing is published (and no colleague sees it) until the teacher
    // answers "Share this class?". Known classes keep their answer.
    const { data: known, error: knownError } = await admin
      .from("courses")
      .select("google_course_id")
      .eq("owner_id", userId);
    if (knownError) throw knownError;
    const knownIds = new Set((known ?? []).map((c) => c.google_course_id));
    const { data: courseRows, error: courseError } = await admin
      .from("courses")
      .upsert(
        courses.map((c) => ({
          owner_id: userId,
          google_course_id: c.id,
          name: c.name ?? "(untitled class)",
          section: c.section ?? null,
          // Classroom's own text, refreshed every time. The teacher's choice
          // (subject, grade) is never sent, so it is never overwritten.
          classroom_subject: c.subject ?? null,
          classroom_levels: c.levels ?? null,
          ...(knownIds.has(c.id) ? {} : { shared: false, share_decided: false }),
        })),
        { onConflict: "owner_id,google_course_id" }
      )
      .select("id, google_course_id");
    if (courseError) throw courseError;

    for (const row of courseRows ?? []) {
      try {
        lessonsCount += await syncCourse(admin, userId, domain, token, row.id, row.google_course_id);
      } catch (err) {
        console.error("[sync] course failed", { userId, error: err instanceof Error ? err.message : "unknown" });
        lastError ??= failureText(err);
      }
    }

    // Classes that are no longer active. A fork aimed at one blocks the
    // delete (foreign key); that's fine, it just stays.
    const keep = courses.map((c) => c.id);
    const stale = admin.from("courses").delete().eq("owner_id", userId);
    const { error: pruneError } = keep.length
      ? await stale.not("google_course_id", "in", inList(keep))
      : await stale;
    if (pruneError) console.error("[sync] stale course prune failed", { userId, code: pruneError.code });
  } catch (err) {
    console.error("[sync] failed", { userId, error: err instanceof Error ? err.message : "unknown" });
    lastError = failureText(err);
  }

  await admin.from("sync_state").upsert({
    user_id: userId,
    last_finished_at: new Date().toISOString(),
    courses_count: coursesCount,
    lessons_count: lessonsCount,
    last_error: lastError,
  });
}

// Returns how many lessons the class now has.
async function syncCourse(
  admin: Admin,
  userId: string,
  domain: string,
  token: string,
  courseId: string,
  googleCourseId: string
): Promise<number> {
  const [topics, courseWork] = await Promise.all([
    listTopics(googleCourseId, token),
    listCourseWork(googleCourseId, token),
  ]);

  // Topics
  if (topics.length) {
    const { error } = await admin.from("topics").upsert(
      topics.map((t) => ({ course_id: courseId, google_topic_id: t.topicId, name: t.name ?? "(untitled topic)" })),
      { onConflict: "course_id,google_topic_id" }
    );
    if (error) throw error;
  }
  const staleTopics = admin.from("topics").delete().eq("course_id", courseId);
  await (topics.length ? staleTopics.not("google_topic_id", "in", inList(topics.map((t) => t.topicId))) : staleTopics);
  const topicName = new Map(topics.map((t) => [t.topicId, t.name ?? null]));

  // Forks we created are tracked separately (and never published); the rest
  // are the teacher's own lessons: whole-class, published only.
  const { regular, keepIds } = await syncForks({
    admin,
    userId,
    domain,
    token,
    courseId,
    googleCourseId,
    courseWork,
    topicName,
  });
  const mapped = regular.flatMap((work) => {
    const result = mapCourseWork(work);
    return result.status === "ok" ? [result.lesson] : [];
  });

  if (mapped.length) {
    const { data: lessonRows, error } = await admin
      .from("lessons")
      .upsert(
        mapped.map((l) => ({
          owner_id: userId,
          course_id: courseId,
          domain,
          google_coursework_id: l.google_coursework_id,
          title: l.title,
          description: l.description,
          work_type: l.work_type,
          max_points: l.max_points,
          topic_name: l.topic_id ? (topicName.get(l.topic_id) ?? null) : null,
          source_updated_at: l.source_updated_at,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "google_coursework_id" }
      )
      .select("id, google_coursework_id");
    if (error) throw error;

    const lessonId = new Map((lessonRows ?? []).map((r) => [r.google_coursework_id, r.id]));
    for (const lesson of mapped) {
      await syncAttachments(admin, token, lessonId.get(lesson.google_coursework_id)!, lesson.attachments);
    }
  }

  // Lessons no longer published, or now for individual students. Forks we
  // are tracking are kept.
  const seen = [...mapped.map((l) => l.google_coursework_id), ...keepIds];
  const stale = admin.from("lessons").delete().eq("course_id", courseId);
  const { error: pruneError } = seen.length
    ? await stale.not("google_coursework_id", "in", inList(seen))
    : await stale;
  if (pruneError) throw pruneError;

  return mapped.length;
}
