import "server-only";
import { listTopics } from "@/lib/google/classroom";
import { createDraftCourseWork, createTopic } from "@/lib/google/classroom-write";
import { describeFailure } from "@/lib/google/describe";
import { copyWithFallback, createFolder, folderUsable, trashFile } from "@/lib/google/drive";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { classworkLink } from "./links";
import {
  buildMaterials,
  describeNotCopied,
  forkWorkType,
  reAddNote,
  topicMatch,
  type ForkSourceAttachment,
  type TopicChoice,
} from "./plan";

const FORKS_FOLDER_NAME = "Fork Lesson";

export type ForkResult =
  | { ok: true; status: "done" | "partial"; className: string; alternateLink: string; notCopied: string[] }
  | { ok: false; httpStatus: number; error: string };

type LessonRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  work_type: string | null;
  max_points: number | null;
  topic_name: string | null;
  forked_from_lesson_id: string | null;
  attachments: (ForkSourceAttachment & { position: number; mime_type: string | null })[];
};

const refuse = (httpStatus: number, error: string): ForkResult => ({ ok: false, httpStatus, error });

// Copies a lesson's library files into the forking teacher's own Drive and
// creates a DRAFT assignment in one of their classes. Everything is checked
// here on the server; the browser's choices are only requests.
export async function runFork(input: {
  userId: string;
  token: string;
  lessonId: string;
  courseId: string;
  topicChoice: TopicChoice;
  // The signed-in client: row level security decides which lessons exist for this teacher.
  supabase: Awaited<ReturnType<typeof createClient>>;
}): Promise<ForkResult> {
  const { userId, token, lessonId, courseId, topicChoice, supabase } = input;
  const admin = createAdminClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, owner_id, title, description, work_type, max_points, topic_name, forked_from_lesson_id, attachments(id, position, kind, title, url, share_mode, mime_type, library_file_id, unsupported_type)"
    )
    .eq("id", lessonId)
    .maybeSingle<LessonRow>();
  if (!lesson) return refuse(404, "That lesson isn't available.");
  if (lesson.owner_id === userId) return refuse(400, "That's your own lesson.");

  const { data: course } = await admin
    .from("courses")
    .select("id, name, section, google_course_id")
    .eq("id", courseId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!course) return refuse(400, "Pick one of your own classes.");
  if (topicChoice !== "none" && !lesson.topic_name) return refuse(400, "This lesson has no topic.");

  // A double click must not make two drafts.
  const { data: recent } = await admin
    .from("forks")
    .select("id")
    .eq("lesson_id", lesson.id)
    .eq("forker_id", userId)
    .eq("target_course_id", course.id)
    .eq("status", "pending")
    .gte("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .limit(1);
  if (recent?.length) return refuse(409, "This fork is already in progress.");

  const { data: fork, error: forkError } = await admin
    .from("forks")
    .insert({
      lesson_id: lesson.id,
      // The original, even when this lesson is someone's shared version of it.
      root_lesson_id: lesson.forked_from_lesson_id ?? lesson.id,
      forker_id: userId,
      target_course_id: course.id,
      topic_choice: topicChoice,
    })
    .select("id")
    .single();
  if (forkError) {
    console.error("[fork] couldn't record fork", { code: forkError.code });
    return refuse(500, "Couldn't start the fork.");
  }

  const copyIds: string[] = [];
  const fail = async (httpStatus: number, error: string) => {
    await admin.from("forks").update({ status: "failed", error, drive_copy_ids: copyIds }).eq("id", fork.id);
    return refuse(httpStatus, error);
  };

  try {
    // The class's topics as Classroom has them now, not as of the last sync.
    const liveTopics = await listTopics(course.google_course_id, token);
    const existing = topicMatch(
      lesson.topic_name,
      liveTopics.map((t) => ({ id: t.topicId, name: t.name ?? null }))
    );
    if (topicChoice === "existing" && !existing) {
      return await fail(409, `The topic “${lesson.topic_name}” isn't in that class any more.`);
    }

    // Copies, into a "Fork Lesson" folder in the forker's Drive
    const sources = [...lesson.attachments].sort((a, b) => a.position - b.position);
    const copies = new Map<string, string>();
    if (sources.some((a) => a.kind === "drive" && a.library_file_id)) {
      const folderId = await ensureForksFolder(admin, userId, token);
      const byLibraryFile = new Map<string, string>();
      for (const att of sources) {
        if (att.kind !== "drive" || !att.library_file_id) continue;
        const done = byLibraryFile.get(att.library_file_id);
        if (done) {
          copies.set(att.id, done);
          continue;
        }
        try {
          const copy = await copyWithFallback(att.library_file_id, att.title ?? "Untitled", att.mime_type, folderId, token);
          console.log(`[fork] copied via ${copy.method}`);
          byLibraryFile.set(att.library_file_id, copy.id);
          copies.set(att.id, copy.id);
          copyIds.push(copy.id);
        } catch (err) {
          console.error("[fork] file failed", { error: describeFailure(err) });
        }
      }
    }

    const { materials, notCopied } = buildMaterials(sources, copies);

    let topicId: string | null = null;
    let created: { id: string; alternateLink?: string };
    try {
      // A topic is created only now that the copies worked, and only if the teacher chose to.
      if (topicChoice === "existing") topicId = existing!.id;
      if (topicChoice === "create") {
        topicId = existing?.id ?? (await createTopic(course.google_course_id, lesson.topic_name!, token));
      }
      created = await createDraftCourseWork(
        course.google_course_id,
        {
          title: lesson.title,
          description: (lesson.description ?? "") + reAddNote(notCopied),
          workType: forkWorkType(lesson.work_type),
          maxPoints: lesson.max_points,
          topicId,
          materials,
        },
        token
      );
    } catch (err) {
      // No draft, so the copies would be orphans: move them to the trash.
      await Promise.all(copyIds.map((id) => trashFile(id, token).catch(() => undefined)));
      throw err;
    }

    const missingDriveFile = notCopied.some((n) => n.reason === "copy_failed" || n.reason === "not_in_library");
    const status = missingDriveFile ? "partial" : "done";
    await admin
      .from("forks")
      .update({
        status,
        google_topic_id: topicId,
        google_coursework_id: created.id,
        drive_copy_ids: copyIds,
        error: notCopied.length ? notCopied.map(describeNotCopied).join("; ") : null,
      })
      .eq("id", fork.id);

    return {
      ok: true,
      status,
      className: `${course.name}${course.section ? ` · ${course.section}` : ""}`,
      alternateLink: classworkLink(course.google_course_id),
      notCopied: notCopied.map(describeNotCopied),
    };
  } catch (err) {
    console.error("[fork] failed", { error: describeFailure(err) });
    return await fail(502, `${describeFailure(err)}. Nothing was posted to your class.`);
  }
}

async function ensureForksFolder(admin: ReturnType<typeof createAdminClient>, userId: string, token: string) {
  const { data: profile, error } = await admin.from("users").select("forks_folder_id").eq("id", userId).single();
  if (error) throw error;

  let folderId = profile.forks_folder_id;
  if (!folderId || !(await folderUsable(folderId, token))) {
    folderId = await createFolder(FORKS_FOLDER_NAME, token);
    const { error: saveError } = await admin.from("users").update({ forks_folder_id: folderId }).eq("id", userId);
    if (saveError) throw saveError;
  }
  return folderId;
}
