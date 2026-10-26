import { redirect } from "next/navigation";
import { welcomePath, welcomeStep } from "@/lib/onboarding/gate";
import { getProfile } from "@/lib/onboarding/require";

// /welcome alone: the step this teacher is on, or the Library when done.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const step = welcomeStep({ onboardedAt: profile.onboarded_at, schoolId: profile.school_id });
  redirect(step === "done" ? "/library" : welcomePath(step, next));
}
