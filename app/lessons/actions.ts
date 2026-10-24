"use server";

import { revalidatePath } from "next/cache";
import { emailDomain } from "@/lib/domain";
import { getAccessToken } from "@/lib/google/access-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { runSync } from "@/lib/sync/run";

export async function syncAction() {
  const user = await getUser();
  if (!user?.email) return;

  const token = await getAccessToken(user.id);
  if (token.status !== "ok") {
    await createAdminClient().from("sync_state").upsert({
      user_id: user.id,
      last_finished_at: new Date().toISOString(),
      last_error:
        token.status === "reconnect_required"
          ? "Google needs you to sign in again."
          : "Couldn't reach Google. Try again in a minute.",
    });
  } else {
    await runSync(user.id, emailDomain(user.email), token.accessToken);
  }

  revalidatePath("/lessons");
}
