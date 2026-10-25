import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const IMAGE = /^image\/(png|jpeg|gif|webp)$/;

export const notFound = () => new Response(null, { status: 404 });

// Sends a stored picture from the private bucket. Call only after the signed-in
// client has shown the viewer may see the lesson (row level security).
export async function serveThumbnail(path: string): Promise<Response> {
  const { data: file, error } = await createAdminClient().storage.from("thumbnails").download(path);
  if (error || !file || !IMAGE.test(file.type)) return notFound();
  return new Response(await file.arrayBuffer(), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
