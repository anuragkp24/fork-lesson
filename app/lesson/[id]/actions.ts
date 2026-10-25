"use server";

import { revalidatePath } from "next/cache";
import { parseShoutout } from "@/lib/hub/shoutout";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export type ShoutoutResult = { ok: true } | { ok: false; error: string };

// Thanks the author after a fork. One per fork, final once sent. Only the
// forker may send it, and only for a fork that worked.
export async function sendShoutout(input: { forkId: unknown; tags: unknown; note: unknown }): Promise<ShoutoutResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (typeof input.forkId !== "string") return { ok: false, error: "Bad request." };

  const parsed = parseShoutout(input);
  if (!parsed.ok) return parsed;

  const admin = createAdminClient();
  const { data: fork } = await admin
    .from("forks")
    .select("id, root_lesson_id")
    .eq("id", input.forkId)
    .eq("forker_id", user.id)
    .in("status", ["done", "partial"])
    .is("removed_at", null)
    .maybeSingle();
  if (!fork) return { ok: false, error: "This fork can't be thanked." };

  const { error } = await admin
    .from("fork_shoutouts")
    .insert({ fork_id: fork.id, tags: parsed.tags, note: parsed.note });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "You already sent thanks for this fork." : "Couldn't send. Try again." };
  }

  if (fork.root_lesson_id) revalidatePath(`/lesson/${fork.root_lesson_id}`);
  revalidatePath("/lessons");
  return { ok: true };
}
