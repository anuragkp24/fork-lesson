import { notFound, serveThumbnail } from "@/lib/cards/serve";
import { createClient, getUser } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One file's picture, for the lesson page. The signed-in client reads the
// attachment, and the attachments policy follows the lesson's, so a lesson
// the viewer can't see (hidden, unshared, other domain, signed out) is a 404.
export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  if (!UUID.test(attachmentId)) return notFound();

  const user = await getUser();
  if (!user) return notFound();

  const { data: attachment } = await (await createClient())
    .from("attachments")
    .select("kind, library_file_id, thumbnail_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!attachment || attachment.kind !== "drive" || !attachment.library_file_id || !attachment.thumbnail_path) {
    return notFound();
  }
  return serveThumbnail(attachment.thumbnail_path);
}
