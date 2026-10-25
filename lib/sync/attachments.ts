import "server-only";
import { getDriveMimeType } from "@/lib/google/classroom";
import type { createAdminClient } from "@/lib/supabase/admin";
import { attachmentKeys, type MappedAttachment } from "./map";

type Admin = ReturnType<typeof createAdminClient>;
type ExistingAttachment = MappedAttachment & { id: string; mime_type: string | null };

// Updates the rows a lesson already has (matched by attachmentKeys) so later
// slices keep their library copies, adds new ones and removes gone ones.
export async function syncAttachments(admin: Admin, token: string, lessonId: string, incoming: MappedAttachment[]) {
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
