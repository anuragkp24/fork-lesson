import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient, getUser } from "@/lib/supabase/server";
import { welcomePath, welcomeStep } from "./gate";

export type Profile = {
  id: string;
  name: string | null;
  email: string;
  domain: string;
  school_id: string | null;
  onboarded_at: string | null;
};

// The signed-in teacher's users row, read once per request. Null when signed
// out (proxy.ts normally catches that first).
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, email, domain, school_id, onboarded_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  return data;
});

// Top of every signed-in app page (Library, My lessons, lesson page), before
// AppHeader, so a teacher who hasn't finished onboarding goes there first and
// no visit sync starts for her. next: where to return afterwards.
export async function requireOnboarded(next?: string): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const step = welcomeStep({ onboardedAt: profile.onboarded_at, schoolId: profile.school_id });
  if (step !== "done") redirect(welcomePath(step, next));
  return profile;
}

// Top of /welcome/school and /welcome/classes: signed in and not onboarded
// yet (an onboarded teacher goes to the Library).
export async function requireOnboarding(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.onboarded_at) redirect("/library");
  return profile;
}
