"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { emailDomain } from "@/lib/domain";
import { parseClassChoices } from "@/lib/onboarding/choices";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { syncNow } from "@/lib/sync/auto";

export async function syncAction() {
  const user = await getUser();
  if (!user?.email) return;

  await syncNow(user.id, emailDomain(user.email), "manual");
  revalidatePath("/lessons");
}

export type ShareState = { error?: string };

// The "Share this class with teachers in your district?" answer, with the
// class's subject and grade (same rules as onboarding: sharing needs both).
// Yes shares it and starts a sync so its files are published; Not now keeps
// it private.
export async function shareClassAction(_prev: ShareState, form: FormData): Promise<ShareState> {
  const user = await getUser();
  if (!user?.email) return {};

  const share = form.get("answer") === "yes";
  const parsed = parseClassChoices([
    {
      courseId: String(form.get("course") ?? ""),
      subject: String(form.get(`subject:${form.get("course")}`) ?? ""),
      grade: String(form.get(`grade:${form.get("course")}`) ?? ""),
      shared: share,
    },
  ]);
  if (!parsed.ok) return { error: Object.values(parsed.errors)[0] };
  const [choice] = parsed.choices;
  if (!choice) return {};

  const { error } = await createAdminClient()
    .from("courses")
    .update({ subject: choice.subject, grade: choice.grade, shared: share, share_decided: true })
    .eq("id", choice.courseId)
    .eq("owner_id", user.id);
  if (error) {
    console.error("[lessons] share answer failed", { userId: user.id, code: error.code });
    return { error: "Couldn't save. Please try again." };
  }

  if (share) {
    const domain = emailDomain(user.email);
    after(() => syncNow(user.id, domain, "manual"));
  }
  revalidatePath("/lessons");
  return {};
}
