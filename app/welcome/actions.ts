"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { choicesFromForm, parseClassChoices, type ChoiceErrors } from "@/lib/onboarding/choices";
import { safeNext, welcomePath } from "@/lib/onboarding/gate";
import { getProfile } from "@/lib/onboarding/require";
import { findSchool, parseSchoolName } from "@/lib/onboarding/school";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncNow } from "@/lib/sync/auto";

// Writes go through the secret-key client (there are no write policies), and
// every one is scoped to the signed-in teacher's own rows and domain.

async function onboardingProfile() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.onboarded_at) redirect("/library");
  return profile;
}

export type SchoolState = { error?: string };

// Screen 2: a school from the list, or a typed name (an existing school with
// the same name is reused, otherwise it is added for the whole district).
export async function saveSchoolAction(_prev: SchoolState, form: FormData): Promise<SchoolState> {
  const profile = await onboardingProfile();
  const next = safeNext(String(form.get("next") ?? ""));
  const choice = String(form.get("school") ?? "");
  const admin = createAdminClient();

  let schoolId: string | null = null;
  if (choice && choice !== "new") {
    const { data } = await admin.from("schools").select("id").eq("id", choice).eq("domain", profile.domain).maybeSingle();
    if (!data) return { error: "Pick a school from the list." };
    schoolId = data.id;
  } else {
    const name = parseSchoolName(String(form.get("newSchool") ?? ""));
    if (!name) return { error: "Type your school's name." };

    const findExisting = async () => {
      const { data, error } = await admin.from("schools").select("id, name").eq("domain", profile.domain);
      if (error) console.error("[welcome] school lookup failed", { userId: profile.id, code: error.code });
      return findSchool(data ?? [], name);
    };
    schoolId = (await findExisting())?.id ?? null;
    if (!schoolId) {
      const { data, error } = await admin.from("schools").insert({ domain: profile.domain, name }).select("id").single();
      // 23505: another teacher added the same name a moment ago; use theirs.
      if (error?.code === "23505") schoolId = (await findExisting())?.id ?? null;
      else if (error) console.error("[welcome] school insert failed", { userId: profile.id, code: error.code });
      else schoolId = data.id;
    }
    if (!schoolId) return { error: "Couldn't save your school. Please try again." };
  }

  const { error } = await admin.from("users").update({ school_id: schoolId }).eq("id", profile.id);
  if (error) {
    console.error("[welcome] school save failed", { userId: profile.id, code: error.code });
    return { error: "Couldn't save your school. Please try again." };
  }
  redirect(welcomePath("classes", next));
}

export type ClassesState = { errors?: ChoiceErrors; error?: string };

// Screen 3: subject, grade and share for every class on the screen, then
// onboarding is done. Only now does the full sync run (copies and pictures),
// and only for the classes she shared.
export async function saveClassesAction(_prev: ClassesState, form: FormData): Promise<ClassesState> {
  const profile = await onboardingProfile();
  if (!profile.school_id) redirect(welcomePath("school"));
  const next = safeNext(String(form.get("next") ?? ""));

  const parsed = parseClassChoices(choicesFromForm(form));
  if (!parsed.ok) return { errors: parsed.errors };

  const admin = createAdminClient();
  const results = await Promise.all(
    parsed.choices.map((c) =>
      admin
        .from("courses")
        .update({ subject: c.subject, grade: c.grade, shared: c.shared, share_decided: true })
        .eq("id", c.courseId)
        .eq("owner_id", profile.id)
    )
  );
  const failed = results.find((r) => r.error)?.error;
  if (failed) {
    console.error("[welcome] class save failed", { userId: profile.id, code: failed.code });
    return { error: "Couldn't save your classes. Please try again." };
  }

  const { error } = await admin.from("users").update({ onboarded_at: new Date().toISOString() }).eq("id", profile.id);
  if (error) {
    console.error("[welcome] onboarded save failed", { userId: profile.id, code: error.code });
    return { error: "Couldn't save your classes. Please try again." };
  }

  // Starts now even if the first read is still running: both upsert by Google
  // id, and the class rows already hold her answers.
  after(() => syncNow(profile.id, profile.domain, "onboarding"));
  redirect(welcomePath("done", next));
}

// "Try again" when the first read of her classes failed. Read only, as before.
export async function retryReadAction() {
  const profile = await onboardingProfile();
  // Marks the read as started at once, so the page shows "Finding your
  // classes…" instead of the old error while it runs.
  await createAdminClient()
    .from("sync_state")
    .upsert({ user_id: profile.id, last_started_at: new Date().toISOString(), last_error: null });
  after(() => syncNow(profile.id, profile.domain, "onboarding", { publish: false }));
  revalidatePath("/welcome/classes");
}
