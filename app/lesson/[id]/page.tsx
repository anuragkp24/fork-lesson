import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { FileChip } from "@/components/file-chip";
import { ForkIcon } from "@/components/fork-icon";
import { forkStatusLabel, forkedLabel, hubTarget } from "@/lib/library/forks";
import { initials } from "@/lib/initials";
import { driveOpenUrl } from "@/lib/library/links";
import { createClient, getUser } from "@/lib/supabase/server";
import { attachmentLabel } from "@/lib/sync/map";
import { card } from "@/lib/ui";
import { ForkDialog, type ForkClass, type ForkItem } from "./fork-dialog";

type LessonDetail = {
  id: string;
  owner_id: string;
  kind: string;
  forked_from_lesson_id: string | null;
  title: string;
  description: string | null;
  topic_name: string | null;
  teacher: { name: string | null; email: string } | null;
  course: { name: string; section: string | null } | null;
  attachments: {
    id: string;
    position: number;
    kind: string;
    title: string | null;
    url: string | null;
    mime_type: string | null;
    unsupported_type: string | null;
    library_file_id: string | null;
    publish_error: string | null;
  }[];
};

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getUser())!;
  const supabase = await createClient();

  // Row level security hides lessons I'm not allowed to see, so they 404.
  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, owner_id, kind, forked_from_lesson_id, title, description, topic_name, teacher:users(name, email), course:courses(name, section), attachments(id, position, kind, title, url, mime_type, unsupported_type, library_file_id, publish_error)"
    )
    .eq("id", id)
    .maybeSingle<LessonDetail>();
  if (!lesson) notFound();

  // A fork has no page of its own: the original lesson is the hub.
  const hub = hubTarget(lesson);
  if (hub) redirect(`/lesson/${hub}`);

  // Who forked this lesson. The database decides what each viewer may see,
  // including that only a forker ever sees their own Draft.
  const { data: forkRows } = await supabase.rpc("lesson_forks", { p_lesson: lesson.id });
  const forkedBy = (forkRows ?? []) as {
    fork_id: string;
    forker_id: string;
    forker_name: string;
    class_name: string;
    section: string | null;
    created_at: string;
    state: string | null;
  }[];

  const isOwner = lesson.owner_id === user.id;
  const attachments = [...lesson.attachments].sort((a, b) => a.position - b.position);

  // Only a non-owner forks, into one of their own classes.
  let classes: ForkClass[] = [];
  if (!isOwner) {
    const { data } = await supabase
      .from("courses")
      .select("id, name, section, topics(name)")
      .eq("owner_id", user.id)
      .order("name")
      .returns<{ id: string; name: string; section: string | null; topics: { name: string }[] }[]>();
    classes = (data ?? []).map((c) => ({ ...c, topics: c.topics.map((t) => t.name) }));
  }

  const forkItems: ForkItem[] = attachments.map((att) => {
    const base = { key: att.id, label: attachmentLabel(att), title: att.title ?? "(untitled)" };
    if (att.kind === "drive") {
      return att.library_file_id
        ? { ...base, outcome: "copy", note: "Copied to your Drive (Fork Lesson folder)" }
        : { ...base, outcome: "skip", note: "Can't be copied. Re-add it after forking." };
    }
    if (att.kind === "unsupported") return { ...base, outcome: "skip", note: "Can't be copied. Re-add it after forking." };
    return { ...base, outcome: "as-is", note: "Added as is" };
  });

  const classLine = lesson.course
    ? `${lesson.course.name}${lesson.course.section ? ` · ${lesson.course.section}` : ""}`
    : "Class";

  return (
    <>
      <AppHeader current={isOwner ? "lessons" : "library"} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10">
        <Link
          href={isOwner ? "/lessons" : "/library"}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline"
        >
          ← {isOwner ? "My lessons" : "Library"}
        </Link>

        <header className={`${card} flex flex-col gap-4 p-6`}>
          <p className="text-xs font-bold uppercase tracking-wider text-brand">{classLine}</p>
          <h1 className="text-3xl font-bold leading-tight">{lesson.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{lesson.teacher?.name ?? lesson.teacher?.email ?? "A teacher"}</span>
            {isOwner && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">You</span>}
            <span>· {lesson.topic_name ?? "No topic"}</span>
            {forkedLabel(forkedBy.length) && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
                · <ForkIcon /> {forkedLabel(forkedBy.length)}
              </span>
            )}
          </p>
          {!isOwner && (
            <div>
              <ForkDialog
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                lessonTopic={lesson.topic_name}
                classes={classes}
                items={forkItems}
              />
            </div>
          )}
        </header>

        <section className={`${card} flex flex-col gap-3 p-6`}>
          <h2 className="text-lg font-bold">Instructions</h2>
          {lesson.description ? (
            <p className="whitespace-pre-wrap leading-7">{lesson.description}</p>
          ) : (
            <p className="text-muted">No instructions.</p>
          )}
        </section>

        <section className={`${card} flex flex-col gap-3 p-6`}>
          <h2 className="text-lg font-bold">Attachments</h2>
          {attachments.length === 0 && <p className="text-muted">No attachments.</p>}
          <ul className="flex flex-col gap-3">
            {attachments.map((att) => {
              // Drive files: everyone opens the library copy.
              const href =
                att.kind === "drive" ? (att.library_file_id ? driveOpenUrl(att.library_file_id) : null) : att.url;
              return (
                <li key={att.id} className="flex flex-wrap items-center gap-2">
                  <FileChip label={attachmentLabel(att)} />
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                      {att.title ?? href}
                    </a>
                  ) : (
                    <span className="font-medium">{att.title ?? "(untitled)"}</span>
                  )}
                  {att.kind === "drive" && !att.library_file_id && (
                    <span className="text-sm text-danger">
                      {att.publish_error ? "This file couldn't be shared." : "Not shared yet."}
                    </span>
                  )}
                  {att.kind === "unsupported" && (
                    <span className="text-sm text-chip-slides-ink">Not copied. Re-add it after forking.</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className={`${card} flex flex-col gap-3 p-6`}>
          <h2 className="text-lg font-bold">Forked by</h2>
          {forkedBy.length === 0 ? (
            <p className="text-muted">Nobody has forked this yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {forkedBy.map((fork) => {
                const status = forkStatusLabel(fork.state);
                return (
                  <li key={fork.fork_id} className="flex flex-wrap items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand"
                      aria-hidden="true"
                    >
                      {initials(fork.forker_name, null)}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {fork.forker_name}
                        {fork.forker_id === user.id && (
                          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">You</span>
                        )}
                      </span>
                      <span className="text-sm text-muted">
                        {fork.class_name}
                        {fork.section ? ` · ${fork.section}` : ""} ·{" "}
                        {new Date(fork.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {status && (
                      <span
                        className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status === "Assigned"
                            ? "bg-chip-sheet text-chip-sheet-ink"
                            : "bg-chip-slides text-chip-slides-ink"
                        }`}
                      >
                        {status}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Room for a future "How did it go?" notes section. */}
      </main>
    </>
  );
}
