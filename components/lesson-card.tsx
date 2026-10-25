import Link from "next/link";
import type { ReactNode } from "react";
import { FileChip } from "@/components/file-chip";
import { ForkIcon } from "@/components/fork-icon";
import { SaveButton } from "@/components/save-button";
import { YouTag } from "@/components/you-tag";
import type { TagCount } from "@/lib/hub/tags";
import { forkedLabel } from "@/lib/library/forks";
import { attachmentSummaryParts } from "@/lib/library/search";
import { card } from "@/lib/ui";

type CardAttachment = { kind: string; mime_type: string | null; unsupported_type: string | null };

// One lesson card, for the Library, Saved and My lessons. The title is the
// link and stretches over the whole card (after:absolute); the heart and
// anything else clickable sit on top of it (relative z-10), so links and
// buttons never nest.
export function LessonCard({
  href,
  title,
  classLine,
  teacher,
  isYou = false,
  topic,
  description,
  attachments,
  forkCount = 0,
  action,
  tags = [],
  badges,
}: {
  href: string | null;
  title: string;
  classLine?: string;
  teacher?: string | null;
  isYou?: boolean;
  topic?: string | null;
  description?: string | null;
  attachments: CardAttachment[];
  forkCount?: number;
  action?: ReactNode;
  tags?: TagCount[];
  badges?: ReactNode;
}) {
  const forked = forkedLabel(forkCount);
  const byLine = teacher || isYou || topic;
  return (
    <div
      className={`${card} relative flex h-full flex-col gap-3 p-5 transition-colors ${href ? "hover:border-brand" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-3">
          {classLine && <p className="text-xs font-bold uppercase tracking-wider text-brand">{classLine}</p>}
          <h4 className="text-lg font-bold leading-snug">
            {href ? (
              <Link href={href} className="after:absolute after:inset-0 after:content-[''] hover:text-brand">
                {title}
              </Link>
            ) : (
              title
            )}
          </h4>
        </div>
        {action && <div className="-mr-2 -mt-2 shrink-0">{action}</div>}
      </div>
      {byLine && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {teacher && <span>{teacher}</span>}
          {isYou && <YouTag />}
          {topic && <span>· {topic}</span>}
        </p>
      )}
      {description && (
        <p className="text-sm text-muted">{description.length > 160 ? `${description.slice(0, 160)}…` : description}</p>
      )}
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="What teachers like">
          {tags.map((t) => (
            <li
              key={t.tag}
              className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand"
            >
              {t.label} · {t.n}
            </li>
          ))}
        </ul>
      )}
      {badges && <div className="relative z-10 flex w-fit flex-wrap items-center gap-2">{badges}</div>}
      {(attachments.length > 0 || forked) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {attachmentSummaryParts(attachments).map(({ label, count }) => (
              <FileChip key={label} label={label} count={count} />
            ))}
          </div>
          {forked && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <ForkIcon /> {forked}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export type LibraryLesson = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  topic_name: string | null;
  source_updated_at: string | null;
  teacher: { name: string | null; email: string } | null;
  course: { name: string; section: string | null } | null;
  attachments: CardAttachment[];
};

// users!lessons_owner_id_fkey: saved_lessons is a second lessons-to-users path,
// so a bare users embed is ambiguous (PGRST201).
export const LIBRARY_LESSON_SELECT =
  "id, owner_id, title, description, topic_name, source_updated_at, teacher:users!lessons_owner_id_fkey(name, email), course:courses(name, section), attachments(kind, mime_type, unsupported_type)";

// A Library or Saved card: class, teacher, top tags, and a heart on everyone
// else's lessons.
export function LibraryCard({
  lesson,
  mine,
  saved,
  forkCount,
  tags,
}: {
  lesson: LibraryLesson;
  mine: boolean;
  saved: boolean;
  forkCount: number;
  tags: TagCount[];
}) {
  const classLine = lesson.course
    ? `${lesson.course.name}${lesson.course.section ? ` · ${lesson.course.section}` : ""}`
    : "Class";
  return (
    <LessonCard
      href={`/lesson/${lesson.id}`}
      title={lesson.title}
      classLine={classLine}
      teacher={lesson.teacher?.name ?? lesson.teacher?.email ?? "A teacher"}
      isYou={mine}
      topic={lesson.topic_name}
      attachments={lesson.attachments}
      forkCount={forkCount}
      tags={tags}
      action={mine ? null : <SaveButton lessonId={lesson.id} initialSaved={saved} />}
    />
  );
}
