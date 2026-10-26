import Link from "next/link";
import { redirect } from "next/navigation";
import { CardPicture } from "@/components/card-picture";
import { WelcomeFrame } from "@/components/welcome-frame";
import { cardMedia, type MediaAttachment } from "@/lib/cards/media";
import { firstName } from "@/lib/initials";
import { forkedLabel } from "@/lib/library/forks";
import { safeNext, welcomePath, welcomeStep } from "@/lib/onboarding/gate";
import { isGrade, isSubject } from "@/lib/onboarding/labels";
import { fromSchoolLine, payoffCandidates, payoffHeadline, pickPayoff } from "@/lib/onboarding/payoff";
import { getProfile } from "@/lib/onboarding/require";
import { logQueryError } from "@/lib/supabase/log";
import { createClient } from "@/lib/supabase/server";
import { btnPrimary } from "@/lib/ui";

type Row = {
  id: string;
  owner_id: string;
  title: string;
  source_updated_at: string | null;
  teacher: { name: string | null; email: string; school_id: string | null; school: { name: string } | null } | null;
  course: { name: string; subject: string | null; grade: string | null } | null;
  attachments: (MediaAttachment & { kind: string })[];
};

// users!lessons_owner_id_fkey: saved_lessons is a second lessons-to-users
// path (PGRST201). users -> schools has one path (users.school_id).
const PAYOFF_SELECT =
  "id, owner_id, title, source_updated_at, teacher:users!lessons_owner_id_fkey(name, email, school_id, school:schools(name)), course:courses(name, subject, grade), attachments(kind, mime_type, url, position, library_file_id, thumbnail_path, thumbnail_version)";

// Onboarding screen 4: lessons that match what she teaches, waiting for her.
// Her copies and pictures run silently in the background; nothing here says so.
export default async function DonePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.onboarded_at) {
    redirect(welcomePath(welcomeStep({ onboardedAt: null, schoolId: profile.school_id }), next));
  }

  // Signed-in client: row level security gives the same lessons as the Library.
  const supabase = await createClient();
  const [{ data: rows, error }, { data: myClasses, error: classesError }, { data: school }] = await Promise.all([
    supabase
      .from("lessons")
      .select(PAYOFF_SELECT)
      .eq("kind", "original")
      .eq("hidden", false)
      .neq("owner_id", profile.id)
      .order("source_updated_at", { ascending: false, nullsFirst: false })
      .limit(300)
      .returns<Row[]>(),
    supabase.from("courses").select("subject, grade").eq("owner_id", profile.id),
    profile.school_id
      ? supabase.from("schools").select("name").eq("id", profile.school_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  logQueryError("welcome payoff lessons", error);
  logQueryError("welcome payoff classes", classesError);

  const lessons = payoffCandidates(rows ?? [], profile.id);
  const { data: counts, error: countsError } = lessons.length
    ? await supabase.rpc("lesson_fork_counts", { ids: lessons.map((l) => l.id) })
    : { data: [], error: null };
  logQueryError("welcome payoff fork counts", countsError);
  const forks = new Map(((counts ?? []) as { lesson_id: string; forks: number }[]).map((c) => [c.lesson_id, c.forks]));

  const payoff = pickPayoff({
    candidates: lessons.map((l) => ({
      ...l,
      ownerSchoolId: l.teacher?.school_id ?? null,
      subject: l.course?.subject ?? null,
      grade: l.course?.grade ?? null,
      forks: forks.get(l.id) ?? 0,
      updatedAt: l.source_updated_at,
    })),
    myClasses: (myClasses ?? []).map((c) => ({
      subject: isSubject(c.subject) ? c.subject : null,
      grade: isGrade(c.grade) ? c.grade : null,
    })),
    mySchoolId: profile.school_id,
  });

  const name = firstName(profile.name);
  const allSet = name ? `You're all set, ${name}` : "You're all set";
  const button = next
    ? { href: next, label: "Open the lesson" }
    : { href: "/library", label: payoff.mode === "match" ? "See them in the Library" : "Go to the Library" };

  return (
    <WelcomeFrame step={4}>
      {payoff.mode === "empty" ? (
        <h1 className="text-[22px] font-bold leading-tight">{allSet}</h1>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-[.04em] text-brand">{allSet}</p>
          <h1 className="text-[22px] font-bold leading-tight">
            {payoff.mode === "match"
              ? payoffHeadline(payoff.total, payoff.label)
              : "Here's what teachers in your district are sharing"}
          </h1>
          {payoff.mode === "match" && (
            <p className="text-muted">
              Taught by teachers in your district.
              {payoff.fromMySchool > 0 && school?.name && <> {fromSchoolLine(payoff.fromMySchool, school.name)}</>}
            </p>
          )}
          <ul className="flex flex-col gap-2.5">
            {payoff.lessons.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lesson/${l.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line p-2 hover:border-brand"
                >
                  <div className="w-[90px] shrink-0 overflow-hidden rounded-lg">
                    <CardPicture media={cardMedia(l.id, l.attachments)} course={l.course?.name} labels={[]} />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold">{l.title}</p>
                    <p className="truncate text-xs text-muted">
                      {[l.teacher?.name ?? l.teacher?.email ?? "A teacher", l.teacher?.school?.name, forkedLabel(l.forks) ?? "Not forked yet"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href={button.href} className={`${btnPrimary} w-full`}>
        {button.label}
      </Link>
      <p className="text-center text-xs text-muted">
        Your own lessons are in <b>My lessons</b>.
      </p>
    </WelcomeFrame>
  );
}
