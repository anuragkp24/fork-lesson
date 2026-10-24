import "server-only";
import { copyWithFallback, createFolder, ensureDomainReader, folderUsable, getFileInfo } from "@/lib/google/drive";
import { describeFailure } from "@/lib/google/describe";
import { createAdminClient } from "@/lib/supabase/admin";

const LIBRARY_FOLDER_NAME = "Fork Lesson library";

type PendingAttachment = {
  id: string;
  title: string | null;
  drive_file_id: string;
  mime_type: string | null;
};

// Publishes the teacher's shared lessons: copies each Drive attachment into
// the "Fork Lesson library" folder in their Drive, shared with their domain
// as reader. Originals are never touched. Never throws; the outcome goes to
// sync_state and each attachment's publish_error.
export async function publishLibrary(userId: string, domain: string, token: string): Promise<void> {
  const admin = createAdminClient();
  let folderError: string | null = null;

  try {
    // Shared, not hidden lessons only
    const { data: lessons, error } = await admin
      .from("lessons")
      .select("id, courses!inner(shared), attachments(id, kind, title, drive_file_id, mime_type, library_file_id)")
      .eq("owner_id", userId)
      .eq("hidden", false)
      .eq("courses.shared", true);
    if (error) throw error;

    const drive = (lessons ?? []).flatMap((l) => l.attachments).filter((a) => a.kind === "drive");
    const pending = drive.filter((a) => !a.library_file_id) as PendingAttachment[];

    if (pending.length > 0) {
      const folderId = await ensureLibraryFolder(admin, userId, domain, token);
      // The same file attached to two lessons is copied once.
      const copiedThisRun = new Map<string, string>();
      for (const a of drive) if (a.library_file_id) copiedThisRun.set(a.drive_file_id!, a.library_file_id);

      for (const att of pending) {
        const existing = copiedThisRun.get(att.drive_file_id);
        const result = existing
          ? { libraryFileId: existing, error: null }
          : await publishOne(att, folderId, token);
        if (result.libraryFileId) copiedThisRun.set(att.drive_file_id, result.libraryFileId);
        await admin
          .from("attachments")
          .update({ library_file_id: result.libraryFileId, publish_error: result.error })
          .eq("id", att.id);
      }
    }
  } catch (err) {
    console.error("[publish] failed", { userId, error: describeFailure(err) });
    folderError = `Couldn't set up the Fork Lesson library: ${describeFailure(err)}.`;
  }

  // published_count = Drive files from this teacher's lessons that are in the library
  const { count } = await admin
    .from("attachments")
    .select("id, lessons!inner(owner_id)", { count: "exact", head: true })
    .eq("lessons.owner_id", userId)
    .not("library_file_id", "is", null);

  const { data: state } = await admin.from("sync_state").select("last_error").eq("user_id", userId).maybeSingle();
  await admin
    .from("sync_state")
    .update({ published_count: count ?? 0, last_error: state?.last_error ?? folderError })
    .eq("user_id", userId);
}

async function ensureLibraryFolder(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  domain: string,
  token: string
): Promise<string> {
  const { data: profile, error } = await admin.from("users").select("library_folder_id").eq("id", userId).single();
  if (error) throw error;

  let folderId = profile.library_folder_id;
  if (!folderId || !(await folderUsable(folderId, token))) {
    folderId = await createFolder(LIBRARY_FOLDER_NAME, token);
    const { error: saveError } = await admin.from("users").update({ library_folder_id: folderId }).eq("id", userId);
    if (saveError) throw saveError;
  }
  await ensureDomainReader(folderId, domain, token);
  return folderId;
}

async function publishOne(
  att: PendingAttachment,
  folderId: string,
  token: string
): Promise<{ libraryFileId: string | null; error: string | null }> {
  try {
    const info = att.title && att.mime_type ? { name: att.title, mimeType: att.mime_type } : await getFileInfo(att.drive_file_id, token);
    const name = att.title ?? info.name;

    const copy = await copyWithFallback(att.drive_file_id, name, info.mimeType, folderId, token);
    console.log(`[publish] copied via ${copy.method}`);
    return { libraryFileId: copy.id, error: null };
  } catch (err) {
    console.error("[publish] file failed", { error: describeFailure(err) });
    return { libraryFileId: null, error: describeFailure(err) };
  }
}
