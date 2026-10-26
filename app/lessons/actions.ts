"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { emailDomain } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { syncNow } from "@/lib/sync/auto";

export async function syncAction() {
  const user = await getUser();
  if (!user?.email) return;

  await syncNow(user.id, emailDomain(user.email), "manual");
  revalidatePath("/lessons");
}

// The "Share this class with teachers in your district?" answer. Yes shares it
// and starts a sync so its files are published; Not now keeps it private.
export async function shareClassAction(courseId: string, share: boolean) {
  const user = await getUser();
  if (!user?.email) return;

  const { error } = await createAdminClient()
    .from("courses")
    .update({ shared: share, share_decided: true })
    .eq("id", courseId)
    .eq("owner_id", user.id);
  if (error) {
    console.error("[lessons] share answer failed", { userId: user.id, code: error.code });
    return;
  }

  if (share) {
    const domain = emailDomain(user.email);
    after(() => syncNow(user.id, domain, "manual"));
  }
  revalidatePath("/lessons");
}
