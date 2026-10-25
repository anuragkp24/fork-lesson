import "server-only";
import { GoogleApiError, getCourseWork } from "@/lib/google/classroom";
import { trashFile } from "@/lib/google/drive";
import type { createAdminClient } from "@/lib/supabase/admin";
import { syncAttachments } from "./attachments";
import { forkStateFrom, partitionCourseWork, type ForkState } from "./forks";
import { mapLesson, type ClassroomCourseWork } from "./map";

type Admin = ReturnType<typeof createAdminClient>;

// Recognizes the forks we created in this class (by the courseWork id we got
// back at fork time) and keeps them as kind = 'fork' lessons: tagged with the
// original, marked Draft or Assigned, never published, and with any library
// copies from before this existed moved to the trash.
//
// Returns the courseWork that is the teacher's own, and the ids of forks that
// must survive pruning.
export async function syncForks(ctx: {
  admin: Admin;
  userId: string;
  domain: string;
  token: string;
  courseId: string;
  googleCourseId: string;
  courseWork: ClassroomCourseWork[];
  topicName: Map<string, string | null>;
}): Promise<{ regular: ClassroomCourseWork[]; keepIds: Set<string> }> {
  const { admin, userId, domain, token, courseId, googleCourseId, courseWork, topicName } = ctx;

  const { data: records } = await admin
    .from("forks")
    .select("id, root_lesson_id, google_coursework_id")
    .eq("forker_id", userId)
    .eq("target_course_id", courseId)
    .not("google_coursework_id", "is", null)
    .is("removed_at", null);
  // Fork lessons whose record is gone (the original was deleted) stay forks.
  const { data: knownForkLessons } = await admin
    .from("lessons")
    .select("google_coursework_id")
    .eq("course_id", courseId)
    .eq("kind", "fork");

  const recordByWorkId = new Map((records ?? []).map((r) => [r.google_coursework_id as string, r]));
  const forkIds = new Set([
    ...recordByWorkId.keys(),
    ...(knownForkLessons ?? []).map((l) => l.google_coursework_id as string),
  ]);
  if (forkIds.size === 0) return { regular: courseWork, keepIds: new Set() };

  const { forks: listed, regular } = partitionCourseWork(courseWork, forkIds);
  const listedById = new Map(listed.map((w) => [w.id, w]));
  const keepIds = new Set<string>();

  for (const workId of forkIds) {
    let work: ClassroomCourseWork | null = listedById.get(workId) ?? null;
    let state: ForkState = "PUBLISHED";

    if (!work) {
      // Not in the PUBLISHED list: a draft, or gone. Ask Classroom directly.
      try {
        work = await getCourseWork(googleCourseId, workId, token);
        state = work ? forkStateFrom(work.state) : "REMOVED";
      } catch (err) {
        // Can't tell (permissions, network): leave the fork exactly as it is.
        console.error("[sync] fork lookup failed", {
          error: err instanceof GoogleApiError ? err.message : "unknown",
        });
        keepIds.add(workId);
        continue;
      }
    }

    if (!work || state === "REMOVED") {
      await admin.from("lessons").delete().eq("owner_id", userId).eq("google_coursework_id", workId);
      const record = recordByWorkId.get(workId);
      if (record) await admin.from("forks").update({ removed_at: new Date().toISOString() }).eq("id", record.id);
      continue;
    }

    keepIds.add(workId);
    const lesson = mapLesson(work);
    const record = recordByWorkId.get(workId);
    const { data: row, error } = await admin
      .from("lessons")
      .upsert(
        {
          owner_id: userId,
          course_id: courseId,
          domain,
          google_coursework_id: workId,
          title: lesson.title,
          description: lesson.description,
          work_type: lesson.work_type,
          max_points: lesson.max_points,
          topic_name: lesson.topic_id ? (topicName.get(lesson.topic_id) ?? null) : null,
          source_updated_at: lesson.source_updated_at,
          synced_at: new Date().toISOString(),
          kind: "fork",
          classroom_state: state,
          ...(record ? { fork_id: record.id, forked_from_lesson_id: record.root_lesson_id } : {}),
        },
        { onConflict: "google_coursework_id" }
      )
      .select("id, version_shared")
      .single();
    if (error) throw error;

    await syncAttachments(admin, token, row.id, lesson.attachments);
    if (!row.version_shared) await trashLibraryCopies(admin, token, row.id);
  }

  return { regular, keepIds };
}

// A fork must not have files in the library. Moves any to the trash
// (reversible), and forgets them only once that worked. A failure is retried
// on the next sync; the lesson is already hidden from the Library either way.
async function trashLibraryCopies(admin: Admin, token: string, lessonId: string) {
  const { data } = await admin
    .from("attachments")
    .select("id, library_file_id")
    .eq("lesson_id", lessonId)
    .not("library_file_id", "is", null);

  const trashed = new Map<string, boolean>();
  for (const att of data ?? []) {
    const fileId = att.library_file_id as string;
    let ok = trashed.get(fileId);
    if (ok === undefined) {
      try {
        await trashFile(fileId, token);
        ok = true;
      } catch (err) {
        // Already gone counts as done.
        ok = err instanceof GoogleApiError && err.httpStatus === 404;
        if (!ok) console.error("[sync] couldn't trash a fork's library copy", { error: String(err instanceof GoogleApiError ? err.message : "unknown") });
      }
      trashed.set(fileId, ok);
    }
    if (ok) await admin.from("attachments").update({ library_file_id: null, publish_error: null }).eq("id", att.id);
  }
  if (trashed.size) console.log(`[sync] moved ${[...trashed.values()].filter(Boolean).length} library copies of a fork to the trash`);
}
