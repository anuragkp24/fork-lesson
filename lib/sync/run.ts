import "server-only";
import {
  GoogleApiError,
  getDriveMimeType,
  listCourseWork,
  listCourses,
  listTopics,
} from "@/lib/google/classroom";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachmentKeys, mapCourseWork, type MappedAttachment } from "./map";

type Admin = ReturnType<typeof createAdminClient>;

type ExistingAttachment = MappedAttachment & { id: string; mime_type: string | null };

function failureText(err: unknown): string {
  if (err instanceof GoogleApiError) {
    return err.httpStatus === 401
      ? "Google rejected the saved sign-in. Sign out and sign in again."
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
export async function runSync(userId: string, domain: string, token: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("sync_state").upsert({ user_id: userId, last_started_at: new Date().toISOString(), last_error: null });

  let coursesCount = 0;
  let lessonsCount = 0;
  let lastError: string | null = null;

  try {
    const courses = await listCourses(token);
    coursesCount = courses.length;

    const { data: courseRows, error: courseError } = await admin
      .from("courses")
      .upsert(
        courses.map((c) => ({
          owner_id: userId,
          google_course_id: c.id,
          name: c.name ?? "(untitled class)",
          section: c.section ?? null,
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

  // Lessons: whole-class, published only
  const mapped = courseWork.flatMap((work) => {
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

  // Lessons no longer published, or now for individual students
  const stale = admin.from("lessons").delete().eq("course_id", courseId);
  const { error: pruneError } = mapped.length
    ? await stale.not("google_coursework_id", "in", inList(mapped.map((l) => l.google_coursework_id)))
    : await stale;
  if (pruneError) throw pruneError;

  return mapped.length;
}

// Updates the rows a lesson already has (matched by attachmentKeys) so later
// slices keep their library copies, adds new ones and removes gone ones.
async function syncAttachments(admin: Admin, token: string, lessonId: string, incoming: MappedAttachment[]) {
  const { data, error } = await admin
    .from("attachments")
    .select("id, position, kind, title, url, drive_file_id, share_mode, unsupported_type, mime_type")
    .eq("lesson_id", lessonId);
  if (error) throw error;

  const existing = (data ?? []) as ExistingAttachment[];
  const existingByKey = new Map(attachmentKeys(existing).map((key, i) => [key, existing[i]]));
  const keys = attachmentKeys(incoming);
  const matched = new Set<string>();

  const withMime = await Promise.all(
    incoming.map(async (att, i) => {
      const old = existingByKey.get(keys[i]);
      if (att.kind !== "drive") return { att, old, mime: null };
      const mime = old?.mime_type ?? (await getDriveMimeType(att.drive_file_id!, token));
      return { att, old, mime };
    })
  );

  const toInsert: object[] = [];
  for (const { att, old, mime } of withMime) {
    if (old) {
      matched.add(old.id);
      const { error: updateError } = await admin
        .from("attachments")
        .update({ ...att, mime_type: mime })
        .eq("id", old.id);
      if (updateError) throw updateError;
    } else {
      toInsert.push({ ...att, lesson_id: lessonId, mime_type: mime });
    }
  }
  if (toInsert.length) {
    const { error: insertError } = await admin.from("attachments").insert(toInsert);
    if (insertError) throw insertError;
  }

  const gone = existing.filter((e) => !matched.has(e.id)).map((e) => e.id);
  if (gone.length) {
    const { error: deleteError } = await admin.from("attachments").delete().in("id", gone);
    if (deleteError) throw deleteError;
  }
}
