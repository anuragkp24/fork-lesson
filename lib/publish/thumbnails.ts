import "server-only";
import { sizedThumbnailLink } from "@/lib/cards/thumbnail";
import { describeFailure } from "@/lib/google/describe";
import { fetchThumbnail, getThumbnailInfo } from "@/lib/google/drive";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

const BUCKET = "thumbnails";
const MAX_PER_SYNC = 25;
const PICTURE_PX = 640;

type Row = {
  id: string;
  position: number;
  kind: string;
  library_file_id: string | null;
  thumbnail_path: string | null;
};

// Keeps our own copy of the picture of each Drive file in the teacher's shared
// lessons (for the cards and the lesson page). Reads Drive only
// (the library copy's thumbnail, with the teacher's token) and writes to our
// private "thumbnails" bucket. Never throws: a failure just means the card
// shows its icon until the next sync.
export async function fetchCardThumbnails(admin: Admin, userId: string, token: string): Promise<void> {
  try {
    const { data: lessons, error } = await admin
      .from("lessons")
      .select("id, courses!inner(shared, share_decided), attachments(id, position, kind, library_file_id, thumbnail_path)")
      .eq("owner_id", userId)
      .eq("kind", "original")
      .eq("hidden", false)
      .eq("courses.shared", true)
      .eq("courses.share_decided", true);
    if (error) throw error;

    // Every Drive file with a library copy and no picture yet, each lesson's
    // files in order, so a lesson's first file is never behind its later ones.
    const todo = (lessons ?? []).flatMap((l) =>
      [...(l.attachments as Row[])]
        .sort((a, b) => a.position - b.position)
        .filter((a) => a.kind === "drive" && a.library_file_id && !a.thumbnail_path)
    );
    let fetched = 0;
    let stored = 0;
    for (const att of todo.slice(0, MAX_PER_SYNC)) {
      fetched += 1;
      if (await fetchOne(admin, userId, att, token)) stored += 1;
    }
    console.log(`[thumbnails] ${lessons?.length ?? 0} lessons, ${todo.length} files need a picture, ${fetched} tried, ${stored} saved`);
  } catch (err) {
    console.error("[thumbnails] failed", { userId, error: describeFailure(err) });
  }

  await removeUnusedPictures(admin, userId);
}

// A brand-new Drive copy often has no picture for about a minute. Once per
// sync, for the files copied in this run that still have none: wait a little,
// then look again. At most RETRY_WAIT_MS plus ten files' worth of requests, and
// never fails the sync. Anything still missing is picked up by the next sync.
export const RETRY_WAIT_MS = 20_000;
const RETRY_MAX_FILES = 10;

export async function retryNewPictures(
  admin: Admin,
  userId: string,
  token: string,
  copiedIds: string[],
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<void> {
  if (copiedIds.length === 0) return;
  try {
    const { data, error } = await admin
      .from("attachments")
      .select("id, position, kind, library_file_id, thumbnail_path")
      .in("id", copiedIds)
      .is("thumbnail_path", null)
      .not("library_file_id", "is", null);
    if (error) throw error;
    const todo = ((data ?? []) as Row[]).slice(0, RETRY_MAX_FILES);
    if (todo.length === 0) return;

    await wait(RETRY_WAIT_MS);
    let stored = 0;
    for (const att of todo) if (await fetchOne(admin, userId, att, token)) stored += 1;
    console.log(`[thumbnails] retry: ${todo.length} tried, ${stored} saved`);
  } catch (err) {
    console.error("[thumbnails] retry failed", { userId, error: describeFailure(err) });
  }
}

// True when a picture was saved.
async function fetchOne(admin: Admin, userId: string, att: Row, token: string): Promise<boolean> {
  const checkedAt = new Date().toISOString();
  try {
    const info = await getThumbnailInfo(att.library_file_id!, token);
    if (!info.hasThumbnail || !info.thumbnailLink) {
      // New copies can take a while to get a picture; look again next sync.
      await admin.from("attachments").update({ thumbnail_checked_at: checkedAt }).eq("id", att.id);
      return false;
    }

    // The larger size is undocumented, so fall back to the link as given.
    const sized = sizedThumbnailLink(info.thumbnailLink, PICTURE_PX);
    let picture = null;
    if (sized !== info.thumbnailLink) picture = await fetchThumbnail(sized, token).catch(() => null);
    picture ??= await fetchThumbnail(info.thumbnailLink, token);
    if (!picture) {
      await admin.from("attachments").update({ thumbnail_checked_at: checkedAt }).eq("id", att.id);
      return false;
    }

    const path = `${userId}/${att.id}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, picture.bytes, { contentType: picture.contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { error: saveError } = await admin
      .from("attachments")
      .update({ thumbnail_path: path, thumbnail_version: info.thumbnailVersion, thumbnail_checked_at: checkedAt })
      .eq("id", att.id);
    if (saveError) throw saveError;
    return true;
  } catch (err) {
    // Logged without the link. Stamp the attempt so a failure shows in the data.
    console.error("[thumbnails] file failed", { error: describeFailure(err) });
    await admin.from("attachments").update({ thumbnail_checked_at: checkedAt }).eq("id", att.id);
    return false;
  }
}

// Removes objects in this teacher's folder that no attachment row points at
// any more (lesson deleted, file removed).
async function removeUnusedPictures(admin: Admin, userId: string): Promise<void> {
  try {
    const { data: rows, error } = await admin
      .from("attachments")
      .select("thumbnail_path, lessons!inner(owner_id)")
      .eq("lessons.owner_id", userId)
      .not("thumbnail_path", "is", null);
    if (error) throw error;
    const used = new Set((rows ?? []).map((r) => r.thumbnail_path as string));

    const { data: objects, error: listError } = await admin.storage.from(BUCKET).list(userId, { limit: 1000 });
    if (listError) throw listError;
    const unused = (objects ?? []).map((o) => `${userId}/${o.name}`).filter((path) => !used.has(path));
    if (unused.length === 0) return;

    const { error: removeError } = await admin.storage.from(BUCKET).remove(unused);
    if (removeError) throw removeError;
  } catch (err) {
    console.error("[thumbnails] clean-up failed", { userId, error: describeFailure(err) });
  }
}
