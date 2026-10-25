import { serveThumbnail, notFound } from "@/lib/cards/serve";
import { pickThumbnailAttachment } from "@/lib/cards/thumbnail";
import { createClient, getUser } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A lesson's card picture (its first file that has one), from our own copy.
// The signed-in client reads the lesson, so row level security decides who may see it (hidden, unshared,
// other domain and signed out all get a 404); only then does the admin client
// read the private bucket.
export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  if (!UUID.test(lessonId)) return notFound();

  const user = await getUser();
  if (!user) return notFound();

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, kind, attachments(position, kind, library_file_id, thumbnail_path)")
    .eq("id", lessonId)
    .eq("kind", "original")
    .maybeSingle();
  if (!lesson) return notFound();

  const picked = pickThumbnailAttachment(lesson.attachments);
  if (!picked?.thumbnail_path) return notFound();

  return serveThumbnail(picked.thumbnail_path);
}
