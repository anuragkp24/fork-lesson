import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { SignOutLink, WelcomeFrame } from "@/components/welcome-frame";
import { AutoRefresh } from "@/app/lessons/auto-refresh";
import { safeNext, welcomePath } from "@/lib/onboarding/gate";
import { prefillClass, type ClassForPrefill } from "@/lib/onboarding/prefill";
import { requireOnboarding } from "@/lib/onboarding/require";
import { logQueryError } from "@/lib/supabase/log";
import { createClient } from "@/lib/supabase/server";
import { syncNow } from "@/lib/sync/auto";
import { needsSync } from "@/lib/sync/schedule";
import { alertError, btnSecondary } from "@/lib/ui";
import { retryReadAction } from "../actions";
import { ClassesForm, type ClassRow } from "./classes-form";

type Course = ClassForPrefill & { id: string; lessons: { kind: string }[] };

// Onboarding screen 3: each active class with its subject, grade and share
// toggle. Nothing is copied to Drive until she submits.
export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const profile = await requireOnboarding();
  if (!profile.school_id) redirect(welcomePath("school", next));

  const supabase = await createClient();
  const [{ data: courses, error }, { data: sync }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name, section, shared, share_decided, classroom_subject, classroom_levels, subject, grade, lessons(kind)")
      .eq("owner_id", profile.id)
      .order("name")
      .returns<Course[]>(),
    supabase.from("sync_state").select("last_started_at, last_finished_at, last_error").eq("user_id", profile.id).maybeSingle(),
  ]);
  logQueryError("welcome classes", error);

  const reading =
    needsSync({ lastStartedAt: sync?.last_started_at ?? null, lastFinishedAt: sync?.last_finished_at ?? null, now: new Date() }) ===
    "running";
  // The read the auth callback starts can be lost (the function stopped
  // early). With no classes and no sync ever recorded, start it here, once.
  const neverRead = !sync;
  if ((courses ?? []).length === 0 && neverRead) {
    after(() => syncNow(profile.id, profile.domain, "onboarding", { publish: false }));
  }

  const rows: ClassRow[] = (courses ?? []).map((c) => {
    const start = prefillClass(c);
    return {
      id: c.id,
      label: `${c.name}${c.section ? ` · ${c.section}` : ""}`,
      assignments: c.lessons.filter((l) => l.kind === "original").length,
      subject: start.subject.value ?? "",
      subjectPrefilled: start.subject.source !== null,
      grade: start.grade.value ?? "",
      gradePrefilled: start.grade.source !== null,
      shared: start.shared,
    };
  });
  const finding = rows.length === 0 && (reading || neverRead);

  return (
    <WelcomeFrame step={3}>
      {/* Counts can lag while the read is still on later classes. */}
      <AutoRefresh active={reading || finding} everyMs={3_000} />
      <h1 className="text-[22px] font-bold leading-tight">Your classes</h1>
      <p className="text-muted">
        Check the subject and grade, and choose which classes to share with teachers in your district. You can change
        this anytime.
      </p>

      {rows.length > 0 ? (
        <ClassesForm rows={rows} next={next} />
      ) : finding ? (
        <p className="flex items-center gap-2 text-muted">
          <span
            aria-hidden="true"
            className="inline-block size-3.5 animate-spin rounded-full border-2 border-[#cfd8d3] border-t-brand"
          />
          Finding your classes…
        </p>
      ) : sync?.last_error ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className={alertError}>
            We couldn&apos;t read your classes from Google.
          </p>
          <form action={retryReadAction}>
            <button type="submit" className={`${btnSecondary} w-full`}>
              Try again
            </button>
          </form>
        </div>
      ) : (
        <>
          <p className="text-muted">No active classes found where you&apos;re a teacher.</p>
          <ClassesForm rows={[]} next={next} />
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={welcomePath("school", next)}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline"
        >
          ← Change school
        </Link>
        <SignOutLink />
      </div>
    </WelcomeFrame>
  );
}
