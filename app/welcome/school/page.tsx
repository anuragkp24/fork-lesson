import { SignOutLink, WelcomeFrame } from "@/components/welcome-frame";
import { safeNext } from "@/lib/onboarding/gate";
import { requireOnboarding } from "@/lib/onboarding/require";
import { firstName } from "@/lib/initials";
import { logQueryError } from "@/lib/supabase/log";
import { createClient } from "@/lib/supabase/server";
import { SchoolForm } from "./school-form";

// Onboarding screen 2. The district (email domain) can't tell us the school,
// so she picks one; a school she types is added for everyone in the district.
export default async function SchoolPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const profile = await requireOnboarding();

  // Row level security: schools in her domain only.
  const supabase = await createClient();
  const { data: schools, error } = await supabase.from("schools").select("id, name").order("name");
  logQueryError("welcome schools", error);
  const name = firstName(profile.name);

  return (
    <WelcomeFrame step={2}>
      <h1 className="text-[22px] font-bold leading-tight">
        {name ? `Hi ${name}, which school are you at?` : "Which school are you at?"}
      </h1>
      <p className="text-muted">So we can show you lessons from colleagues in your building first.</p>
      <SchoolForm schools={schools ?? []} current={profile.school_id} next={next} />
      <SignOutLink />
    </WelcomeFrame>
  );
}
