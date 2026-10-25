import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { FileChip } from "@/components/file-chip";
import { ForkIcon } from "@/components/fork-icon";
import { SaveButton } from "@/components/save-button";
import { SayThanks, ThanksSent } from "@/components/say-thanks";
import { YouTag } from "@/components/you-tag";
import { forkStatusLabel, forkedLabel, hubSection, hubTarget, taughtLabel } from "@/lib/library/forks";
import { sortTagCounts, tagLabel } from "@/lib/hub/tags";
import { forkThanksState } from "@/lib/hub/thanks";
import { firstName, initials } from "@/lib/initials";
import { drivePreviewUrl } from "@/lib/library/links";
import { logQueryError } from "@/lib/supabase/log";
import { createClient, getUser } from "@/lib/supabase/server";
import { attachmentLabel } from "@/lib/sync/map";
import { attachmentThumbnailSrc } from "@/lib/cards/thumbnail";
import { FilePreview } from "@/components/file-preview";
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
    thumbnail_path: string | null;
    thumbnail_version: string | null;
  }[];
};

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getUser())!;
  const supabase = await createClient();

  // Row level security hides lessons I'm not allowed to see, so they 404.
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(
      "id, owner_id, kind, forked_from_lesson_id, title, description, topic_name, teacher:users!lessons_owner_id_fkey(name, email), course:courses(name, section), attachments(id, position, kind, title, url, mime_type, unsupported_type, library_file_id, publish_error, thumbnail_path, thumbnail_version)"
    )
    .eq("id", id)
    .maybeSingle<LessonDetail>();
  // A real failure is logged; a lesson hidden by row level security is just a 404.
  logQueryError("lesson page", lessonError);
  if (!lesson) notFound();

  // A fork has no page of its own: the original lesson is the hub.
  const hub = hubTarget(lesson);
  if (hub) redirect(`/lesson/${hub}`);

  // The database decides what each viewer may see: the author gets every fork
  // (no status) and "taught", a forker only their own forks with status,
  // anyone else only the count.
  const isOwner = lesson.owner_id === user.id;
  const [forksResult, countsResult, tagsResult, savedResult] = await Promise.all([
    supabase.rpc("lesson_forks", { p_lesson: lesson.id }),
    supabase.rpc("lesson_fork_counts", { ids: [lesson.id] }),
    supabase.rpc("lesson_tag_counts", { ids: [lesson.id] }),
    // Whether I saved it: my own rows only, and never for my own lesson.
    isOwner
      ? { data: null, error: null }
      : supabase.from("saved_lessons").select("lesson_id").eq("lesson_id", lesson.id).maybeSingle(),
  ]);
  logQueryError("lesson forks", forksResult.error);
  logQueryError("lesson fork counts", countsResult.error);
  logQueryError("lesson tag counts", tagsResult.error);
  logQueryError("lesson saved", savedResult.error);
  const forkRows = forksResult.data;
  const countRows = countsResult.data;
  const tagRows = tagsResult.data;
  const savedRow = savedResult.data;
  const counts = ((countRows ?? []) as { forks: number; taught: number | null }[])[0];
  const forks = (forkRows ?? []) as {
    fork_id: string;
    forker_id: string;
    forker_name: string;
    class_name: string;
    section: string | null;
    created_at: string;
    state: string | null;
    shoutout_tags: string[] | null;
    shoutout_note: string | null;
  }[];

  const likes = sortTagCounts((tagRows ?? []) as { tag: string; n: number }[]);
  const section = hubSection({ isOwner, forkCount: forks.length });
  const forked = forkedLabel(counts?.forks ?? 0);
  const taught = isOwner ? taughtLabel(counts?.taught) : null;
  const attachments = [...lesson.attachments].sort((a, b) => a.position - b.position);
  // Drive files in the library get a large preview; everything else keeps its row.
  const previews = attachments.filter((a) => a.kind === "drive" && a.library_file_id);
  const rows = attachments.filter((a) => !(a.kind === "drive" && a.library_file_id));

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
            {isOwner && <YouTag />}
            <span>· {lesson.topic_name ?? "No topic"}</span>
            {forked && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
                · <ForkIcon /> {forked}
              </span>
            )}
            {taught && <span>· {taught}</span>}
          </p>
          {!isOwner && (
            <div className="flex flex-wrap items-center gap-3">
              <ForkDialog
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                lessonTopic={lesson.topic_name}
                authorName={firstName(lesson.teacher?.name) ?? "the author"}
                classes={classes}
                items={forkItems}
              />
              <SaveButton lessonId={lesson.id} initialSaved={!!savedRow} variant="header" />
            </div>
          )}
        </header>

        {likes.length > 0 && (
          <section className={`${card} flex flex-col gap-3 p-6`}>
            <h2 className="text-lg font-bold">What teachers like</h2>
            <ul className="flex flex-wrap gap-2">
              {likes.map((t) => (
                <li
                  key={t.tag}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-sm font-semibold text-brand"
                >
                  {t.label} <span className="font-bold">{t.n}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
          {previews.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {previews.map((att) => (
                <li key={att.id}>
                  <FilePreview
                    href={drivePreviewUrl(att.library_file_id!, att.mime_type)}
                    src={att.thumbnail_path ? attachmentThumbnailSrc(att.id, att.thumbnail_version) : null}
                    label={attachmentLabel(att)}
                    title={att.title ?? "(untitled)"}
                  />
                </li>
              ))}
            </ul>
          )}
          <ul className="flex flex-col gap-3">
            {rows.map((att) => {
              const href = att.kind === "drive" ? null : att.url;
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

        {section && (
          <section className={`${card} flex flex-col gap-3 p-6`}>
            <h2 className="text-lg font-bold">
              {section === "forked-by" ? "Forked by" : forks.length === 1 ? "Your fork" : "Your forks"}
            </h2>
            {forks.length === 0 ? (
              <p className="text-muted">Nobody has forked this yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {forks.map((fork) => {
                  // The author never sees a forker's Draft / Assigned.
                  const status = section === "your-fork" ? forkStatusLabel(fork.state) : null;
                  const tagLabels = (fork.shoutout_tags ?? []).flatMap((key) => tagLabel(key) ?? []);
                  // Only a forker's own row: the thank-you they sent, or a way to send one.
                  const thanks =
                    section === "your-fork"
                      ? forkThanksState({
                          sent: fork.shoutout_tags !== null,
                          originalVisible: true,
                          forkOk: true,
                        })
                      : null;
                  return (
                    <li key={fork.fork_id} className="flex flex-wrap items-start gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand"
                        aria-hidden="true"
                      >
                        {initials(fork.forker_name, null)}
                      </span>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-semibold">
                          <span>{fork.forker_name}</span>
                          {fork.forker_id === user.id && <YouTag />}
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
                        {tagLabels.length > 0 && (
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            {tagLabels.map((label) => (
                              <span
                                key={label}
                                className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand"
                              >
                                {label}
                              </span>
                            ))}
                          </span>
                        )}
                        {fork.shoutout_note && (
                          <blockquote className="mt-1.5 border-l-2 border-brand pl-3 text-sm italic">
                            “{fork.shoutout_note}”
                          </blockquote>
                        )}
                      </div>
                      {thanks && (
                        <span className="ml-auto">
                          {thanks === "sent" ? (
                            <ThanksSent />
                          ) : (
                            <SayThanks forkId={fork.fork_id} authorName={firstName(lesson.teacher?.name) ?? "the author"} />
                          )}
                        </span>
                      )}
                      {status && (
                        <span
                          className={`${thanks ? "" : "ml-auto"} rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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
        )}

        {/* Room for a future "How did it go?" notes section. */}
        <MarkThanksSeen lessonId={isOwner ? lesson.id : null} />
      </main>
    </>
  );
}

// The author opened her lesson, so its thank-yous are no longer new. Runs
// after the page has read its counts; a failure just leaves the dot on.
async function MarkThanksSeen({ lessonId }: { lessonId: string | null }) {
  if (lessonId) {
    const supabase = await createClient();
    await supabase.rpc("mark_thanks_seen", { p_lesson: lessonId });
  }
  return null;
}
