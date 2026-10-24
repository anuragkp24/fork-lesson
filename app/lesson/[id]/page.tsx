import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { driveOpenUrl } from "@/lib/library/links";
import { createClient, getUser } from "@/lib/supabase/server";
import { attachmentLabel } from "@/lib/sync/map";

type LessonDetail = {
  id: string;
  owner_id: string;
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
      "id, owner_id, title, description, topic_name, teacher:users(name, email), course:courses(name, section), attachments(id, position, kind, title, url, mime_type, unsupported_type, library_file_id, publish_error)"
    )
    .eq("id", id)
    .maybeSingle<LessonDetail>();
  if (!lesson) notFound();

  const isOwner = lesson.owner_id === user.id;
  const attachments = [...lesson.attachments].sort((a, b) => a.position - b.position);

  return (
    <>
      <AppNav current={isOwner ? "lessons" : "library"} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        <Link href={isOwner ? "/lessons" : "/library"} className="text-sm text-zinc-500 underline">
          ← {isOwner ? "My lessons" : "Library"}
        </Link>

        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-zinc-500">Teacher</dt>
            <dd>{isOwner ? "You" : (lesson.teacher?.name ?? lesson.teacher?.email ?? "A teacher")}</dd>
            <dt className="text-zinc-500">Class</dt>
            <dd>
              {lesson.course ? `${lesson.course.name}${lesson.course.section ? ` · ${lesson.course.section}` : ""}` : "—"}
            </dd>
            <dt className="text-zinc-500">Topic</dt>
            <dd>{lesson.topic_name ?? "No topic"}</dd>
          </dl>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Instructions</h2>
          {lesson.description ? (
            <p className="whitespace-pre-wrap text-sm leading-6">{lesson.description}</p>
          ) : (
            <p className="text-sm text-zinc-500">No instructions.</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Attachments</h2>
          {attachments.length === 0 && <p className="text-sm text-zinc-500">No attachments.</p>}
          <ul className="flex flex-col gap-2 text-sm">
            {attachments.map((att) => {
              // Drive files: everyone opens the library copy; the owner's own
              // original is reachable from My lessons.
              const href = att.kind === "drive" ? (att.library_file_id ? driveOpenUrl(att.library_file_id) : null) : att.url;
              return (
                <li key={att.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="w-14 shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-center text-xs font-medium dark:bg-zinc-800">
                    {attachmentLabel(att)}
                  </span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                      {att.title ?? href}
                    </a>
                  ) : (
                    <span>{att.title ?? "(untitled)"}</span>
                  )}
                  {att.kind === "drive" && !att.library_file_id && (
                    <span className="text-xs text-red-700">
                      {att.publish_error ? "This file couldn't be shared." : "Not shared yet."}
                    </span>
                  )}
                  {att.kind === "unsupported" && (
                    <span className="text-xs text-amber-700">Not copied. Re-add it after forking.</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {!isOwner && (
          <div>
            <button
              type="button"
              disabled
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white opacity-50 dark:bg-white dark:text-black"
            >
              Fork to my class (coming next)
            </button>
          </div>
        )}
      </main>
    </>
  );
}
