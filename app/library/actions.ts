"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

export type SaveResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Save for later. Written with the signed-in client, not the admin client, so
// row level security on saved_lessons is the guard: only my own rows, and only
// for a visible original that isn't mine.
export async function setSaved(input: { lessonId: unknown; saved: unknown }): Promise<SaveResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (typeof input.lessonId !== "string" || !UUID.test(input.lessonId) || typeof input.saved !== "boolean") {
    return { ok: false, error: "Bad request." };
  }

  const supabase = await createClient();
  const { error } = input.saved
    ? await supabase.from("saved_lessons").insert({ lesson_id: input.lessonId })
    : await supabase.from("saved_lessons").delete().eq("lesson_id", input.lessonId).eq("user_id", user.id);
  // 23505: already saved, which is what the teacher wanted.
  if (error && error.code !== "23505") return { ok: false, error: "Couldn't save. Try again." };

  revalidatePath("/library");
  revalidatePath("/lessons");
  revalidatePath(`/lesson/${input.lessonId}`);
  return { ok: true };
}
